import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { AuthError, checkOrigin, database, failure, issueSession } from '@/lib/auth/server';
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const { accessToken, deviceToken } = await request.json();
    if (typeof accessToken !== 'string' || typeof deviceToken !== 'string') throw new AuthError('ข้อมูลไม่ถูกต้อง');
    const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, { auth: { persistSession: false } });
    const { data, error } = await auth.auth.getUser(accessToken);
    if (error || !data.user?.email || !data.user.email_confirmed_at) throw new AuthError('กรุณายืนยันอีเมล', 401);
    const db = database();
    const { data: identity } = await db.from('office_auth_identities').select('employee_id').eq('email', data.user.email.toLowerCase()).maybeSingle();
    if (!identity) throw new AuthError('อีเมลนี้ยังไม่ได้รับการยืนยันโดยแอดมิน', 401);
    const { data: employee } = await db.from('employees').select('*').eq('id', identity.employee_id).maybeSingle();
    if (!employee) throw new AuthError('ไม่พบบัญชีพนักงาน', 401);
    // Email OTP no longer silently transfers the device binding.
    return await issueSession(request, employee, deviceToken, 'email');
  } catch (error) { return failure(error); }
}
