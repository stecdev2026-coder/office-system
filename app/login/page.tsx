"use client";
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, MessageCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import { deviceTokenFor, saveLogin } from '@/lib/auth/client';
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false); const [busy, setBusy] = useState(false);
  const [lineEnabled, setLineEnabled] = useState(false); const [setupError, setSetupError] = useState('');
  const [mode, setMode] = useState<'password' | 'email'>('password');
  const [email, setEmail] = useState(''); const [otp, setOtp] = useState(''); const [otpSent, setOtpSent] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/auth/session', { cache: 'no-store' }).then(async response => {
      if (response.ok && active) { const data = await response.json(); localStorage.setItem('employee_data', JSON.stringify(data.employee)); localStorage.setItem('line_profile', JSON.stringify(data.profile)); router.replace('/'); }
    }).catch(() => {});
    fetch('/api/auth/settings', { cache: 'no-store' }).then(async response => {
      const data = await response.json(); if (!active) return;
      if (!response.ok) { setSetupError(data.error); return; }
      setLineEnabled(data.line_login_enabled);
      if (data.line_login_enabled && new URLSearchParams(location.search).get('line') === '1') void loginLine();
    }).catch(() => { if (active) setSetupError('เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่'); });
    return () => { active = false; };
  }, [router]);
  async function finish(endpoint: string, body: Record<string, string>, identity: string) {
    const deviceToken = deviceTokenFor(identity);
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, deviceToken }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    if (data.registrationRequired) { localStorage.setItem('temp_line_profile', JSON.stringify(data.profile)); router.replace('/register'); return; }
    if (data.pending) { localStorage.setItem('line_profile', JSON.stringify(data.profile)); router.replace('/pending'); return; }
    saveLogin(data, deviceToken, identity); toast.success('เข้าสู่ระบบสำเร็จ'); router.replace('/');
  }
  async function submitPassword(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true);
    try { await finish('/api/auth/login', { username, password }, username.trim().toLowerCase()); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'เข้าสู่ระบบไม่สำเร็จ'); }
    finally { setPassword(''); setBusy(false); }
  }
  async function loginLine() {
    setBusy(true);
    try {
      const id = process.env.NEXT_PUBLIC_LIFF_ID; if (!id) throw new Error('ยังไม่ได้ตั้งค่า LIFF ID');
      const liff = (await import('@line/liff')).default; await liff.init({ liffId: id });
      if (!liff.isLoggedIn()) { liff.login({ redirectUri: `${location.origin}/login?line=1` }); return; }
      const profile = await liff.getProfile(); const accessToken = liff.getAccessToken();
      if (!accessToken) throw new Error('กรุณาเข้าสู่ LINE ใหม่');
      await finish('/api/auth/line', { accessToken }, profile.userId);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'เข้าสู่ LINE ไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  async function submitEmail(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); const supabase = createClient();
    try {
      if (!otpSent) {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        if (error) throw new Error('ส่ง OTP ไม่สำเร็จ กรุณาตรวจสอบอีเมล');
        setOtpSent(true); toast.success('ส่ง OTP ไปยังอีเมลแล้ว');
      } else {
        const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
        if (error || !data.session) throw new Error('OTP ไม่ถูกต้องหรือหมดอายุ');
        try { await finish('/api/auth/email', { accessToken: data.session.access_token }, email.toLowerCase()); }
        finally { await supabase.auth.signOut(); }
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'เข้าสู่ระบบไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  const input = 'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-blue-500';
  return <div data-login-page className="app-page overflow-y-auto!">
    <div className="relative shrink-0 overflow-hidden">
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 w-[150%] -translate-x-1/2 rounded-b-[50%] bg-cover bg-center md:w-[120%]" style={{ backgroundImage: "url('/img/login-bg.jpg')" }}>
      <div className="absolute inset-0 rounded-b-[50%] bg-white/30" />
    </div>
    <div className="relative z-10 flex flex-1 flex-col items-center px-6 pt-10 pb-6">
      <Image src="/brand/logo-app-stec.png" alt="STEC" width={96} height={96} priority className="mb-5 h-24 w-24 shrink-0 rounded-3xl object-cover shadow-lg" />
      <h1 className="text-2xl font-bold text-gray-900">OFFICE SYSTEM</h1><p className="mt-2 text-center text-sm text-gray-500">ลงชื่อเข้าใช้เพื่อเริ่มงานของคุณ</p>
    </div>
    </div>
    <div className="relative z-10 flex flex-col items-center px-6 pt-6 pb-10">
      <div className="w-full max-w-sm space-y-4">
        {setupError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{setupError}</p>}
        {mode === 'password' ? <form onSubmit={submitPassword} className="space-y-4">
          <div><label htmlFor="username" className="mb-2 block text-sm font-bold">ชื่อผู้ใช้</label><input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={64} value={username} onChange={event => setUsername(event.target.value)} className={input} /></div>
          <div><label htmlFor="password" className="mb-2 block text-sm font-bold">รหัสผ่าน</label><div className="relative"><input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)} className={`${input} pr-14`} /><button type="button" aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} onClick={() => setVisible(!visible)} className="absolute inset-y-0 right-1 w-12 flex items-center justify-center text-gray-500">{visible ? <EyeOff size={20} /> : <Eye size={20} />}</button></div></div>
          <p className="text-xs leading-relaxed text-gray-500">พนักงานใช้ได้ 1 เครื่อง หากเปลี่ยนเครื่องให้ติดต่อส่วนกลาง</p>
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white disabled:opacity-50">{busy && <Loader2 className="animate-spin" size={20} />}เข้าสู่ระบบ</button>
        </form> : <form onSubmit={submitEmail} className="space-y-4">
          <label htmlFor="email" className="block text-sm font-bold">อีเมลสำรอง</label><input id="email" type="email" required autoComplete="email" disabled={otpSent} value={email} onChange={event => setEmail(event.target.value)} className={input} />
          {otpSent && <><label htmlFor="otp" className="block text-sm font-bold">รหัส OTP</label><input id="otp" autoComplete="one-time-code" inputMode="numeric" required pattern="[0-9]{6,8}" maxLength={8} value={otp} onChange={event => setOtp(event.target.value)} className={input} /></>}
          <button disabled={busy} className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white disabled:opacity-50">{busy ? 'กำลังดำเนินการ…' : otpSent ? 'ยืนยันและเข้าสู่ระบบ' : 'ส่ง OTP'}</button>
          {otpSent && <button type="button" disabled={busy} onClick={() => { setOtpSent(false); setOtp(''); }} className="w-full py-2 text-sm text-gray-500">เปลี่ยนอีเมล</button>}
        </form>}
        {lineEnabled && <button onClick={loginLine} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#06c755] py-4 font-bold text-white disabled:opacity-50"><MessageCircle size={22} />เข้าสู่ระบบด้วย LINE</button>}
        <button disabled={busy} onClick={() => { setMode(mode === 'password' ? 'email' : 'password'); setOtp(''); }} className="w-full py-3 text-sm font-medium text-gray-600">{mode === 'password' ? 'เข้าสู่ระบบด้วยอีเมลสำรอง' : 'กลับไปใช้ชื่อผู้ใช้และรหัสผ่าน'}</button>
      </div><p className="mt-8 text-center text-xs text-gray-400">ต้องการบัญชีหรือเปลี่ยนเครื่อง ติดต่อผู้ดูแลระบบ</p>
    </div>
  </div>;
}
