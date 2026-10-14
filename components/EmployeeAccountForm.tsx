"use client";
import { useEffect, useState } from 'react';
import PasswordInput from '@/components/ui/PasswordInput';
import { toast } from 'sonner';
export default function EmployeeAccountForm({ employeeId }: { employeeId: string }) {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [oldPassword,setOldPassword]=useState(''); const [confirmPassword,setConfirmPassword]=useState(''); const [hasPassword,setHasPassword]=useState(false);
  const [bound, setBound] = useState(false); const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let active = true;
    fetch('/api/admin/accounts', { cache: 'no-store' }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); if (!active) return;
      setHasPassword(data.accounts.some((account: { employee_id: string }) => account.employee_id === employeeId));
      setUsername(data.accounts.find((account: { employee_id: string }) => account.employee_id === employeeId)?.username || '');
      setBound(data.devices.some((device: { employee_id: string }) => device.employee_id === employeeId)); setReady(true);
    }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [employeeId]);
  async function save() {
    if ((!hasPassword || password) && (password.length < 8 || password.length > 128)) { toast.error('รหัสผ่านต้องมี 8–128 ตัวอักษร'); return; }
    if (password !== confirmPassword) { toast.error('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน'); return; }
    if (hasPassword && password && !oldPassword) { toast.error('กรุณากรอกรหัสผ่านเดิม'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/admin/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId, username, password, oldPassword, confirmPassword }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setPassword(''); setOldPassword(''); setConfirmPassword(''); setHasPassword(true); toast.success('บันทึกบัญชีแล้ว หากเปลี่ยนรหัสผ่านให้ผู้ใช้ลงชื่อใหม่');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  async function resetDevice() {
    if (!window.confirm('รีเซ็ตเครื่องและออกจากระบบทุก session ของผู้ใช้นี้?')) return;
    setBusy(true);
    try {
      const response = await fetch('/api/admin/accounts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setBound(false); toast.success('รีเซ็ตแล้ว ผู้ใช้สามารถลงชื่อเพื่อผูกเครื่องใหม่');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'รีเซ็ตไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  return <section className="md:col-span-2 space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
    <h3 className="font-bold text-gray-900">บัญชีเข้าใช้งาน</h3>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label className="block text-sm">ชื่อผู้ใช้<input disabled={!ready || busy} autoComplete="off" value={username} onChange={event => setUsername(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2" /></label>
    {hasPassword&&<label className="block text-sm">รหัสผ่านเดิม<PasswordInput disabled={!ready||busy} autoComplete="current-password" maxLength={128} value={oldPassword} onChange={e=>setOldPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2"/></label>}
    <label className="block text-sm">{hasPassword?'รหัสผ่านใหม่':'รหัสผ่าน'}<PasswordInput disabled={!ready||busy} autoComplete="new-password" maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2"/></label>
    <label className="block text-sm">ยืนยันรหัสผ่าน<PasswordInput disabled={!ready||busy} autoComplete="new-password" maxLength={128} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2"/></label>
    </div><p className="text-xs text-gray-500">รหัสผ่านอย่างน้อย 8 ตัว เว้นว่างเพื่อใช้รหัสเดิม บัญชีใหม่ต้องกำหนดรหัสผ่าน</p>
    <button type="button" disabled={!ready || busy} onClick={save} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">บันทึกบัญชีเข้าใช้งาน</button>
    <div className="flex items-center justify-between gap-3 border-t border-blue-100 pt-3"><span className="text-xs text-gray-600">{bound ? 'ผูกเครื่องแล้ว (1 เครื่อง)' : 'ยังไม่ได้ผูกเครื่อง'}</span><button type="button" disabled={!ready || busy || !bound} onClick={resetDevice} className="text-sm font-bold text-red-600 disabled:opacity-40">รีเซ็ตเครื่อง</button></div>
  </section>;
}
