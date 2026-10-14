import {requirePermission} from '@/lib/permissions/server';
import {NextResponse} from 'next/server';
import {database,failure} from '@/lib/auth/server';
import {providerUsage} from '@/lib/usage/providers';
export async function GET(){try{await requirePermission('usage.view');const [providers,resource]=await Promise.all([providerUsage(),database().rpc('office_resource_usage')]);return NextResponse.json({...providers,resource:resource.error?{status:'error',message:'อ่านขนาดฐานข้อมูลและไฟล์จาก Supabase ไม่สำเร็จ'}:{status:'ready',data:resource.data}},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
