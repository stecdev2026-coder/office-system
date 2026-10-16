import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { AppHistory } from "@/components/BackButton";
import SessionGate from "@/components/SessionGate";
import PwaControls from "@/components/PwaControls";
import AppContainer from "@/components/AppContainer";
import BottomNav from "@/components/BottomNav";
import { Toaster } from "sonner";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Office System",
  description: "ระบบลงเวลาและจัดการวันลาสำหรับพนักงาน",
  manifest: "/manifest.json",
  applicationName: "Office System",
  appleWebApp: { capable: true, title: "Office System", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png", icon: "/icons/icon-192x192.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f4f6f9" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const currentVersion=process.env.VERCEL_GIT_COMMIT_SHA||process.env.VERCEL_DEPLOYMENT_ID||"development";
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={notoSansThai.className}>
        <AppHistory><div className="app-viewport">
          
          {/* 🌟 เรียกใช้ตัวแปรตรงนี้ โค้ดจะดูคลีนมาก */}
          <AppContainer>
            
            <main className="app-main">
              <SessionGate>{children}</SessionGate>
              <Toaster position="top-center" richColors closeButton />
            </main>

            <PwaControls currentVersion={currentVersion} />
            <div className="app-navigation">
              <BottomNav />
            </div>
            
          </AppContainer>

        </div></AppHistory>
      </body>
    </html>
  );
}
