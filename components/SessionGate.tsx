"use client";
import {PermissionsContext} from '@/components/Permissions';
import {canAccessBackoffice,menuPermission,hasPermission} from '@/lib/permissions/catalog';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';
import AppLaunchLoading from '@/components/AppLaunchLoading';
import {markAppOpened} from '@/lib/loadingLifecycle';

let initialSessionResolved = false;
export default function SessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const publicPage = ['/login', '/admin-login', '/register', '/pending'].includes(pathname);
  const [access,setAccess]=useState({permissions:[] as string[],isSuperAdmin:false});
  const [checkedPath, setCheckedPath] = useState(''); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => { if (publicPage) markAppOpened(); }, [publicPage]);
  useEffect(() => {
    if (publicPage) return;
    let active = true;
    async function validate() {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' }); const data = await response.json();
        if (!active) return;
        if (response.status === 401) { localStorage.removeItem('employee_data'); localStorage.removeItem('line_profile'); router.replace('/login'); return; }
        if (!response.ok) throw new Error(data.error || 'ตรวจสอบ session ไม่สำเร็จ');
        if (pathname.startsWith('/admin/') || pathname==='/admin') { if (!canAccessBackoffice(data.permissions||[])) {router.replace('/');return;} const key=menuPermission[pathname];if(key&&!hasPermission(data.permissions||[],key)){router.replace('/admin');return;} }
        setAccess({permissions:data.permissions||[],isSuperAdmin:!!data.isSuperAdmin});
        localStorage.setItem('employee_data', JSON.stringify(data.employee)); localStorage.setItem('line_profile', JSON.stringify(data.profile));
        if (document.visibilityState === 'visible') void fetch('/api/presence', { method: 'POST' });
        initialSessionResolved = true; markAppOpened(); setError(''); setCheckedPath(pathname);
      } catch (error) { if (active) setError(error instanceof Error ? error.message : 'เชื่อมต่อระบบไม่ได้'); }
    }
    void validate(); const interval = setInterval(validate, 60000); window.addEventListener('focus', validate);
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', validate); };
  }, [pathname, publicPage, router, retry]);
  if (publicPage) return children;
  if (error || checkedPath !== pathname) return error?<div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"><p role="alert">{error}</p><button className="rounded-xl bg-blue-600 px-6 py-3 text-white" onClick={() => { setError(''); setRetry(retry + 1); }}>ลองอีกครั้ง</button></div>:initialSessionResolved?<LoadingScreen text="กำลังโหลดหน้า…"/>:<AppLaunchLoading/>;
  return <PermissionsContext.Provider value={access}>{children}</PermissionsContext.Provider>;
}
