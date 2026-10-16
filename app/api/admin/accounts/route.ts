import {requirePermission,rejectSuperTarget,rejectHigherPermissionTarget} from '@/lib/permissions/server';
import { NextRequest, NextResponse } from 'next/server';
import { AuthError, checkOrigin, database, failure } from '@/lib/auth/server';
import { hashPassword, verifyPassword } from '@/lib/auth/crypto';
export async function GET() {
  try {
    await requirePermission('users.accounts');
    const db = database();
    const [accounts, devices] = await Promise.all([
      db.from('office_credentials').select('employee_id,username'),
      db.from('office_devices').select('employee_id,bound_at,last_seen_at,device_type,device_name,platform,browser'),
    ]);
    if (accounts.error || devices.error) throw new AuthError('โหลดข้อมูลบัญชีไม่สำเร็จ', 503);
    return NextResponse.json({ accounts: accounts.data, devices: devices.data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request); const admin = await requirePermission('users.accounts');
    const { employeeId, username, password, oldPassword, confirmPassword } = await request.json();
    if (typeof employeeId !== 'string' || typeof username !== 'string' || typeof password !== 'string') throw new AuthError('ข้อมูลบัญชีไม่ถูกต้อง');
    await rejectSuperTarget(employeeId);
    await rejectHigherPermissionTarget(admin,employeeId);
    const normalized = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,64}$/.test(normalized)) throw new AuthError('ชื่อผู้ใช้ต้องมี 3–64 ตัว ใช้ a-z, 0-9, จุด, ขีด หรือขีดล่าง');
    const db = database();
    const { data: existing, error: readError } = await db.from('office_credentials').select('username,password_hash').eq('employee_id', employeeId).maybeSingle();
    if (readError) throw new AuthError('อ่านข้อมูลบัญชีไม่สำเร็จ', 503);
    if ((!existing && password.length < 8) || (password && (password.length < 8 || password.length > 128))) throw new AuthError('รหัสผ่านต้องมี 8–128 ตัวอักษร');
    if (password) {
      if (typeof confirmPassword !== 'string' || password !== confirmPassword) throw new AuthError('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
      if (existing) {
        if (typeof oldPassword !== 'string' || !oldPassword || oldPassword.length > 128) throw new AuthError('กรุณากรอกรหัสผ่านเดิม');
        const attempt = await db.rpc('office_login_attempt', { p_key: `password-change:${admin.employee.id}:${employeeId}` });
        if (attempt.error) throw new AuthError('ตรวจสอบการเปลี่ยนรหัสผ่านไม่สำเร็จ', 503);
        if (!attempt.data) throw new AuthError('ลองเปลี่ยนรหัสผ่านหลายครั้ง กรุณารอ 15 นาที', 429);
        if (!(await verifyPassword(oldPassword, existing.password_hash))) throw new AuthError('รหัสผ่านเดิมไม่ถูกต้อง', 403);
      }
    }
    const { error } = await db.rpc('office_set_credentials', { p_employee_id: employeeId, p_username: normalized, p_password_hash: password ? await hashPassword(password) : null });
    if (error?.code === '23505') throw new AuthError('ชื่อผู้ใช้นี้ถูกใช้แล้ว', 409);
    if (error) throw new AuthError('บันทึกบัญชีไม่สำเร็จ', 503);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: NextRequest) {
  try {
    checkOrigin(request); const admin = await requirePermission('users.accounts');
    const { employeeId } = await request.json();
    if (typeof employeeId !== 'string') throw new AuthError('ข้อมูลไม่ถูกต้อง');
    await rejectSuperTarget(employeeId);
    await rejectHigherPermissionTarget(admin,employeeId);
    if (employeeId === String(admin.employee.id)) throw new AuthError('ไม่สามารถรีเซ็ตเครื่องของตัวเองขณะใช้งานได้');
    const { error } = await database().rpc('office_reset_device', { p_employee_id: employeeId });
    if (error) throw new AuthError('รีเซ็ตเครื่องไม่สำเร็จ', 503);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
export async function PUT(request: NextRequest) {
  try {
    checkOrigin(request); const admin=await requirePermission('users.edit');
    const { employeeId } = await request.json();
    if (typeof employeeId !== 'string') throw new AuthError('ข้อมูลไม่ถูกต้อง');
    const db = database();
    await rejectSuperTarget(employeeId);
    await rejectHigherPermissionTarget(admin,employeeId);
    const { data: employee, error: readError } = await db.from('employees').select('id,line_user_id,email').eq('id',employeeId).single();
    if (readError || !employee) throw new AuthError('ไม่พบพนักงาน');
    const { error } = await db.from('office_auth_identities').upsert({ employee_id: employeeId, line_user_id: employee.line_user_id || null, email: employee.email?.trim().toLowerCase() || null });
    if (error?.code === '23505') throw new AuthError('LINE หรืออีเมลนี้ถูกผูกกับผู้ใช้อื่นแล้ว',409);
    if (error) throw new AuthError('บันทึกการผูกบัญชีไม่สำเร็จ',503);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
