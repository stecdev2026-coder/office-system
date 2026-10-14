"use client";
import {usePermissions} from "@/components/Permissions";
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
export default function AdminAuthSettings() {
  const {can}=usePermissions();
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/auth/settings', { cache: 'no-store' }).then(async response => {
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    setEnabled(data.line_login_enabled); setReady(true);
  }).catch(error => setError(error.message)); }, []);
  async function save() {
    setBusy(true);
    try {
      const response = await fetch('/api/auth/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ line_login_enabled: enabled }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      toast.success('บันทึกวิธีเข้าสู่ระบบแล้ว');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'); }
    finally { setBusy(false); }
  }
  return <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
    <h2 className="mb-2 font-bold text-gray-900">วิธีเข้าสู่ระบบ</h2>
    <p className="mb-5 text-sm text-gray-500">ชื่อผู้ใช้และรหัสผ่านเปิดใช้งานเสมอ บัญชีผูกได้ 1 เครื่อง</p>
    {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
    <label className="flex items-center justify-between gap-4"><span className="text-sm font-medium">อนุญาตให้ลงชื่อผ่าน LINE</span><input type="checkbox" role="switch" checked={enabled} disabled={!ready || busy || !can("settings.edit")} onChange={event => setEnabled(event.target.checked)} className="h-6 w-6 accent-green-600" /></label>
    <p className="my-4 text-xs leading-relaxed text-gray-500">ก่อนปิด LINE ให้ตั้งชื่อผู้ใช้และรหัสผ่านสำหรับแอดมินก่อน การปิดจะยกเลิก session ที่ลงชื่อผ่าน LINE</p>
    <button hidden={!can("settings.edit")} disabled={!ready || busy} onClick={save} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'กำลังบันทึก…' : 'บันทึกวิธีเข้าสู่ระบบ'}</button>
  </section>;
}
