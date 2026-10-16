"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Bell,Clock,ArrowUpRight,MapPin,CalendarDays,CarFront,ChevronRight} from 'lucide-react';
import AccountAvatarPopover from '@/components/AccountAvatarPopover';
import LoadingScreen from '@/components/LoadingScreen';
import {createClient} from '@/utils/supabase/client';
import {enableMobileNotifications} from '@/lib/push/client';
import {toast} from 'sonner';
import PinSetupPrompt from '@/components/PinSetupPrompt';
export default function HomePage(){
 const router=useRouter();
 const [employee,E]=useState<any>(null),[profile,P]=useState<any>(null),[attendance,A]=useState<any>(null),[unread,N]=useState(0),[trip,T]=useState<any>(null),[loading,L]=useState(true),[error,X]=useState('');
 useEffect(()=>{let alive=true;async function load(){try{
  const r=await fetch('/api/auth/session',{cache:'no-store'}),session=await r.json();if(!r.ok)throw Error(session.error||'โหลดข้อมูลไม่สำเร็จ');if(!alive)return;E(session.employee);P(session.profile);
  const db=createClient(),line=session.employee.line_user_id;
  const [att,notifications,trips]=await Promise.all([fetch('/api/attendance',{cache:'no-store'}),db.from('notifications').select('*',{count:'exact',head:true}).eq('line_user_id',line).eq('is_read',false),db.from('travel_trips').select('*').eq('line_user_id',line).eq('status','in_progress').limit(1)]);
  const data=await att.json();if(!att.ok)throw Error(data.error);if(alive){A(data);N(notifications.count||0);T(trips.data?.[0]||null);}
 }catch(e:any){if(alive)X(e.message);}finally{if(alive)L(false);}}void load();return()=>{alive=false;};},[]);
 if(loading)return <LoadingScreen text="กำลังเตรียมวันทำงานของคุณ…"/>;
 const record=attendance?.record,started=!!record?.check_in_time,finished=!!record?.check_out_time;
 const time=(s?:string)=>s?new Date(s).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'}):'00:00';
 async function openNotifications(){try{if('Notification' in window&&Notification.permission!=='granted'){await enableMobileNotifications();toast.success('อนุญาตการแจ้งเตือนแล้ว');}}catch(error){toast.info(error instanceof Error?error.message:'ยังไม่ได้อนุญาตการแจ้งเตือน');}finally{router.push('/notifications');}}
 return <div className="app-page staff-home"><header className="staff-header">
  <AccountAvatarPopover name={[employee?.first_name,employee?.last_name].filter(Boolean).join(' ')}><span className="staff-avatar">{profile?.pictureUrl?<img src={profile.pictureUrl} alt="รูปส่วนตัว"/>:(employee?.first_name||'คุณ').slice(0,1)}</span><span className="text-left"><small className="block text-slate-500">สวัสดี ยินดีต้อนรับ</small><strong>{[employee?.first_name,employee?.last_name].filter(Boolean).join(' ')}</strong></span></AccountAvatarPopover>
  <button type="button" onClick={openNotifications} className="staff-icon-button relative" aria-label={`การแจ้งเตือน ${unread} รายการ`}><Bell size={21}/>{unread>0&&<span className="absolute right-0 top-0 rounded-full bg-teal-700 px-1.5 text-xs text-white">{unread>99?'99+':unread}</span>}</button>
 </header><main className="staff-content space-y-5">
  {error&&<p role="alert" className="text-rose-700">{error}</p>}
  <PinSetupPrompt/>
  <section className="staff-card attendance-hero"><div className="flex justify-between items-center gap-3"><span className="staff-eyebrow"><Clock size={17}/>การลงเวลาวันนี้</span><span className="staff-status">{finished?'เสร็จสิ้น':started?'กำลังทำงาน':'ยังไม่เข้างาน'}</span></div><p className="text-sm text-slate-500 mt-3">{new Date().toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'full'})}</p>
   <div className="grid grid-cols-2 gap-3 my-6"><div className="rounded-2xl border border-emerald-200 bg-emerald-100 p-4"><p className="text-sm font-medium text-emerald-800">เวลาเข้างาน</p><b className={`mt-1 block text-3xl font-semibold tracking-tight ${record?.check_in_time?'text-emerald-950':'text-emerald-700/35'}`}>{time(record?.check_in_time)}</b></div><div className="rounded-2xl border border-red-200 bg-red-100 p-4"><p className="text-sm font-medium text-red-800">เวลาออกงาน</p><b className={`mt-1 block text-3xl font-semibold tracking-tight ${record?.check_out_time?'text-red-950':'text-red-700/35'}`}>{time(record?.check_out_time)}</b></div></div>
   <Link href="/check-in" className="staff-primary">{finished?'ดูประวัติลงเวลาวันนี้':started?'เช็คอินระหว่างวัน / ออกงาน':'ลงเวลาเข้างาน'}<ArrowUpRight size={20}/></Link>
   {started&&!finished&&<p className="text-xs text-slate-500 mt-3 flex items-center gap-2"><MapPin size={14}/>เพิ่มเช็คอินได้หลายครั้ง ก่อนลงเวลาออกงาน</p>}
  </section>
  <h2 className="text-sm font-semibold text-slate-500">บริการสำหรับคุณ</h2>
  <div className="staff-card staff-service-card divide-y divide-blue-100 p-0">
   {[{href:'/hr',icon:CalendarDays,title:'การลาและวันหยุด',detail:'โควต้า ยื่นคำขอ และประวัติการลา'},{href:'/attendance',icon:Clock,title:'ประวัติลงเวลา',detail:'ตรวจสอบการเข้า–ออกงานของคุณ'},{href:'/travel',icon:CarFront,title:trip?'เดินทางที่กำลังบันทึก':'บันทึกการเดินทาง',detail:trip?.purpose||'เริ่มเดินทางและดูรายการที่ผ่านมา'}].map(item=><Link className="staff-menu-row" href={item.href} key={item.href}><span className="staff-menu-icon"><item.icon size={22}/></span><span className="flex-1"><b className="block font-semibold">{item.title}</b><small className="text-slate-500">{item.detail}</small></span><ChevronRight size={18} className="text-slate-400"/></Link>)}
  </div>
 </main></div>;
}
