import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  text?: string;
}

export default function LoadingScreen({
  text = "กำลังโหลดข้อมูล...",
}: LoadingScreenProps) {
  return (
    // 🌟 1. ใช้ fixed inset-0 และ z-50 เพื่อคลุมทับทุกสิ่งทุกอย่างบนหน้าจอ
    <div data-loading-screen className="fixed inset-0 z-50 flex items-center justify-center bg-gray-200 sm:p-4">
      {/* 🌟 2. กรอบจำลองมือถือ (ดีไซน์เดียวกับหน้า Login) */}
      <div data-loading-panel className="relative flex h-full w-full max-w-md flex-col items-center justify-center overflow-hidden bg-[#FAFAFA] sm:h-[calc(100dvh-2rem)] sm:rounded-[40px] sm:shadow-2xl">
        {/* พื้นหลังโค้งตกแต่งด้านบน */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[35%] bg-gradient-to-b from-blue-50 to-transparent rounded-b-[50%] pointer-events-none opacity-60"></div>

        {/* 🌟 3. เนื้อหาโหลดดิ้งตรงกลาง */}
        <div className="relative z-10 flex flex-col items-center">
          {/* กล่องไอคอนพร้อมลูกเล่นเรืองแสง (Pulse glow) */}
          <div className="relative mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full blur-xl bg-blue-500/40 animate-pulse"></div>
            <Loader2 size={40} className="text-blue-600 animate-spin" />
          </div>

          <h2 className="text-lg font-bold text-gray-800 mb-2">{text}</h2>
          <p className="text-xs text-gray-400 font-medium animate-pulse tracking-wide">
            OFFICE SYSTEM
          </p>
        </div>
      </div>
    </div>
  );
}
