"use client";
import LoadingScreen from '@/components/LoadingScreen';
import {Building2,Clock3,LogIn,LogOut,MapPin,RefreshCw,Wifi} from 'lucide-react';
import {useCallback,useEffect,useMemo,useState} from 'react';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const time=(value?:string)=>value?new Date(value).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'}):'—';
const thaiDate=(value:string)=>new Date(`${value}T12:00:00+07:00`).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',weekday:'long',day:'numeric',month:'long',year:'numeric'});

export default function CurrentAttendance(){
 const date=today(),[data,setData]=useState<any>(null),[error,setError]=useState(''),[tab,setTab]=useState<'active'|'out'>('active'),[refreshing,setRefreshing]=useState(false);
 const load=useCallback(async(silent=false)=>{if(!silent)setRefreshing(true);try{const r=await fetch(`/api/admin/reports?start=${date}&end=${date}`,{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);setData(d);setError('');}catch(e:any){setError(e.message);}finally{setRefreshing(false);}},[date]);
 useEffect(()=>{void load();const timer=setInterval(()=>void load(true),30000);return()=>clearInterval(timer);},[load]);
 const active=useMemo(()=>(data?.rows||[]).filter((r:any)=>r.check_in_time&&!r.check_out_time),[data]);
 const out=useMemo(()=>(data?.rows||[]).filter((r:any)=>r.check_out_time),[data]);
 const rows=tab==='active'?active:out;
 return <div className="space-y-6">
  <header className="flex flex-wrap items-end justify-between gap-4"><div><h1>ลงเวลางานตอนนี้</h1><p className="mt-2 text-sm text-gray-500">{thaiDate(date)} · อัปเดตข้อมูลทุก 30 วินาที</p></div><button type="button" onClick={()=>void load()} disabled={refreshing} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-blue-600 shadow-sm disabled:opacity-50"><RefreshCw size={17} className={refreshing?'animate-spin':''}/>อัปเดตข้อมูล</button></header>
  {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700 shadow-sm">{error}</p>}
  {!data&&!error&&<LoadingScreen text="กำลังโหลดข้อมูลลงเวลาวันนี้…"/>}
  {data&&<section className="admin-panel overflow-hidden">
   <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2" role="tablist" aria-label="สถานะการลงเวลา">
    <button type="button" role="tab" aria-selected={tab==='active'} onClick={()=>setTab('active')} className={`cursor-pointer rounded-xl px-4 py-4 text-sm font-semibold transition ${tab==='active'?'bg-white text-emerald-700 shadow':'text-gray-500 hover:bg-white/70'}`}><LogIn size={18} className="mr-2 inline"/>ลงเวลาเข้างาน <span className="ml-2 rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">{active.length}</span></button>
    <button type="button" role="tab" aria-selected={tab==='out'} onClick={()=>setTab('out')} className={`cursor-pointer rounded-xl px-4 py-4 text-sm font-semibold transition ${tab==='out'?'bg-white text-rose-700 shadow':'text-gray-500 hover:bg-white/70'}`}><LogOut size={18} className="mr-2 inline"/>ลงชื่อออกงาน <span className="ml-2 rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-700">{out.length}</span></button>
   </div>
   <div className="divide-y divide-slate-100">
    {rows.map((row:any)=><article key={row.id} className="grid gap-4 p-5 transition hover:bg-slate-50/70 md:grid-cols-[1.4fr_1fr_1fr_0.7fr] md:items-center">
     <div><b className="block text-base text-slate-800">{row.name||'ไม่พบชื่อพนักงาน'}</b><span className="mt-1 block text-xs text-gray-500">{row.employee_code||'ไม่มีรหัสพนักงาน'}</span></div>
     <div className="flex items-start gap-2 text-sm"><Building2 size={17} className="mt-0.5 shrink-0 text-slate-400"/><span>{[row.department||row.division,row.branch].filter(Boolean).join(' · ')||'ไม่ระบุสังกัด/สาขา'}</span></div>
     <div className="flex items-start gap-2 text-sm"><MapPin size={17} className="mt-0.5 shrink-0 text-blue-500"/><span><small className="block text-gray-400">{tab==='active'?'สถานที่ลงเวลาเข้า':'สถานที่ลงเวลาออก'}</small>{tab==='active'?row.check_in_location:row.check_out_location}</span></div>
     <div className="flex items-center justify-between gap-3 md:block"><div className="flex items-center gap-2 text-sm"><Clock3 size={17} className="text-slate-400"/><b>{time(tab==='active'?row.check_in_time:row.check_out_time)} น.</b></div>{tab==='active'&&<span className={`mt-2 inline-flex items-center gap-2 text-xs font-medium ${row.online?'text-emerald-700':'text-gray-400'}`}><i className={`h-2 w-2 rounded-full ${row.online?'animate-pulse bg-emerald-500':'bg-gray-300'}`}/><Wifi size={14}/>{row.online?'ออนไลน์':'ออฟไลน์'}</span>}</div>
    </article>)}
    {!rows.length&&<div className="p-12 text-center text-sm text-gray-400">{tab==='active'?'ยังไม่มีพนักงานที่กำลังทำงานในวันนี้':'ยังไม่มีพนักงานลงชื่อออกงานในวันนี้'}</div>}
   </div>
  </section>}
 </div>;
}
