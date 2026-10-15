"use client";

import AppLaunchLoading from "@/components/AppLaunchLoading";
import LoadingScreen from "@/components/LoadingScreen";
import { hasAppOpened } from "@/lib/loadingLifecycle";

export default function RouteLoadingScreen() {
  return hasAppOpened()
    ? <LoadingScreen text="กำลังโหลดหน้า…" />
    : <AppLaunchLoading text="กำลังเปิด OFFICE SYSTEM…" />;
}
