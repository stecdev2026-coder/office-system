import { NextRequest } from 'next/server';
import { AuthError, checkOrigin, database, failure, issueSession } from '@/lib/auth/server';
import { tokenHash, verifyPassword } from '@/lib/auth/crypto';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const { username, password, deviceToken } = await request.json();
    if (typeof username !== 'string' || typeof password !== 'string' || typeof deviceToken !== 'string' || username.length > 64 || password.length > 256) throw new AuthError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
    const db = database();
    const normalized = username.trim().toLowerCase();
    // Database-backed throttling works across workers and restarts.
    const { data: permitted, error: throttleError } = await db.rpc('office_login_attempt', { p_key: tokenHash(normalized) });
    if (throttleError) throw new AuthError('ระบบลงชื่อเข้าใช้ยังไม่พร้อม', 503);
    if (!permitted) throw new AuthError('ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาที', 429);
    const { data: account, error } = await db.from('office_credentials').select('*').eq('username', normalized).maybeSingle();
    if (error) throw new AuthError('ระบบบัญชียังไม่พร้อม', 503);
    const dummy = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const valid = await verifyPassword(password, account?.password_hash || dummy);
    if (!account || !valid) throw new AuthError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
    const { data: employee } = await db.from('employees').select('*').eq('id', account.employee_id).maybeSingle();
    if (!employee) throw new AuthError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
    const response = await issueSession(request, employee, deviceToken, 'password');
    await db.from('office_login_attempts').delete().eq('key', tokenHash(normalized));
    return response;
  } catch (error) { return failure(error); }
}
