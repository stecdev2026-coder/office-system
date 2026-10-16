"use client";

import LoadingScreen from "@/components/LoadingScreen";

export default function AppLaunchLoading({
  text = "กำลังตรวจสอบการเข้าสู่ระบบ…",
}: {
  text?: string;
}) {
  return <LoadingScreen text={text} />;
}
