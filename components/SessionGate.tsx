"use client";
import {PermissionsContext} from '@/components/Permissions';
import {canAccessBackoffice,menuPermission,hasPermission} from '@/lib/permissions/catalog';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';
import AppLaunchLoading from '@/components/AppLaunchLoading';
import {markAppOpened} from '@/lib/loadingLifecycle';
import {MonitorSmartphone} from 'lucide-react';

let initialSessionResolved = false;
export default function SessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const publicPage = ['/login', '/admin-login', '/register', '/pending'].includes(pathname);
  const [access,setAccess]=useState({permissions:[] as string[],isSuperAdmin:false});
  const [desktop,setDesktop]=useState(false);
  const [sessionReady, setSessionReady] = useState(initialSessionResolved); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => { if (publicPage) markAppOpened(); }, [publicPage]);
  useEffect(()=>{const query=window.matchMedia('(min-width: 1024px)');const sync=()=>setDesktop(query.matches);sync();query.addEventListener('change',sync);return()=>query.removeEventListener('change',sync);},[]);
  useEffect(() => {
    if (publicPage) return;
    let active = true;
    async function validate() {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' }); const data = await response.json();
        if (!active) return;
        if (response.status === 401) { localStorage.removeItem('employee_data'); localStorage.removeItem('line_profile'); router.replace('/login'); return; }
        if (!response.ok) throw new Error(data.error || 'ตรวจสอบ session ไม่สำเร็จ');
        setAccess({permissions:data.permissions||[],isSuperAdmin:!!data.isSuperAdmin});
        localStorage.setItem('employee_data', JSON.stringify(data.employee)); localStorage.setItem('line_profile', JSON.stringify(data.profile));
        if (document.visibilityState === 'visible') void fetch('/api/presence', { method: 'POST' });
        initialSessionResolved = true; markAppOpened(); setError(''); setSessionReady(true);
      } catch (error) { if (active && !initialSessionResolved) setError(error instanceof Error ? error.message : 'เชื่อมต่อระบบไม่ได้'); }
    }
    void validate(); const interval = setInterval(validate, 60000); window.addEventListener('focus', validate);
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', validate); };
  }, [publicPage, router, retry]);
  useEffect(() => {
    if (publicPage || !sessionReady || !(pathname.startsWith('/admin/') || pathname === '/admin')) return;
    if (!canAccessBackoffice(access.permissions)) { router.replace('/'); return; }
    const key = menuPermission[pathname];
    if (key && !hasPermission(access.permissions, key)) router.replace('/admin');
  }, [access.permissions, pathname, publicPage, router, sessionReady]);
  useEffect(()=>{if(!publicPage&&sessionReady&&desktop&&canAccessBackoffice(access.permissions)&&!(pathname.startsWith('/admin/')||pathname==='/admin'))router.replace('/admin');},[access.permissions,desktop,pathname,publicPage,router,sessionReady]);
  if (publicPage) return children;
  const adminDenied = sessionReady && (pathname.startsWith('/admin/') || pathname === '/admin') && (!canAccessBackoffice(access.permissions) || !!(menuPermission[pathname] && !hasPermission(access.permissions, menuPermission[pathname])));
  const desktopAdminRedirect=sessionReady&&desktop&&canAccessBackoffice(access.permissions)&&!(pathname.startsWith('/admin/')||pathname==='/admin');
  if (error || !sessionReady) return error?<div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"><p role="alert">{error}</p><button className="rounded-xl bg-blue-600 px-6 py-3 text-white" onClick={() => { setError(''); setRetry(retry + 1); }}>ลองอีกครั้ง</button></div>:<AppLaunchLoading/>;
  if(desktopAdminRedirect)return <LoadingScreen text="กำลังเข้าสู่ระบบ Admin…"/>;
  if (adminDenied) return <LoadingScreen text="กำลังกลับไปหน้าที่อนุญาต…"/>;
  if(desktop&&pathname==='/check-in')return <div className="flex h-full items-center justify-center bg-[linear-gradient(145deg,#f8f5fc,#eef6ff_55%,#ecfdf5)] p-8"><section className="max-w-md rounded-[28px] border border-blue-100 bg-white p-8 text-center shadow-xl shadow-blue-900/10"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><MonitorSmartphone size={31}/></span><h1 className="mt-5 text-2xl font-bold">ไม่สามารถลงเวลาบนคอมพิวเตอร์ได้</h1><p className="mt-3 leading-relaxed text-slate-500">โปรดเปิด Office System บนโทรศัพท์มือถือเพื่อเลือกสถานที่ ตรวจตำแหน่ง และลงเวลางาน</p><button type="button" onClick={()=>router.replace('/')} className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white">กลับหน้าแรก</button></section></div>;
  return <PermissionsContext.Provider value={access}>{children}</PermissionsContext.Provider>;
}
