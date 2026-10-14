import {permissionsFor} from '@/lib/permissions/server';
import { NextResponse } from 'next/server';
import { currentSession, failure, publicEmployee } from '@/lib/auth/server';
export async function GET() {
  try {
    const { employee } = await currentSession();
    const access=await permissionsFor(String(employee.id));
    return NextResponse.json({ ...access, employee: {...publicEmployee(employee),is_super_admin:access.isSuperAdmin}, profile: { userId: employee.line_user_id || `employee_${employee.id}`, displayName: `${employee.first_name || ''} ${employee.last_name || ''}`.trim(), pictureUrl: employee.profile_photo_url || '' } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
