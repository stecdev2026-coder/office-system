"use client";
import {useEffect,useState,useRef} from 'react';
import {usePermissions} from '@/components/Permissions';
import {menuPermission} from '@/lib/permissions/catalog';
import Link from 'next/link';
import Image from 'next/image';
import {usePathname} from 'next/navigation';
import {Menu,X,LogOut,PanelLeftClose,PanelLeftOpen,Clock3,Users,MapPin,CalendarDays,Settings2,BarChart3,Search,ArrowUpRight,ChevronRight,UserRoundX,ClipboardList,ShieldCheck,Palmtree} from 'lucide-react';
import {logout} from '@/lib/auth/client';
import {toast} from 'sonner';
const groups=['ลงเวลางาน','ผู้ใช้งาน','รายงาน','ระบบ'];
const links=[
 {href:'/admin/attendance',label:'ลงเวลางานตอนนี้',icon:Clock3,group:'ลงเวลางาน'},
 {href:'/admin/unclosed',label:'ไม่ลงเวลาออกงาน (เมื่อวาน)',icon:UserRoundX,group:'ลงเวลางาน'},
 {href:'/admin/workforce',label:'สถานที่ลงเวลา',icon:MapPin,group:'ลงเวลางาน'},
 {href:'/admin/leaves',label:'คำขอลางาน',icon:CalendarDays,group:'ลงเวลางาน'},
 {href:'/admin/holidays',label:'สรุปวันหยุด',icon:Palmtree,group:'ลงเวลางาน'},
 {href:'/admin/groups',label:'กลุ่มงาน',icon:Users,group:'ผู้ใช้งาน'},
 {href:'/admin/users',label:'จัดการพนักงาน',icon:Users,group:'ผู้ใช้งาน'},
 {href:'/admin/reports',label:'รายงานการลงชื่อ',icon:ClipboardList,group:'รายงาน'},
 {href:'/admin/absence',label:'รายงานการขาดงาน',icon:BarChart3,group:'รายงาน'},
 {href:'/admin/permissions',label:'สิทธิ์การใช้งาน',icon:ShieldCheck,group:'ระบบ'},
 {href:'/admin/settings',label:'ตั้งค่าระบบ',icon:Settings2,group:'ระบบ'},
 {href:'/admin/usage',label:'การใช้งานบริการ',icon:BarChart3,group:'ระบบ'}
];
export default function AdminShell({children}:{children:React.ReactNode}){
 const {can,isSuperAdmin}=usePermissions();
 const [open,S]=useState(false),[compact,C]=useState(false),[query,Q]=useState(''),[name,N]=useState('ผู้ดูแลระบบ'),[avatar,A]=useState(''),[profileOpen,O]=useState(false),path=usePathname();
 const profileRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!profileOpen)return;function outside(e:PointerEvent){if(!profileRef.current?.contains(e.target as Node))O(false);}function escape(e:KeyboardEvent){if(e.key==='Escape'){O(false);profileRef.current?.querySelector('button')?.focus();}}document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[profileOpen]);
 useEffect(()=>{function refresh(){try{const employee=JSON.parse(localStorage.getItem('employee_data')||'{}');N([employee.first_name,employee.last_name].filter(Boolean).join(' ')||'ผู้ดูแลระบบ');A(employee.profile_photo_url||'');}catch{}}refresh();window.addEventListener('office-profile-updated',refresh);return()=>window.removeEventListener('office-profile-updated',refresh);},[path]);
 useEffect(()=>{S(false);Q('');O(false);},[path]);
 const current=path==='/admin/profile'?'ข้อมูลส่วนตัว':links.find(l=>l.href===path||path.startsWith(l.href+'/'))?.label||'ระบบหลังบ้าน';
 return <div data-admin-shell data-layout="vertical" className={`jp-shell ${compact?'jp-compact':''}`}>
 <aside className={`jp-sidebar ${open?'jp-sidebar-open':''}`} aria-label="แถบจัดการระบบ"><div className="jp-brand"><Link href="/admin" aria-label="Office Admin หน้าแรก"><span className="jp-brand-symbol"><Image src="/brand/logo-app-stec.png" alt="" width={38} height={38} priority/></span><span className="jp-brand-name">office<span>Admin workspace</span></span></Link><button className="jp-icon-button jp-desktop-toggle" onClick={()=>C(!compact)} aria-label={compact?'ขยายเมนู':'ย่อเมนู'}>{compact?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>}</button><button className="jp-icon-button jp-mobile-toggle" onClick={()=>S(false)} aria-label="ปิดเมนู"><X size={20}/></button></div>
 <nav className="jp-menu" aria-label="เมนูแอดมิน">{groups.map(group=><div className="jp-menu-group" key={group}><p className="jp-menu-heading">{group}</p>{links.filter(l=>l.group===group&&can(menuPermission[l.href])&&l.label.includes(query)).map(({href,label,icon:Icon})=><Link title={label} aria-label={label} aria-current={(path===href||path.startsWith(href+'/'))?'page':undefined} key={href} href={href} className={`jp-nav-link ${(path===href||path.startsWith(href+'/'))?'jp-active':''}`}><Icon size={20} strokeWidth={1.7}/><span>{label}</span>{(path===href||path.startsWith(href+'/'))&&<span className="jp-active-dot"/>}</Link>)}</div>)}{query&&!links.some(l=>l.label.includes(query))&&<p className="text-sm p-3 text-gray-500">ไม่พบเมนู</p>}</nav>
 <div className="jp-sidebar-footer"><Link className="jp-nav-link" title="ไปหน้าพนักงาน" aria-label="ไปหน้าพนักงาน" href="/"><ArrowUpRight size={20}/><span>ไปหน้าพนักงาน</span></Link><button className="jp-nav-link jp-logout" title="ออกจากระบบ" aria-label="ออกจากระบบ" onClick={()=>logout('/admin-login').catch(e=>toast.error(e.message))}><LogOut size={20}/><span>ออกจากระบบ</span></button></div></aside>
 {open&&<button className="jp-backdrop" aria-label="ปิดเมนูพื้นหลัง" onClick={()=>S(false)}/>}
 <div className="jp-workspace"><header className="jp-topbar"><button aria-label="เปิดเมนู" className="jp-icon-button jp-mobile-toggle" onClick={()=>S(true)}><Menu size={22}/></button><div className="jp-breadcrumb"><span>Workspace</span><ChevronRight size={14}/><b>{current}</b></div><div className="jp-topbar-right"><label className="jp-search"><Search size={17}/><input aria-label="ค้นหาเมนูแอดมิน" placeholder="ค้นหาเมนู…" value={query} onChange={e=>{Q(e.target.value);if(e.target.value)C(false);}}/></label><div ref={profileRef} className="relative"><button type="button" className="jp-user" aria-label="เมนูข้อมูลส่วนตัว" aria-haspopup="menu" aria-expanded={profileOpen} onClick={()=>O(!profileOpen)}><span className="jp-avatar">{avatar?<img src={avatar} alt="" className="h-full w-full rounded-full object-cover"/>:name.slice(0,1)}</span><div><b>{name}</b><span>{isSuperAdmin?'Super Admin':'Backoffice'}</span></div></button>{profileOpen&&<div role="menu" aria-label="เมนูบัญชี" className="absolute right-0 top-full z-[80] mt-4 w-72 overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 shadow-xl"><div className="mb-2 border-b border-gray-100 px-4 py-3"><b className="block text-sm">{name}</b><p className="mt-1 text-xs text-gray-400">ผู้ดูแลระบบ</p></div><Link role="menuitem" href="/admin/profile" onClick={()=>O(false)} className="block rounded-xl px-4 py-3 text-sm text-gray-700 hover:bg-teal-50">ข้อมูลส่วนตัวและรูปโปรไฟล์</Link><Link role="menuitem" href="/admin/profile#password" onClick={()=>{O(false);if(path==='/admin/profile')document.getElementById('password')?.scrollIntoView({behavior:'smooth'});}} className="block rounded-xl px-4 py-3 text-sm text-gray-700 hover:bg-teal-50">เปลี่ยนรหัสผ่าน</Link><div className="mt-2 border-t border-gray-100 pt-2"><button type="button" role="menuitem" className="w-full rounded-xl px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50" onClick={()=>logout('/admin-login').catch(e=>toast.error(e.message))}>ออกจากระบบ</button></div></div>}</div></div></header>
 <main className="jp-main">{children}<footer className="jp-page-footer"><span>Office System</span><span>ระบบจัดการบุคลากรและการทำงาน</span></footer></main></div></div>;
}
