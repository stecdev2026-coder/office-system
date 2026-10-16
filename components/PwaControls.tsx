"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {Smartphone,Share,Download,RefreshCw,Sparkles} from 'lucide-react';
import {enableMobileNotifications} from '@/lib/push/client';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export default function PwaControls({currentVersion}:{currentVersion:string}) {
  const pathname = usePathname();
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [push, setPush] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updateReady,setUpdateReady]=useState(false);
  const [updating,setUpdating]=useState(false);
  const [waitingWorker,setWaitingWorker]=useState<ServiceWorker|null>(null);
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
    let registration:ServiceWorkerRegistration|undefined,checking=false,reloading=false;
    const offerUpdate=(worker?:ServiceWorker|null)=>{if(worker)setWaitingWorker(worker);setUpdateReady(true);};
    const watchWorker=(worker:ServiceWorker|null)=>worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offerUpdate(worker);});
    const checkVersion=async()=>{if(checking||document.visibilityState==='hidden')return;checking=true;try{const response=await fetch(`/api/version?t=${Date.now()}`,{cache:'no-store'});if(response.ok){const data=await response.json();if(data.version&&data.version!==currentVersion)offerUpdate(registration?.waiting);}}catch{}finally{checking=false;}};
    const checkForUpdates=()=>{void registration?.update().catch(()=>{});void checkVersion();};
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(value=>{registration=value;if(value.waiting&&navigator.serviceWorker.controller)offerUpdate(value.waiting);value.addEventListener('updatefound',()=>watchWorker(value.installing));watchWorker(value.installing);void checkVersion();}).catch(() => toast.error('เตรียมแอปออฟไลน์ไม่สำเร็จ'));
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload();});
    }
    const standalone = matchMedia('(display-mode: standalone)').matches;
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) && !standalone);
    setPush('PushManager' in window && 'Notification' in window && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.NEXT_PUBLIC_PUSH_SUBSCRIBE_URL);
    const onInstall = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const installed = () => { setInstall(null); setIos(false); };
    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('appinstalled', installed);
    window.addEventListener('focus',checkForUpdates);document.addEventListener('visibilitychange',checkForUpdates);
    const interval=window.setInterval(checkForUpdates,60_000);
    return () => { window.removeEventListener('beforeinstallprompt', onInstall); window.removeEventListener('appinstalled', installed);window.removeEventListener('focus',checkForUpdates);document.removeEventListener('visibilitychange',checkForUpdates);window.clearInterval(interval); };
  }, [currentVersion]);
  async function enablePush() {
    setBusy(true);
    try {
      await enableMobileNotifications();
      setPush(false); toast.success('เปิดการแจ้งเตือนแล้ว');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'เปิดการแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง'); }
    finally { setBusy(false); }
  }
  function updateNow(){setUpdating(true);if(waitingWorker){waitingWorker.postMessage({type:'SKIP_WAITING'});window.setTimeout(()=>location.reload(),1800);}else location.reload();}
  const showControls=(pathname==='/'||pathname==='/notifications')&&(ios||install||push);
  if(!showControls&&!updateReady)return null;
  return <>{updateReady&&<aside className="pwa-update-banner" role="status" aria-live="polite"><span className="pwa-update-icon"><Sparkles size={20}/></span><span className="min-w-0 flex-1"><b className="block">มีเวอร์ชันใหม่พร้อมใช้งาน</b><small className="block">กดอัปเดตเพื่อรับข้อมูลและฟังก์ชันล่าสุด</small></span><button type="button" disabled={updating} onClick={updateNow}><RefreshCw size={17} className={updating?'animate-spin':''}/>{updating?'กำลังอัปเดต…':'อัปเดตตอนนี้'}</button></aside>}
  {showControls&&<aside className="pwa-controls" aria-label="ติดตั้งแอปและการแจ้งเตือน">
    {install && <button className="gap-2" onClick={async () => { await install.prompt(); await install.userChoice; setInstall(null); }}><Download size={18}/>ติดตั้งแอป Office</button>}
    {ios && <details><summary><span className="pwa-install-icon"><Smartphone size={21}/></span>เพิ่ม Office บนหน้าจอ iPhone</summary><p>เปิดด้วย Safari แล้วแตะ <Share size={15} className="inline-block mx-1"/> แชร์<br/>เลือก “เพิ่มไปยังหน้าจอโฮม” แล้วแตะ “เพิ่ม”</p></details>}
    {push && <button disabled={busy} onClick={enablePush}>{busy ? 'กำลังเปิด…' : 'เปิดการแจ้งเตือน'}</button>}
  </aside>}</>;
}
