"use client";
import {usePathname} from 'next/navigation';
export default function AppContainer({children}:{children:React.ReactNode}){const path=usePathname();const admin=path==='/admin'||path.startsWith('/admin/');return <div className="mobile-app-container" data-admin-route={admin?'true':undefined}>{children}</div>;}
