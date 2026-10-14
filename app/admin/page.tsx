import {redirect} from 'next/navigation';
import {requireBackoffice} from '@/lib/permissions/server';
import {menuPermission,hasPermission} from '@/lib/permissions/catalog';
export default async function Page(){const access=await requireBackoffice();redirect(Object.entries(menuPermission).find(([,key])=>hasPermission(access.permissions,key))?.[0]||'/admin/profile');}
