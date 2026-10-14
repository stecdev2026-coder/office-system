"use client";
import BackButton from "@/components/BackButton";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  User,
  CalendarDays,
  FileText,
  Briefcase,
  ChevronRight,
  Clock,
  HeartPulse,
  CalendarCheck,
  Parasol,
  ClipboardList,
} from "lucide-react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";

// 🌟 Component ย่อย LeaveCard
const LeaveCard = ({
  title,
  totalDays,
  usedDays,
  usedHours,
  icon,
  bgColor,
  iconBgColor,
  iconColor,
  textColor,
}: {
  title: string;
  totalDays: number;
  usedDays: number;
  usedHours: number;
  icon: React.ReactNode;
  bgColor: string;
  iconBgColor: string;
  iconColor: string;
  textColor: string;
}) => {
  const WORK_HOURS = 8;
  const totalHours = totalDays * WORK_HOURS;
  const usedTotalHours = usedDays * WORK_HOURS + usedHours;
  const remainTotalHours = Math.max(0, totalHours - usedTotalHours); // ป้องกันค่าติดลบ

  const remainDays = Math.floor(remainTotalHours / WORK_HOURS);
  const remainHours = remainTotalHours % WORK_HOURS;

  const percent = Math.min((usedTotalHours / totalHours) * 100, 100) || 0; // ป้องกัน NaN

  return (
    <div
      className={`relative overflow-hidden shadow-sm transition-all hover:shadow-md rounded-[20px] p-4 border border-white/50 h-full flex flex-col justify-between ${bgColor}`}
    >
      <div className={`absolute top-4 right-4 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${iconBgColor} ${iconColor}`}>
        {icon}
      </div>

      <div className={`relative z-10 ${textColor}`}>
        <p className="text-[12px] md:text-[13px] font-bold mb-2 opacity-80 pr-10">{title}</p>

        <div className="flex items-baseline gap-1.5 mb-3">
          <span className="text-3xl md:text-4xl font-black">{usedDays}</span>
          <span className="text-xs font-bold opacity-80">วัน</span>
          {usedHours > 0 && (
            <>
              <span className="text-3xl md:text-4xl font-black ml-1">{usedHours}</span>
              <span className="text-xs font-bold opacity-80">ชม.</span>
            </>
          )}
        </div>

        <div className="w-full bg-black/5 rounded-full overflow-hidden mb-2 shadow-inner h-1.5 mt-auto">
          <div
            className={`h-full rounded-full relative ${(iconColor || "text-blue-500").replace("text-", "bg-")}`}
            style={{
              width: `${percent}%`,
              transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          ></div>
        </div>

        <div className="flex justify-between items-center text-[10px] md:text-[11px] font-bold opacity-70">
          <span>
            เหลือ {remainDays > 0 ? `${remainDays} วัน ` : ""}
            {remainHours > 0
              ? `${remainHours} ชม.`
              : remainDays === 0 && remainHours === 0
                ? "หมดแล้ว"
                : ""}
          </span>
          <span>ทั้งหมด {totalDays} วัน</span>
        </div>
      </div>
    </div>
  );
};

export default function HrDashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<any>(null);
  const [lineProfile, setLineProfile] = useState<any>(null);
  
  // 🌟 State สำหรับเก็บข้อมูลการใช้สิทธิ์ลา
  const [leaveUsage, setLeaveUsage] = useState({
    annual: { usedDays: 0, usedHours: 0 },
    personal: { usedDays: 0, usedHours: 0 },
    sick: { usedDays: 0, usedHours: 0 },
  });

  useEffect(() => {
    const empData = localStorage.getItem("employee_data");
    const profileData = localStorage.getItem("line_profile");

    if (empData) {
      const parsedEmp = JSON.parse(empData);
      setEmployee(parsedEmp);
      if (profileData) {
        setLineProfile(JSON.parse(profileData));
      }
      
      // เรียกฟังก์ชันดึงข้อมูลสรุปวันลาเมื่อโหลดข้อมูลพนักงานเสร็จ
      fetchLeaveStats(parsedEmp.line_user_id);
    } else {
      router.push("/login");
    }
  }, [router]);

  // 🌟 ฟังก์ชันดึงและคำนวณวันลาแบบละเอียด (รองรับการลาครึ่งวัน/รายชั่วโมง)
  const fetchLeaveStats = async (lineUserId: string) => {
    const currentYear = new Date().getFullYear();
    
    // ดึงประวัติการลาที่ "อนุมัติแล้ว" และอยู่ในปีปัจจุบัน
    const { data, error } = await supabase
      .from("leave_requests")
      .select("leave_type, total_days, leave_format")
      .eq("line_user_id", lineUserId)
      .eq("status", "approved")
      .gte("start_date", `${currentYear}-01-01`)
      .lte("end_date", `${currentYear}-12-31`);

    if (error) {
      console.error("Error fetching leave stats:", error);
      return;
    }

    const usage = {
      annual: { usedDays: 0, usedHours: 0 },
      personal: { usedDays: 0, usedHours: 0 },
      sick: { usedDays: 0, usedHours: 0 },
    };

    if (data) {
      data.forEach((leave) => {
        const type = leave.leave_type?.toLowerCase();
        let days = Number(leave.total_days) || 0;
        let hours = 0;
        
        // ถ้าลาครึ่งวัน (half) เราจะแปลงเป็นใช้ไป 4 ชั่วโมง
        if (leave.leave_format === 'half') {
            days = 0;
            hours = 4;
        }

        if (type === "annual") {
          usage.annual.usedDays += days;
          usage.annual.usedHours += hours;
        } else if (type === "personal") {
          usage.personal.usedDays += days;
          usage.personal.usedHours += hours;
        } else if (type === "sick") {
          usage.sick.usedDays += days;
          usage.sick.usedHours += hours;
        }
      });
      
      // ปรับจูนชั่วโมงให้เป็นวัน (ถ้าเกิน 8 ชั่วโมง = 1 วัน)
      const WORK_HOURS = 8;
      
      const optimizeTime = (stat: {usedDays: number, usedHours: number}) => {
          stat.usedDays += Math.floor(stat.usedHours / WORK_HOURS);
          stat.usedHours = stat.usedHours % WORK_HOURS;
      }
      
      optimizeTime(usage.annual);
      optimizeTime(usage.personal);
      optimizeTime(usage.sick);
    }
    
    setLeaveUsage(usage);
  };

  if (!employee) return null;

  // ตั้งค่าโควตาการลา (ดึงจาก Employee ถ้ามี ถ้าไม่มีใช้ค่าพื้นฐาน)
  const annualQuota = employee.annual_leave_quota || 6;
  const personalQuota = employee.personal_leave_quota || 6; // ปกติลากิจได้ 6 วัน
  const sickQuota = employee.sick_leave_quota || 30; // ปกติลาป่วยได้ 30 วัน

  return (
    <div className="app-page">
      
      {/* Header */}
      <div
        className="pt-12 pb-16 bg-cover bg-center relative overflow-hidden bg-blue-600 shrink-0"
        style={{ backgroundImage: `url('/img/bg-head.jpg')` }}
      >
        <div className="absolute inset-0 bg-blue-600/90 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
        <div className="px-6 md:px-10 flex items-center justify-between relative z-10">
          <BackButton fallback="/" className="cursor-pointer w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white active:scale-95 transition-all shadow-sm" />
          <h1 className="text-base md:text-lg font-bold text-white absolute left-1/2 -translate-x-1/2 drop-shadow-md">
            บริการงานบุคคล (HR)
          </h1>
          <div className="w-10"></div>
        </div>
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 120"
            className="w-full h-8 sm:h-12 md:h-16 block"
            preserveAspectRatio="none"
          >
            <path fill="#FAFAFA" d="M0,120 C480,0 960,0 1440,120 L1440,120 L0,120 Z"></path>
          </svg>
        </div>
      </div>

      {/* My HR Details */}
      <div className="px-6 md:px-10 -mt-6 relative z-20 shrink-0 mb-2">
        <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 mb-4 flex items-center gap-4 md:gap-6 md:p-6 transition-all">
          <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden bg-blue-50 border border-blue-100 shrink-0 flex items-center justify-center">
            {lineProfile?.pictureUrl ? (
              <Image src={lineProfile.pictureUrl} alt="Profile" fill sizes="(max-width: 768px) 56px, 64px" className="object-cover" />
            ) : (
              <div className="w-full h-full bg-blue-50 flex items-center justify-center text-blue-500 font-bold">
                <User size={28} />
              </div>
            )}
          </div>

          <div className="flex-1">
            <h2 className="text-base md:text-lg font-bold text-gray-900 mb-0.5">
              {employee.first_name} {employee.last_name || ""}
            </h2>
            <div className="flex flex-col md:flex-row gap-0.5 md:gap-4 text-xs md:text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Briefcase size={14} /> {employee.position || "ไม่ระบุตำแหน่ง"}
              </span>
              {employee.employee_code && (
                <span className="flex items-center gap-1.5">
                  <FileText size={14} /> รหัสพนักงาน: {employee.employee_code}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-10 pb-24">
        <h3 className="text-sm md:text-base font-bold text-gray-900 mb-3 px-1">
          สรุปวันลา (ที่ใช้ไปแล้ว ปี {new Date().getFullYear() + 543})
        </h3>

        {/* 🌟 ใช้งาน State `leaveUsage` ตรงนี้ */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-4">
          
          <div className="col-span-2 md:col-span-1">
            <LeaveCard
              title="ลาพักร้อนประจำปี"
              totalDays={annualQuota}
              usedDays={leaveUsage.annual.usedDays}
              usedHours={leaveUsage.annual.usedHours}
              icon={<Parasol size={24} strokeWidth={2} />}
              bgColor="bg-orange-100"
              iconBgColor="bg-orange-200"
              iconColor="text-orange-500"
              textColor="text-gray-900"
            />
          </div>

          <div className="col-span-1">
            <LeaveCard
              title="ลากิจ"
              totalDays={personalQuota}
              usedDays={leaveUsage.personal.usedDays}
              usedHours={leaveUsage.personal.usedHours}
              icon={<ClipboardList size={24} strokeWidth={2} />}
              bgColor="bg-blue-100"
              iconBgColor="bg-blue-200"
              iconColor="text-blue-500"
              textColor="text-gray-900"
            />
          </div>

          <div className="col-span-1">
            <LeaveCard
              title="ลาป่วย"
              totalDays={sickQuota}
              usedDays={leaveUsage.sick.usedDays}
              usedHours={leaveUsage.sick.usedHours}
              icon={<HeartPulse size={24} strokeWidth={2} />}
              bgColor="bg-pink-100"
              iconBgColor="bg-pink-200"
              iconColor="text-pink-500"
              textColor="text-gray-900"
            />
          </div>
        </div>

        {/* รายละเอียดการลางาน */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/hr/leave/history")}
            className="w-full bg-white p-4 md:p-5 rounded-[20px] shadow-sm border border-gray-100 flex items-center gap-4 hover:border-blue-200 transition-all active:scale-[0.98] cursor-pointer"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <FileText size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm md:text-base font-bold text-gray-800">
                รายละเอียดการลางาน
              </p>
              <p className="text-[10px] md:text-xs text-gray-400">
                ดูประวัติและสถานะการอนุมัติการลางาน
              </p>
            </div>
            <ChevronRight size={18} className="text-gray-300 md:w-6 md:h-6" />
          </button>
        </div>

        <h3 className="text-sm md:text-base font-bold text-gray-900 mb-3 px-1">
          เมนูบริการ
        </h3>

        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
          <button
            onClick={() => router.push("/hr/leave")}
            className="bg-white p-4 md:p-6 rounded-[20px] shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 hover:border-blue-300 hover:shadow-md transition-all active:scale-95 cursor-pointer text-center"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Clock size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
              <p className="text-xs md:text-sm font-bold text-gray-800">ส่งคำขอลางาน</p>
              <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">
                ลากิจ, ลาป่วย, พักร้อน
              </p>
            </div>
          </button>
          
          <button
            onClick={() => router.push("/hr/holidays")}
            className="bg-white p-4 md:p-6 rounded-[20px] shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-3 hover:border-blue-300 hover:shadow-md transition-all active:scale-95 cursor-pointer text-center"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
              <CalendarDays size={20} className="md:w-6 md:h-6" />
            </div>
            <div>
              <p className="text-xs md:text-sm font-bold text-gray-800">วันหยุดบริษัท</p>
              <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">
                ปฏิทินวันหยุดประจำปี
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}