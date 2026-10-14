import { NextRequest, NextResponse } from 'next/server';
import { AuthError, checkOrigin, database, failure, issueSession, settings } from '@/lib/auth/server';
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    if (!(await settings()).line_login_enabled) throw new AuthError('ปิดการลงชื่อผ่าน LINE แล้ว', 403);
    const { accessToken, deviceToken } = await request.json();
    if (typeof accessToken !== 'string' || accessToken.length > 4096 || typeof deviceToken !== 'string') throw new AuthError('ข้อมูล LINE ไม่ถูกต้อง');
    const channel = process.env.LINE_LOGIN_CHANNEL_ID;
    if (!channel) throw new AuthError('ยังไม่ได้ตั้ง LINE Login Channel ID', 503);
    const verify = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!verify.ok) throw new AuthError('session LINE หมดอายุ กรุณาลงชื่อใหม่', 401);
    const claims = await verify.json();
    if (claims.client_id !== channel || claims.expires_in <= 0) throw new AuthError('ข้อมูล LINE ไม่ถูกต้อง', 401);
    const profileResponse = await fetch('https://api.line.me/v2/profile', { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!profileResponse.ok) throw new AuthError('ตรวจสอบ LINE ไม่สำเร็จ', 401);
    const profile = await profileResponse.json();
    const db = database();
    const { data: identity, error: identityError } = await db.from('office_auth_identities').select('employee_id').eq('line_user_id', profile.userId).maybeSingle();
    if (identityError) throw identityError;
    if (!identity) {
      const { data: pending } = await db.from('employees').select('is_active').eq('line_user_id',profile.userId).maybeSingle();
      if (!pending) return NextResponse.json({ registrationRequired: true, profile });
      if (pending.is_active !== true) return NextResponse.json({ pending: true, profile });
      throw new AuthError('กรุณาให้แอดมินบันทึกข้อมูลพนักงานเพื่อยืนยันบัญชี LINE', 403);
    }
    const { data: employee, error } = await db.from('employees').select('*').eq('id', identity.employee_id).maybeSingle();
    if (error) throw error;
    if (!employee) return NextResponse.json({ registrationRequired: true, profile }, { headers: { 'Cache-Control': 'no-store' } });
    if (employee.is_active !== true) return NextResponse.json({ pending: true, profile });
    return await issueSession(request, employee, deviceToken, 'line');
  } catch (error) { return failure(error); }
}
