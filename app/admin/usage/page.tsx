import {requirePermission} from '@/lib/permissions/server';
import ProviderUsagePanel from '@/components/ProviderUsagePanel';
export default async function Usage(){await requirePermission('usage.view');return <div className="space-y-6"><h1 className="text-2xl font-bold">การใช้งานระบบและบริการ</h1><ProviderUsagePanel/></div>;}
