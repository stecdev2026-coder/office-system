import { createHash } from 'node:crypto';
export type Metric={label:string;value:number;unit:string};
export type ProviderUsage={status:'ready'|'pending'|'error';message?:string;missing?:string[];metrics:Metric[];scope:string;period:string;fetchedAt?:string};
type Config=Record<string,string|undefined>;
const cache=new Map<string,{until:number,value:ProviderUsage}>();
export function numeric(value:unknown):number|null{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;}
export function aggregateCharges(rows:Record<string,any>[],projectId?:string):Metric[]{
 const selected=projectId?rows.filter(r=>{let tags=r.Tags;if(typeof tags==='string'){try{tags=JSON.parse(tags);}catch{return false;}}return tags?.ProjectId===projectId;}):rows;
 const totals=new Map<string,number>(),usage=new Map<string,number>();
 for(const r of selected){const cost=numeric(r.BilledCost);if(cost!==null&&typeof r.BillingCurrency==='string')totals.set(r.BillingCurrency,(totals.get(r.BillingCurrency)||0)+cost);const quantity=numeric(r.ConsumedQuantity);if(quantity!==null&&typeof r.ConsumedUnit==='string'&&typeof r.ServiceName==='string'){const key=JSON.stringify([r.ServiceName,r.ConsumedUnit]);usage.set(key,(usage.get(key)||0)+quantity);}}
 return [...totals].map(([unit,value])=>({label:'ยอด BilledCost ในช่วงที่เลือก',value,unit})).concat([...usage].map(([key,value])=>{const [label,unit]=JSON.parse(key);return {label,value,unit};}));
}
async function boundedText(response:Response){if(!response.body)return '';const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>8*1024*1024)throw Error('ข้อมูลมากเกินขนาดที่รองรับ');text+=decoder.decode(chunk.value,{stream:true});}return text+decoder.decode();}finally{await reader.cancel().catch(()=>{});}}
async function request(url:string,token:string,fetcher:typeof fetch){const r=await fetcher(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000),redirect:'error'});if(!r.ok){if(r.status===401||r.status===403)throw Error('คีย์ไม่มีสิทธิ์อ่านข้อมูล หรือหมดอายุ');if(r.status===429)throw Error('ผู้ให้บริการจำกัดจำนวนคำขอ กรุณาลองอีกครั้งภายหลัง');throw Error(`ผู้ให้บริการตอบกลับไม่สำเร็จ (${r.status})`);}return boundedText(r);}
async function cached(key:string,fetcher:()=>Promise<ProviderUsage>){const existing=cache.get(key);if(existing&&existing.until>Date.now())return existing.value;let value:ProviderUsage;try{value=await fetcher();}catch(e){value={status:'error',message:e instanceof Error&&['คีย์ไม่มีสิทธิ์','ผู้ให้บริการ','ข้อมูลมากเกิน'].some(p=>e.message.startsWith(p))?e.message:'อ่านข้อมูลไม่สำเร็จ กรุณาลองใหม่',metrics:[],scope:'',period:''};}if(cache.size>20)cache.clear();cache.set(key,{until:Date.now()+(value.status==='ready'?300000:30000),value});return value;}
export async function providerUsage(env:Config=process.env,fetcher:typeof fetch=fetch){
 const token=env.SUPABASE_ACCESS_TOKEN,vercelToken=env.VERCEL_ACCESS_TOKEN,team=env.VERCEL_TEAM_ID,project=env.VERCEL_PROJECT_ID;
 let ref=env.SUPABASE_PROJECT_REF;try{ref=ref||new URL(env.NEXT_PUBLIC_SUPABASE_URL||'').hostname.split('.')[0];}catch{}
 const to=new Date(),from=new Date(Date.UTC(to.getUTCFullYear(),to.getUTCMonth(),1)),period=`${from.toISOString().slice(0,10)} – ${to.toISOString().slice(0,10)} (UTC)`;
 const key=(v:string)=>createHash('sha256').update(v).digest('hex');
 const supabase=token&&ref?cached(key(`supabase:${token}:${ref}`),async()=>{
  if(!/^[a-z]{20}$/.test(ref!))throw Error('ผู้ให้บริการ: Project ref ไม่ถูกต้อง');
  const results=await Promise.allSettled([request(`https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/usage.api-counts?interval=1day`,token,fetcher),request(`https://api.supabase.com/v1/projects/${ref}/config/disk/util`,token,fetcher)]);
  const metrics:Metric[]=[],messages:string[]=[];
  if(results[0].status==='fulfilled'){try{const payload=JSON.parse(results[0].value);if(!Array.isArray(payload.result)||payload.error)throw Error();for(const [field,label] of [['total_auth_requests','Auth requests'],['total_rest_requests','Database API requests'],['total_storage_requests','Storage requests'],['total_realtime_requests','Realtime requests']]){const values=payload.result.map((r:any)=>numeric(r[field])).filter((v:any)=>v!==null);if(values.length)metrics.push({label,value:values.reduce((a:number,b:number)=>a+b,0),unit:'คำขอ'});}}catch{messages.push('รูปแบบข้อมูลคำขอไม่ตรงกับที่รองรับ');}}else messages.push(results[0].reason.message);
  if(results[1].status==='fulfilled'){try{const disk=JSON.parse(results[1].value).metrics;for(const [field,label] of [['fs_used_bytes','ดิสก์ที่ใช้'],['fs_size_bytes','ขนาดดิสก์'],['fs_avail_bytes','ดิสก์ว่าง']]){const value=numeric(disk?.[field]);if(value!==null)metrics.push({label,value,unit:'bytes'});}}catch{messages.push('รูปแบบข้อมูลดิสก์ไม่ตรงกับที่รองรับ');}}else messages.push(results[1].reason.message);
  return {status:metrics.length?'ready':'error',message:messages.length?'อ่านข้อมูลได้ไม่ครบ กรุณาตรวจสิทธิ์ Analytics และ Disk ของคีย์':undefined,metrics,scope:`โปรเจกต์ ${ref}`,period:'จำนวนคำขอ: ช่วงย้อนหลัง 1 วันจาก API · ดิสก์: ค่าล่าสุด',fetchedAt:new Date().toISOString()} as ProviderUsage;
 }):Promise.resolve({status:'pending',missing:[...(!token?['SUPABASE_ACCESS_TOKEN']:[]),...(!ref?['SUPABASE_PROJECT_REF']:[])],metrics:[],scope:'โปรเจกต์ Supabase',period:'ย้อนหลัง 1 วัน'} as ProviderUsage);
 const vercel=vercelToken&&team?cached(key(`vercel:${vercelToken}:${team}:${project||''}:${from.toISOString().slice(0,10)}`),async()=>{
  const url=new URL('https://api.vercel.com/v1/billing/charges');url.searchParams.set('teamId',team);url.searchParams.set('from',from.toISOString());url.searchParams.set('to',to.toISOString());
  const text=await request(url.toString(),vercelToken,fetcher);const rows=text.trim()?text.trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line)):[];
  if(rows.some(r=>!r||Array.isArray(r)||typeof r!=='object'))throw Error('รูปแบบข้อมูลไม่ถูกต้อง');
  return {status:'ready',metrics:aggregateCharges(rows,project),message:rows.length===0?'ไม่มีรายการจาก API ในช่วงนี้':project&&!aggregateCharges(rows,project).length?'ไม่พบรายการของโปรเจกต์นี้ใน API':undefined,scope:project?`โปรเจกต์ ${project}`:`ทั้งทีม ${team}`,period,fetchedAt:new Date().toISOString()};
 }):Promise.resolve({status:'pending',missing:[...(!vercelToken?['VERCEL_ACCESS_TOKEN']:[]),...(!team?['VERCEL_TEAM_ID']:[])],metrics:[],scope:project?`โปรเจกต์ ${project}`:'ทั้งทีม Vercel',period} as ProviderUsage);
 const [s,v]=await Promise.all([supabase,vercel]);return {supabase:s,vercel:v};
}
