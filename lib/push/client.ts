"use client";

export async function enableMobileNotifications() {
  if (!("Notification" in window)) throw new Error("อุปกรณ์นี้ไม่รองรับการแจ้งเตือน");
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("ยังไม่ได้อนุญาตการแจ้งเตือน");

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const subscribeUrl = process.env.NEXT_PUBLIC_PUSH_SUBSCRIBE_URL;
  if (!("serviceWorker" in navigator) || !publicKey || !subscribeUrl) return "permission" as const;

  const registration = await navigator.serviceWorker.ready;
  const bytes = Uint8Array.from(
    atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
    character => character.charCodeAt(0),
  );
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: bytes,
  });
  const response = await fetch(subscribeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(subscription),
  });
  if (!response.ok) {
    if (!existing) await subscription.unsubscribe();
    throw new Error("เปิดการแจ้งเตือนไม่สำเร็จ");
  }
  return "subscribed" as const;
}
