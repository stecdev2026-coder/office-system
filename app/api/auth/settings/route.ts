import {requirePermission} from '@/lib/permissions/server';
import { NextRequest, NextResponse } from 'next/server';
import { AuthError, checkOrigin, database, failure, settings } from '@/lib/auth/server';
export async function GET() {
  try { return NextResponse.json(await settings(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return failure(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    checkOrigin(request); await requirePermission('settings.edit');
    const body = await request.json();
    if (typeof body.line_login_enabled !== 'boolean') throw new AuthError('ค่าการตั้งค่าไม่ถูกต้อง');
    const { data, error } = await database().rpc('office_set_line_login', { p_enabled: body.line_login_enabled });
    if (error) {
      if (error.message.includes('NO_PASSWORD_ADMIN')) throw new AuthError('ตั้ง username/password ให้แอดมินที่ใช้งานอยู่ก่อนปิด LINE', 409);
      throw error;
    }
    return NextResponse.json(data);
  } catch (error) { return failure(error); }
}
