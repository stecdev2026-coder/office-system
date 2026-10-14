"use client";

import React, { useEffect } from "react";
import { Clock, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PendingPage() {
  const router = useRouter();

  // ป้องกันคนแอบเข้าหน้านี้โดยตรง ถ้าไม่ได้ล็อกอิน
  useEffect(() => {
    const lineProfile =
      localStorage.getItem("temp_line_profile") ||
      localStorage.getItem("line_profile");
    if (!lineProfile) router.push("/login");
  }, [router]);

  return (
    // 🌟 1. ถอดกรอบสีเทาออก ใช้ fixed inset-0 ยืดเต็มจอบนล่าง 
    // และใช้ md:max-w-3xl lg:max-w-4xl เพื่อรักษาความกว้างตรงกลางให้เป็นมาตรฐานเดียวกับหน้าอื่นๆ
    <div className="app-page">
      <div className="flex flex-col items-center justify-center flex-1 px-8 md:px-16 text-center">
        
        {/* 🌟 2. ขยายขนาดไอคอนและวงกลมพื้นหลังเมื่ออยู่บนหน้าจอ iPad */}
        <div className="w-24 h-24 md:w-32 md:h-32 bg-orange-100 rounded-full flex items-center justify-center mb-6 md:mb-8 relative shrink-0">
          <Clock size={48} className="text-orange-500 animate-pulse md:w-16 md:h-16" />
          <div className="absolute -bottom-1 -right-1 md:bottom-1 md:right-1 w-8 h-8 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
            <ShieldAlert size={16} className="text-gray-400 md:w-5 md:h-5" />
          </div>
        </div>

        {/* 🌟 3. ปรับขนาดตัวอักษรให้อ่านง่ายขึ้นบนจอใหญ่ */}
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 md:mb-4">
          รอการอนุมัติ
        </h1>
        <p className="text-sm md:text-base text-gray-500 leading-relaxed mb-8 md:mb-10">
          บัญชีของคุณกำลังอยู่ในขั้นตอนการตรวจสอบ
          <br />
          กรุณารอผู้ดูแลระบบอนุมัติการเข้าใช้งาน
          <br />
          เมื่อได้รับอนุมัติแล้ว กรุณาเข้าสู่ระบบใหม่อีกครั้ง
        </p>

        {/* 🌟 4. จำกัดความกว้างปุ่มไม่ให้ยาวเทอะทะเกินไปบน iPad (md:max-w-sm) */}
        <button
          onClick={() => router.push("/login")}
          className="w-full md:max-w-sm font-bold md:text-lg py-4 md:py-5 rounded-[16px] md:rounded-[20px] bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </button>
      </div>
    </div>
  );
}