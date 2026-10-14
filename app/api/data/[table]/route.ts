import {permissionsFor,protectedEmployeeIds} from '@/lib/permissions/server';
import {hasPermission,allPermissionKeys} from '@/lib/permissions/catalog';
import { NextRequest, NextResponse } from 'next/server';
import { AuthError, checkOrigin, currentSession, database, failure } from '@/lib/auth/server';
const tables = new Set(['employees','attendance','leave_requests','travel_trips','travel_checkpoints','calendar_events','notifications','company_settings','company_holidays']);
async function handle(request: NextRequest, context: { params: Promise<{ table: string }> }) {
 try {
  const {table}=await context.params;
  if(!tables.has(table))throw new AuthError('ไม่พบตาราง',404);
  const read=['GET','HEAD'].includes(request.method);
  if(!read)checkOrigin(request);
  const {employee}=await currentSession();const db=database();
  if(table==='attendance'&&!read)throw new AuthError('ใช้หน้าลงเวลาเพื่อบันทึกข้อมูล',403);
  const access=await permissionsFor(String(employee.id));
  const readKey:Record<string,string>={employees:'users.view',attendance:'attendance.view',leave_requests:'requests.view',calendar_events:'calendar.manage',travel_trips:'travel.manage',travel_checkpoints:'travel.manage',notifications:'requests.view',company_settings:'settings.view',company_holidays:'settings.view'};
  const writeKey:Record<string,string>={employees:request.method==='POST'?'users.create':request.method==='DELETE'?'users.delete':'users.edit',leave_requests:'requests.approve',calendar_events:'calendar.manage',travel_trips:'travel.manage',travel_checkpoints:'travel.manage',notifications:'requests.approve',company_settings:'settings.edit',company_holidays:'settings.edit'};
  const admin=hasPermission(access.permissions,(read?readKey:writeKey)[table]);
  const upstream=new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}`);
  upstream.search=request.nextUrl.search;
  if((upstream.searchParams.get("select")||"").includes("("))throw new AuthError("ไม่รองรับการอ่านตารางสัมพันธ์ผ่านช่องทางนี้",400);
  const headers=new Headers({'apikey':(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY)!, 'Content-Type':'application/json'});
  for(const name of ['accept','prefer','range','range-unit']){const value=request.headers.get(name);if(value)headers.set(name,value);}
  if(headers.get('prefer')?.includes('resolution='))throw new AuthError('ไม่รองรับการบันทึกแบบนี้',400);
  let payload: Record<string,unknown>|Record<string,unknown>[]|undefined;
  if(!read && request.method!=='DELETE')payload=await request.json();
  const superIds=table==='employees'?await protectedEmployeeIds():[];
  if(table==='employees'&&!read){
   if(superIds.length){if(superIds.includes((upstream.searchParams.get('id')||'').replace(/^eq\./,'')))throw new AuthError('ไม่สามารถจัดการบัญชี Super Admin ได้',403);upstream.searchParams.append('id',`not.in.(${superIds.join(',')})`);}
   if(payload){const rows=Array.isArray(payload)?payload:[payload];if(rows.some(row=>superIds.includes(String(row.id))))throw new AuthError('ไม่สามารถจัดการบัญชี Super Admin ได้',403);if(rows.some(row=>row.work_group!==undefined)&&!hasPermission(access.permissions,'groups.members'))throw new AuthError('ไม่มีสิทธิ์จัดกลุ่มพนักงาน',403);if(rows.some(row=>row.role!==undefined)&&!hasPermission(access.permissions,'permissions.manage'))throw new AuthError('ไม่มีสิทธิ์กำหนดบัญชี Admin',403);
    if(rows.some(row=>row.role==='Admin')&&!allPermissionKeys.every(key=>hasPermission(access.permissions,key)))throw new AuthError('มอบสิทธิ์ Admin เกินสิทธิ์ที่คุณมีไม่ได้',403);
    if(request.method==='PATCH'&&rows.some(row=>row.role!==undefined)){if((upstream.searchParams.get('id')||'')===`eq.${employee.id}`)throw new AuthError('เปลี่ยนบทบาทของตัวเองไม่ได้',403);upstream.searchParams.append('id',`neq.${employee.id}`);}
   }
  }
  if(!admin){
   if(['company_settings','company_holidays'].includes(table)){if(!read)throw new AuthError('เฉพาะแอดมิน',403);}
   else if(table==='employees'){
    if(!read && request.method!=='PATCH')throw new AuthError('เฉพาะแอดมิน',403);
    upstream.searchParams.append('id',`eq.${employee.id}`);
    if(payload){const allowed=new Set(['first_name','last_name','nickname','email']);if(Array.isArray(payload)||Object.keys(payload).some(k=>!allowed.has(k)))throw new AuthError('แก้ไขข้อมูลนี้ไม่ได้',403);}
   }else if(table==='travel_checkpoints'){
    const {data:trips,error}=await db.from('travel_trips').select('id').eq('line_user_id',employee.line_user_id);
    if(error)throw error;
    const ids=(trips||[]).map(trip=>trip.id);
    if(read||request.method==='DELETE'||request.method==='PATCH')upstream.searchParams.append('trip_id',`in.(${ids.length?ids.join(','):'00000000-0000-0000-0000-000000000000'})`);
    if(payload){const rows=Array.isArray(payload)?payload:[payload];if(rows.some(row=>!ids.includes(row.trip_id)))throw new AuthError('ไม่ใช่การเดินทางของคุณ',403);}
   }else{
    if(read||request.method==='PATCH'||request.method==='DELETE')upstream.searchParams.append('line_user_id',`eq.${employee.line_user_id}`);
    if(request.method==='DELETE'&&table!=='notifications')throw new AuthError('ลบข้อมูลนี้ไม่ได้',403);
    if(payload){
     const rows=Array.isArray(payload)?payload:[payload];
     for(const row of rows){
      if(request.method==='POST'){
       delete row.id;row.line_user_id=employee.line_user_id;
       if(table==='leave_requests'){row.status='pending';row.employee_name=`${employee.first_name||''} ${employee.last_name||''}`.trim();}
       if(table==='travel_trips')row.status='in_progress';
      }else if(request.method==='PATCH'){
       const allowed:Record<string,string[]>={attendance:['check_out_time','check_out_lat','check_out_lng','check_out_photo_url'],leave_requests:['status','updated_at'],travel_trips:['status','total_distance_km','total_allowance'],notifications:['is_read']};
       if(!allowed[table]||Object.keys(row).some(key=>!allowed[table].includes(key)))throw new AuthError('แก้ไขข้อมูลนี้ไม่ได้',403);
       if(table==='leave_requests'){
        if(!['cancel_pending','cancelled'].includes(String(row.status)))throw new AuthError('อนุมัติคำขอไม่ได้',403);
        upstream.searchParams.append('status',row.status==='cancelled'?'eq.pending':'eq.approved');
       }
      }
     }
    }
   }
  }
  const response=await fetch(upstream,{method:request.method,headers,body:payload===undefined?undefined:JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(15000)});
  const returned=new Headers({'Cache-Control':'no-store','Content-Type':response.headers.get('content-type')||'application/json'});
  for(const name of ['content-range','range-unit']){const value=response.headers.get(name);if(value)returned.set(name,value);}
  if(request.method==='HEAD'||response.status===204)return new NextResponse(null,{status:response.status,headers:returned});
  let text=await response.text();
  if(table==='employees'&&response.ok&&text){const clean=(row:Record<string,unknown>)=>{delete row.device_token;row.is_super_admin=superIds.includes(String(row.id));return row;};const data=JSON.parse(text);text=JSON.stringify(Array.isArray(data)?data.map(clean):clean(data));}
  return new NextResponse(text,{status:response.status,headers:returned});
 }catch(error){return failure(error);}
}
export const GET=handle,HEAD=handle,POST=handle,PATCH=handle,DELETE=handle;
