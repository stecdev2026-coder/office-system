import "react-datepicker/dist/react-datepicker.css";
import './jampack.css';
import {redirect} from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import {AuthError} from '@/lib/auth/server';
import {requireBackoffice} from '@/lib/permissions/server';
export default async function Layout({children}:{children:React.ReactNode}){try{await requireBackoffice();}catch(e){if(e instanceof AuthError&&e.status===401)redirect('/admin-login');if(e instanceof AuthError&&e.status===403)redirect('/');throw e;}return <AdminShell>{children}</AdminShell>;}
