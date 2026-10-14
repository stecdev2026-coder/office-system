"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [lineProfile, setLineProfile] = useState<any>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    position: "",
  });

  useEffect(() => {
    const tempProfile = localStorage.getItem("temp_line_profile");
    if (tempProfile) {
      setLineProfile(JSON.parse(tempProfile));
    } else {
      router.push("/login");
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const liff = (await import('@line/liff')).default;
      const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formData, accessToken: liff.getAccessToken() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ลงทะเบียนไม่สำเร็จ');

      localStorage.setItem("line_profile", JSON.stringify(lineProfile));
      localStorage.removeItem("temp_line_profile");

      toast.success("ส่งข้อมูลสำเร็จ! กรุณารอการอนุมัติ");
      router.push("/pending");
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  };

  return (
    // 🌟 1. ขยาย Container หลักสำหรับ iPad (md:max-w-xl) ตรงกลางจอพอดี
    <div className="app-page">
      {/* 🌟 2. Header (Fixed): ปรับ Padding สำหรับ iPad */}
      <div
        className="pt-16 md:pt-20 pb-8 md:pb-12 bg-cover bg-center relative overflow-hidden bg-blue-50 shrink-0"
        style={{ backgroundImage: `url('/img/bg-head.jpg')` }}
      >
        <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
        <div className="relative z-10 flex flex-col items-center justify-center px-6 md:px-10">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-full flex items-center justify-center mb-3 md:mb-4 shadow-sm border border-gray-100">
            <UserPlus size={32} className="text-blue-600 md:w-10 md:h-10" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 drop-shadow-sm">
            ลงทะเบียนพนักงานใหม่
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1 md:mt-2 text-center">
            กรุณากรอกข้อมูลเพื่อผูกบัญชี LINE กับระบบออฟฟิศ
          </p>
        </div>
      </div>

      {/* 🌟 3. Content (Scrollable): จัดระยะขอบฟอร์มสำหรับจอใหญ่ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-12 pt-6 md:pt-10 pb-6">
        {/* 🌟 ใช้ Grid จัดให้กรอกชื่อ-นามสกุล คู่กันในบรรทัดเดียวบน iPad (md:grid-cols-2) */}
        <form
          id="registerForm"
          onSubmit={handleSubmit}
          className="space-y-4 md:space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1.5 md:mb-2 ml-1">
                ชื่อจริง
              </label>
              <input
                type="text"
                name="firstName"
                required
                value={formData.firstName}
                onChange={handleChange}
                className="w-full px-4 md:px-5 py-3.5 md:py-4 bg-white rounded-[16px] md:rounded-[20px] border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm md:text-base font-medium"
                placeholder="เช่น สมชาย"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1.5 md:mb-2 ml-1">
                นามสกุล
              </label>
              <input
                type="text"
                name="lastName"
                required
                value={formData.lastName}
                onChange={handleChange}
                className="w-full px-4 md:px-5 py-3.5 md:py-4 bg-white rounded-[16px] md:rounded-[20px] border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm md:text-base font-medium"
                placeholder="เช่น รักดี"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1.5 md:mb-2 ml-1">
                ชื่อเล่น
              </label>
              <input
                type="text"
                name="nickname"
                required
                value={formData.nickname}
                onChange={handleChange}
                className="w-full px-4 md:px-5 py-3.5 md:py-4 bg-white rounded-[16px] md:rounded-[20px] border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm md:text-base font-medium"
                placeholder="เช่น ชาย"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1.5 md:mb-2 ml-1">
                ตำแหน่ง
              </label>
              <input
                type="text"
                name="position"
                required
                value={formData.position}
                onChange={handleChange}
                className="w-full px-4 md:px-5 py-3.5 md:py-4 bg-white rounded-[16px] md:rounded-[20px] border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm md:text-base font-medium"
                placeholder="เช่น IT Support"
              />
            </div>
          </div>
        </form>
      </div>

      {/* 🌟 4. Footer (Fixed) */}
      <div className="p-6 md:p-8 shrink-0 bg-white border-t border-gray-100 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
        <button
          type="submit"
          form="registerForm"
          disabled={loading}
          className={`w-full font-bold md:text-lg py-4 md:py-5 rounded-[16px] md:rounded-[20px] flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer ${
            loading
              ? "bg-gray-100 text-gray-400"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30"
          }`}
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin md:w-6 md:h-6" />{" "}
              กำลังบันทึกข้อมูล...
            </>
          ) : (
            "ยืนยันการลงทะเบียน"
          )}
        </button>
      </div>
    </div>
  );
}
