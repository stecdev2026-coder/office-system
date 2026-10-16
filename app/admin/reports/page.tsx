"use client";
import AdminDatePicker from '@/components/ui/AdminDatePicker';
import LoadingScreen from '@/components/LoadingScreen';
import {usePermissions} from '@/components/Permissions';
import {Download,Search} from 'lucide-react';
import {useEffect,useState} from 'react';

const dateToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const time=(value?:string)=>value?new Date(value).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'}):'—';
export default function AttendanceReports(){
 const {can}=usePermissions(),today=dateToday(),[start,setStart]=useState(today),[end,setEnd]=useState(today),[data,setData]=useState<any>(null),[error,setError]=useState(''),[query,setQuery]=useState('');
 useEffect(()=>{let alive=true;async function load(){try{const r=await fetch(`/api/admin/reports?start=${start}&end=${end}`,{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);if(alive){setData(d);setError('');}}catch(e:any){if(alive)setError(e.message);}}void load();return()=>{alive=false;};},[start,end]);
 const rows=(data?.rows||[]).filter((r:any)=>[r.name,r.branch,r.employee_code].join(' ').toLowerCase().includes(query.toLowerCase()));
 return <div className="space-y-6"><header><h1>รายงานการลงชื่อ</h1><p className="mt-2 text-sm text-gray-500">ตรวจสอบเวลาเข้า–ออก เช็คอินระหว่างวัน และดาวน์โหลดข้อมูลเป็น Excel</p></header>
 <section className="admin-panel flex flex-wrap items-end gap-4 p-5"><AdminDatePicker label="ตั้งแต่" value={start} onChange={setStart} max={end}/><AdminDatePicker label="ถึง" value={end} onChange={setEnd} min={start}/><label className="flex min-h-12 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4"><Search size={17} className="text-gray-400"/><input aria-label="ค้นหารายงาน" className="border-0 bg-transparent outline-none" placeholder="ค้นหาชื่อ รหัส สาขา" value={query} onChange={e=>setQuery(e.target.value)}/></label>{can('attendance.export')&&<a href={`/api/admin/reports?start=${start}&end=${end}&format=xlsx`} className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl bg-emerald-700 px-5 font-semibold text-white"><Download size={18}/>ดาวน์โหลด Excel</a>}</section>
 {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}{!data&&!error&&<LoadingScreen text="กำลังโหลดรายงานลงเวลา…"/>}
 <div className="grid gap-4 md:grid-cols-3">{[['รายการลงเวลา',data?.rows.length],['ยังไม่ลงเวลาออก',data?.rows.filter((r:any)=>!r.check_out_time).length],['ออนไลน์ตอนนี้',data?.employees.filter((e:any)=>e.online).length]].map(([label,n])=><div key={String(label)} className="admin-panel p-6"><p className="text-sm text-gray-500">{label}</p><b className="mt-2 block text-3xl">{n??'—'}</b></div>)}</div>
 <section className="admin-panel overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr>{['วันที่','ชื่อ / สาขา','สถานที่เข้า','เข้างาน','เช็คอินเพิ่ม','ออกงาน','วันทำงาน'].map(h=><th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{rows.map((r:any)=><tr key={r.id}><td className="p-4">{r.work_date}</td><td className="p-4"><b>{r.name}</b><small className="block text-gray-500">{r.branch||'—'}</small></td><td className="p-4">{r.check_in_location}</td><td className="p-4">{time(r.check_in_time)}</td><td className="p-4">{r.checkpoints}</td><td className="p-4">{r.check_out_time?time(r.check_out_time):<span className="text-emerald-700">กำลังทำงาน</span>}</td><td className="p-4">{r.scheduled===null?'ยังไม่ตั้งค่า':r.scheduled?'วันทำงาน':'วันหยุด'}</td></tr>)}</tbody></table>{data&&!rows.length&&<p className="p-8 text-center text-gray-400">ไม่มีรายการในช่วงวันที่เลือก</p>}</section></div>;
}
