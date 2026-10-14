import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { permissionsFor } from '@/lib/permissions/server';
import { newToken, tokenHash } from './crypto';

export class AuthError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AuthError('ยังไม่ได้ตั้งค่าระบบลงชื่อเข้าใช้ฝั่งเซิร์ฟเวอร์', 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function checkOrigin(request: NextRequest) {
  const expected = process.env.APP_URL || request.nextUrl.origin;
  if (request.headers.get('origin') !== new URL(expected).origin) throw new AuthError('คำขอไม่ถูกต้อง', 403);
}
export async function settings() {
  const { data, error } = await database().from('office_auth_settings').select('line_login_enabled').eq('id', 1).single();
  if (error) throw new AuthError('ยังไม่ได้ติดตั้งตารางระบบลงชื่อเข้าใช้', 503);
  return data;
}
export function publicEmployee(employee: Record<string, unknown>) {
  const { device_token: _device, ...safe } = employee;
  return safe;
}
export async function currentSession() {
  const token = (await cookies()).get('office_session')?.value;
  if (!token) throw new AuthError('กรุณาเข้าสู่ระบบ', 401);
  const db = database();
  const { data: session, error } = await db.from('office_sessions').select('*').eq('token_hash', tokenHash(token)).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error) throw new AuthError('ตรวจสอบ session ไม่สำเร็จ', 503);
  if (!session) throw new AuthError('session หมดอายุ กรุณาเข้าสู่ระบบใหม่', 401);
  const { data: employee } = await db.from('employees').select('*').eq('id', session.employee_id).maybeSingle();
  const { data: device } = await db.from('office_devices').select('device_hash').eq('employee_id', session.employee_id).maybeSingle();
  const { data: admin, error: adminError } = await db.from('office_auth_admins').select('employee_id').eq('employee_id', session.employee_id).maybeSingle();
  if (adminError) throw new AuthError('ตรวจสอบสิทธิ์ไม่สำเร็จ', 503);
  const trustedAdmin = !!admin && employee?.role === 'Admin';
  if (!employee || employee.is_active !== true || (!trustedAdmin && device?.device_hash !== session.device_hash)) throw new AuthError('บัญชีหรือเครื่องนี้ไม่ได้รับอนุญาต', 401);
  if (session.auth_method === 'line' && !(await settings()).line_login_enabled) throw new AuthError('ปิดการลงชื่อผ่าน LINE แล้ว', 401);
  return { employee, session };
}
export async function requireAdmin() {
  const auth = await currentSession();
  const { data, error } = await database().from('office_auth_admins').select('employee_id').eq('employee_id', String(auth.employee.id)).maybeSingle();
  if (error || !data || auth.employee.role !== 'Admin') throw new AuthError('เฉพาะผู้ดูแลระบบที่ได้รับอนุญาตเท่านั้น', 403);
  return auth;
}
export async function issueSession(request: NextRequest, employee: Record<string, unknown>, deviceToken: string, method: 'password' | 'line' | 'email') {
  if (!/^[a-zA-Z0-9_-]{32,128}$/.test(deviceToken)) throw new AuthError('รหัสเครื่องไม่ถูกต้อง');
  if (employee.is_active !== true) throw new AuthError('บัญชีนี้ยังไม่ได้รับการอนุมัติ', 403);
  const token = newToken();
  const { error } = await database().rpc('office_issue_session', { p_employee_id: String(employee.id), p_device_hash: tokenHash(deviceToken), p_token_hash: tokenHash(token), p_method: method });
  if (error) {
    if (error.message.includes('DEVICE_MISMATCH')) throw new AuthError('บัญชีนี้ผูกกับเครื่องอื่นแล้ว กรุณาให้แอดมินรีเซ็ตเครื่อง', 403);
    if (error.message.includes('LINE_DISABLED')) throw new AuthError('ปิดการลงชื่อผ่าน LINE แล้ว', 403);
    throw new AuthError('บันทึก session ไม่สำเร็จ', 503);
  }
  const access = await permissionsFor(String(employee.id));
  const response = NextResponse.json({ ...access, employee: {...publicEmployee(employee),is_super_admin:access.isSuperAdmin}, profile: { userId: employee.line_user_id || `employee_${employee.id}`, displayName: `${employee.first_name || ''} ${employee.last_name || ''}`.trim(), pictureUrl: employee.profile_photo_url || '' } });
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set('office_session', token, { httpOnly: true, sameSite: 'lax', secure: new URL(process.env.APP_URL || request.url).protocol === 'https:', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return response;
}
export function failure(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ error: 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
}
