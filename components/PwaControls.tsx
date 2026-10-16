"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {Smartphone,Share,Download} from 'lucide-react';
import {enableMobileNotifications} from '@/lib/push/client';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export default function PwaControls() {
  const pathname = usePathname();
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [push, setPush] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'development') {
      void (async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const ownWorker = (url?: string) => !!url && new URL(url).origin === location.origin && new URL(url).pathname === '/sw.js';
        const controlled = ownWorker(navigator.serviceWorker.controller?.scriptURL);
        await Promise.all(registrations.filter(r => ownWorker(r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL)).map(r => r.unregister()));
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.filter(key => key.startsWith('office-shell-')).map(key => caches.delete(key)));
        }
        if (controlled) location.reload();
      })().catch(() => {});
    }
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => toast.error('เตรียมแอปออฟไลน์ไม่สำเร็จ'));
    }
    const standalone = matchMedia('(display-mode: standalone)').matches;
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) && !standalone);
    setPush('PushManager' in window && 'Notification' in window && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.NEXT_PUBLIC_PUSH_SUBSCRIBE_URL);
    const onInstall = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const installed = () => { setInstall(null); setIos(false); };
    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('beforeinstallprompt', onInstall); window.removeEventListener('appinstalled', installed); };
  }, []);
  async function enablePush() {
    setBusy(true);
    try {
      await enableMobileNotifications();
      setPush(false); toast.success('เปิดการแจ้งเตือนแล้ว');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'เปิดการแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setBusy(false); }
  }
  if (pathname !== '/' && pathname !== '/notifications') return null;
  if (!ios && !install && !push) return null;
  return <aside className="pwa-controls" aria-label="ติดตั้งแอปและการแจ้งเตือน">
    {install && <button className="gap-2" onClick={async () => { await install.prompt(); await install.userChoice; setInstall(null); }}><Download size={18}/>ติดตั้งแอป Office</button>}
    {ios && <details><summary><span className="pwa-install-icon"><Smartphone size={21}/></span>เพิ่ม Office บนหน้าจอ iPhone</summary><p>เปิดด้วย Safari แล้วแตะ <Share size={15} className="inline-block mx-1"/> แชร์<br/>เลือก “เพิ่มไปยังหน้าจอโฮม” แล้วแตะ “เพิ่ม”</p></details>}
    {push && <button disabled={busy} onClick={enablePush}>{busy ? 'กำลังเปิด…' : 'เปิดการแจ้งเตือน'}</button>}
  </aside>;
}
