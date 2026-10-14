"use client";
import BackButton from "@/components/BackButton";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  CalendarDays,
  FileText,
  Eye,
  ArrowRightLeft,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";

export default function HolidayPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [announcementUrl, setAnnouncementUrl] = useState<string | null>(null);

  // 🌟 State จัดการปี (ค่าเริ่มต้นคือปีปัจจุบัน + 543)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear() + 543);

  // ตัวแปรเก็บวันที่ปัจจุบัน (รูปแบบ YYYY-MM-DD) เอาไว้เทียบว่าวันหยุดไหนผ่านไปแล้ว
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const empData = localStorage.getItem("employee_data");
    if (!empData) {
      router.push("/login");
    } else {
      fetchHolidaysData(selectedYear.toString());
    }
  }, [router, selectedYear]);

  const fetchHolidaysData = async (year: string) => {
    setLoading(true);
    try {
      const { data: settingData } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("setting_key", "holiday_announcement_url")
        .single();
      
      if (settingData) setAnnouncementUrl(settingData.setting_value);

      const { data: holidayData, error } = await supabase
        .from("company_holidays")
        .select("*")
        .eq("year", year)
        .order("date", { ascending: true });

      if (error) throw error;
      setHolidays(holidayData || []);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFullThaiDateStr = (dateString: string) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-");
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
    ];
    const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
    const d = new Date(dateString);
    return `วัน${days[d.getDay()]} ${parseInt(day)} ${months[parseInt(month) - 1]}`;
  };

  // ฟังก์ชันหาว่า "วันหยุดไหนคือคิวต่อไป" (เอาไว้ทำไฮไลท์)
  const nextHolidayId = useMemo(() => {
    const next = holidays.find((h) => {
      const targetDate = h.is_changed ? h.changed_date : h.date;
      return targetDate >= todayStr;
    });
    return next ? next.id : null;
  }, [holidays, todayStr]);

  return (
    // 🌟 1. ล็อกหน้าจอหลักไม่ให้มี Scrollbar นอกกรอบ
    <div className="app-page">
      
      {/* Header สีน้ำเงิน */}
      <div
        className="pt-12 pb-20 bg-cover bg-center relative overflow-hidden bg-blue-600 shrink-0"
        style={{ backgroundImage: `url('/img/bg-head.jpg')` }}
      >
        <div className="absolute inset-0 bg-blue-600/90 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
        <div className="px-6 md:px-10 flex items-center justify-between relative z-10">
          <BackButton fallback="/hr" className="cursor-pointer w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white active:scale-95 transition-all shadow-sm" />
          <h1 className="text-base md:text-lg font-bold text-white absolute left-1/2 -translate-x-1/2 drop-shadow-md">
            วันหยุดบริษัท
          </h1>
          <div className="w-10"></div>
        </div>
      </div>

      {/* Content หลัก (ไม่ให้เลื่อนทั้งหน้า) */}
      <div className="flex-1 px-6 md:px-10 -mt-8 relative z-20 shrink-0 mb-4 flex flex-col overflow-hidden pb-4">
        
        {/* ตัวเลือกปี (Year Selector) */}
        <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 p-2.5 flex items-center justify-between mb-4 shrink-0">
          <button 
            onClick={() => setSelectedYear(prev => prev - 1)}
            className="cursor-pointer w-10 h-10 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-gray-800 text-sm md:text-base">ปี พ.ศ. {selectedYear}</span>
          </div>
          <button 
            onClick={() => setSelectedYear(prev => prev + 1)}
            className="cursor-pointer w-10 h-10 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* ปุ่มลิงก์เอกสารประกาศวันหยุด */}
        {announcementUrl && (
          <a
            href={announcementUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full bg-white shadow-sm border border-gray-100 rounded-[24px] p-4 flex items-center justify-between group hover:border-blue-200 mb-4 shrink-0 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-gray-900 text-xs md:text-sm">
                  เอกสารประกาศวันหยุด
                </h3>
                <p className="text-[10px] md:text-xs text-gray-500 mt-0.5">
                  คลิกเพื่อดูประกาศฉบับเต็มของบริษัท
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors shrink-0">
              <Eye className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
            </div>
          </a>
        )}

        {/* 🌟 2. กรอบรายการวันหยุด (ใส่ overflow-y-auto และกำหนดให้ยืดหยุ่นเฉพาะพื้นที่นี้) */}
        <div className="bg-white flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0">
          {loading ? (
            <div className="py-20 relative my-auto">
              <LoadingScreen text={`กำลังโหลดวันหยุดปี ${selectedYear}...`} />
            </div>
          ) : holidays.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-400 my-auto">
              <CalendarX2 className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-bold text-gray-600">ยังไม่มีประกาศวันหยุด</p>
              <p className="text-xs text-gray-400 mt-1">สำหรับปี พ.ศ. {selectedYear}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {holidays.map((h, index) => {
                const targetDate = h.is_changed ? h.changed_date : h.date;
                const isPast = targetDate < todayStr;
                const isNext = h.id === nextHolidayId;

                return (
                  <div
                    key={h.id}
                    className={`relative p-5 flex items-start gap-4 transition-all duration-300 ${
                      isPast
                        ? "opacity-60 bg-gray-50/50"
                        : isNext
                          ? "bg-blue-100 border-l-4 border-l-blue-500 shadow-sm"
                          : "hover:bg-slate-50 bg-white"
                    }`}
                  >
                    {/* ป้ายกำกับวันหยุดถัดไป */}
                    {isNext && (
                      <span className="absolute top-4 right-4 bg-yellow-200 text-gray-800 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm border border-yellow-300">
                        ✨ วันหยุดถัดไป
                      </span>
                    )}

                    {/* ลำดับตัวเลข */}
                    <div
                      className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                        isNext
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {index + 1}
                    </div>

                    <div className="flex-1 flex flex-col pr-16 md:pr-24">
                      {h.is_changed ? (
                        <>
                          <div className="text-[12px] text-gray-400 line-through font-bold mb-0.5">
                            {getFullThaiDateStr(h.date)}
                          </div>
                          <div className="text-[10px] md:text-[10px] font-medium text-gray-400 line-through mb-2">
                            {h.title}
                          </div>

                          <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex flex-col items-start gap-2">
                            <div className="text-xs md:text-sm font-bold text-red-600 flex items-center gap-1.5 leading-snug">
                              <ArrowRightLeft className="w-4 h-4 shrink-0" />
                              เปลี่ยนวันหยุด เป็นวันที่ {getFullThaiDateStr(h.changed_date)}
                            </div>
                            {h.change_document_url && (
                              <a
                                href={h.change_document_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold hover:bg-red-50 transition-colors shadow-sm active:scale-95"
                              >
                                <Eye className="w-3.5 h-3.5" /> ดูเอกสารเปลี่ยนแปลง
                              </a>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            className={`text-[12px] md:text-[12px] font-bold mb-0.5 ${isPast ? "text-gray-400" : isNext ? "text-blue-700 font-bold" : "text-blue-500"}`}
                          >
                            {getFullThaiDateStr(h.date)}
                          </div>
                          <div
                            className={`text-[10px] md:text-[10px] font-medium leading-relaxed ${isPast ? "text-gray-500" : "text-gray-900"}`}
                          >
                            {h.title}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* หมายเหตุท้ายหน้า */}
        <div className="text-center pt-3 shrink-0 pb-18">
          <p className="text-[10px] md:text-xs text-gray-400 font-medium">
            หมายเหตุ: อาจมีการเปลี่ยนแปลงวันหยุดตามความเหมาะสม
          </p>
        </div>
      </div>
    </div>
  );
}