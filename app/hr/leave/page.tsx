"use client";
import BackButton from "@/components/BackButton";
import LoadingScreen from "@/components/LoadingScreen";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Calendar,
  Clock,
  FileText,
  UploadCloud,
  CheckCircle2,
  XCircle,
  User,
  Loader2,
  AlertCircle,
  HeartPulse,
  ClipboardList,
  Parasol,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

export default function LeaveRequestPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<any>(null);

  const isApprover = employee?.role === "Admin";
  const [activeTab, setActiveTab] = useState<"request" | "approve">("request");

  const [leaveType, setLeaveType] = useState<"sick" | "personal" | "annual">("personal");
  const [leaveFormat, setLeaveFormat] = useState<"full" | "half" | "hourly">("full");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [halfDayPeriod, setHalfDayPeriod] = useState<"morning" | "afternoon">("morning");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);

  const [lineProfile, setLineProfile] = useState<any>(null);

  useEffect(() => {
    const empData = localStorage.getItem("employee_data");
    const profileData = localStorage.getItem("line_profile");

    if (empData) {
      const parsedEmp = JSON.parse(empData);
      setEmployee(parsedEmp);

      if (profileData) {
        setLineProfile(JSON.parse(profileData));
      }

      if (isApprover) {
        fetchPendingRequests();
      }
    } else {
      router.push("/login");
    }
  }, [router, isApprover]);

  // 🌟 ฟังก์ชันดึงคำขอที่ "รออนุมัติ" + "ขอยกเลิกวันลา" มาแสดง
  const fetchPendingRequests = async () => {
    setIsLoadingPending(true);
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .in("status", ["pending", "cancel_pending"]) // ดึงทั้งคู่
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingRequests(data || []);
    } catch (error) {
      console.error(error);
      toast.error("ดึงข้อมูลคำขอที่รออนุมัติไม่สำเร็จ");
    } finally {
      setIsLoadingPending(false);
    }
  };

  // 🌟 ฟังก์ชันอัปเดตสถานะ (รวมลอจิกทั้ง Approve ใหม่ และ Approve ยกเลิก)
  const handleApprove = async (
    id: string,
    action: "approve" | "reject",
  ) => {
    try {
      const requestToUpdate = pendingRequests.find(req => req.id === id);
      if (!requestToUpdate) return;

      let finalStatus = "";
      let notifTitle = "";
      let notifMessage = "";
      const typeName = getLeaveTypeName(requestToUpdate.leave_type);

      // 📌 ถ้าเป็นคำขอลาใหม่ (pending)
      if (requestToUpdate.status === "pending") {
        finalStatus = action === "approve" ? "approved" : "rejected";
        notifTitle = action === "approve" ? "อนุมัติลางานเรียบร้อย" : "คำขอลางานถูกปฏิเสธ";
        notifMessage = action === "approve" 
            ? `คำขอ${typeName} วันที่ ${requestToUpdate.start_date} ได้รับการอนุมัติแล้ว` 
            : `คำขอ${typeName} วันที่ ${requestToUpdate.start_date} ถูกปฏิเสธ`;
      } 
      // 📌 ถ้าเป็นคำขอยกเลิก (cancel_pending)
      else if (requestToUpdate.status === "cancel_pending") {
        // อนุมัติให้ยกเลิก = cancelled, ไม่ยอมให้ยกเลิก = กลับไป approved เหมือนเดิม
        finalStatus = action === "approve" ? "cancelled" : "approved";
        notifTitle = action === "approve" ? "อนุมัติการยกเลิกวันลา" : "ปฏิเสธการยกเลิกวันลา";
        notifMessage = action === "approve" 
            ? `การขอยกเลิก${typeName} วันที่ ${requestToUpdate.start_date} อนุมัติแล้ว (โควตาถูกคืน)` 
            : `การขอยกเลิก${typeName} วันที่ ${requestToUpdate.start_date} ถูกปฏิเสธ คุณยังต้องลางานตามปกติ`;
      }

      // อัปเดตตาราง leave_requests
      const { error: updateError } = await supabase
        .from("leave_requests")
        .update({
          status: finalStatus,
          approver_id: employee.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // ส่งแจ้งเตือน
      const { error: notifError } = await supabase.from("notifications").insert([{
        line_user_id: requestToUpdate.line_user_id,
        type: action === "approve" ? "leave_approved" : "leave_rejected",
        title: notifTitle,
        message: notifMessage,
        reference_id: id,
        is_read: false
      }]);

      if (notifError) console.error("Notification Error:", notifError);

      toast.success(action === "approve" ? "ทำรายการอนุมัติสำเร็จ" : "ทำรายการปฏิเสธสำเร็จ");
      setPendingRequests((prev) => prev.filter((req) => req.id !== id));
      
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการทำรายการ");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 1024 * 1024) {
        toast.error("ขนาดไฟล์เกิน 1 MB กรุณาเลือกรูปใหม่ครับ");
        e.target.value = "";
        setFile(null);
        return;
      }
      setFile(selectedFile);
      toast.success("แนบไฟล์สำเร็จ");
    }
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let calculatedDays = 1;
      if (leaveFormat === "half") calculatedDays = 0.5;
      else if (leaveFormat === "hourly") calculatedDays = 0.125;
      else if (startDate && endDate) {
        const diffTime = Math.abs(
          new Date(endDate).getTime() - new Date(startDate).getTime(),
        );
        calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }

      // 1. บันทึกคำขอลางานลง Supabase
      const { data: insertedLeave, error: leaveError } = await supabase.from("leave_requests").insert([
        {
          line_user_id: employee.line_user_id,
          employee_name: `${employee.first_name} ${employee.last_name}`,
          employee_picture_url: lineProfile?.pictureUrl || null,
          leave_type: leaveType,
          leave_format: leaveFormat,
          start_date: startDate,
          end_date: leaveFormat === "full" ? endDate : startDate,
          half_day_period: leaveFormat === "half" ? halfDayPeriod : null,
          start_time: leaveFormat === "hourly" ? startTime : null,
          end_time: leaveFormat === "hourly" ? endTime : null,
          reason: reason,
          total_days: calculatedDays,
          status: "pending",
        },
      ]).select().single();

      if (leaveError) throw leaveError;

      // 2. 🌟 ยิงแจ้งเตือนให้ "หัวหน้า" (ตอนนี้คือส่งหาตัวเองเพื่อทดสอบ)
      const typeName = getLeaveTypeName(leaveType);
      
      const { error: notifError } = await supabase.from("notifications").insert([{
        line_user_id: employee.line_user_id, // 👈 ส่งหาไอดีตัวเองเลย จะได้เด้งที่กระดิ่ง
        type: "leave_request_pending", // 👈 กำหนด Type ใหม่ว่าเป็น "มีคำขอรออนุมัติ"
        title: "มีคำขอลางานใหม่รออนุมัติ",
        message: `${employee.first_name} ส่งคำขอ${typeName} (${calculatedDays} วัน) เริ่มวันที่ ${startDate}`,
        reference_id: insertedLeave?.id || null,
        is_read: false
      }]);

      if (notifError) console.error("Notification Error:", notifError);

      toast.success("ส่งคำขอลางานเรียบร้อย รอหัวหน้าอนุมัติ");
      setFile(null);
      router.push("/hr/leave/history");
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการส่งคำขอ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLeaveTypeName = (type: string) => {
    switch (type) {
      case "personal":
        return "ลากิจ";
      case "annual":
        return "พักร้อน";
      case "sick":
        return "ลาป่วย";
      default:
        return type;
    }
  };

  const getLeaveFormatName = (
    format: string,
    halfPeriod?: string,
    startTime?: string,
    endTime?: string,
  ) => {
    if (format === "full") return "เต็มวัน";
    if (format === "half")
      return `ครึ่งวัน (${halfPeriod === "morning" ? "เช้า 09:00-12:00" : "บ่าย 13:00-18:00"})`;
    if (format === "hourly") return `ราย ชม. (${startTime} - ${endTime} น.)`;
    return format;
  };

  return (
    <div className="app-page">
      <div
        className="pt-12 md:pt-16 pb-6 bg-cover bg-center relative overflow-hidden bg-blue-600 shrink-0"
        style={{ backgroundImage: `url('/img/bg-head.jpg')` }}
      >
        <div className="absolute inset-0 bg-blue-600/90 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>

        <div className="px-6 md:px-10 flex items-center justify-between relative z-10 mb-6">
          <BackButton fallback="/hr" className="cursor-pointer w-10 h-10 md:w-12 md:h-12 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white active:scale-95 transition-all shadow-sm" />
          <h1 className="text-base md:text-lg font-bold text-white absolute left-1/2 -translate-x-1/2 drop-shadow-md">
            จัดการลางาน
          </h1>
          <div className="w-10 md:w-12"></div>
        </div>

        {isApprover && (
          <div className="px-6 md:px-10 relative z-10">
            <div className="flex bg-white/20 backdrop-blur-md p-1 rounded-2xl md:max-w-md mx-auto">
              <button
                onClick={() => setActiveTab("request")}
                className={`cursor-pointer flex-1 py-2 md:py-2.5 text-xs md:text-sm font-bold rounded-xl transition-all ${activeTab === "request" ? "bg-white text-blue-600 shadow-sm" : "text-white hover:bg-white/10"}`}
              >
                ส่งคำขอลางาน
              </button>
              <button
                onClick={() => {
                  setActiveTab("approve");
                  fetchPendingRequests();
                }}
                className={`cursor-pointer flex-1 py-2 md:py-2.5 text-xs md:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === "approve" ? "bg-white text-blue-600 shadow-sm" : "text-white hover:bg-white/10"}`}
              >
                อนุมัติ
                {pendingRequests.length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === "request" ? (
          <div className="px-6 md:px-10 py-6 md:py-8 animate-in fade-in slide-in-from-left-4 duration-300">
            <form onSubmit={handleSubmitLeave} className="space-y-6 md:space-y-8">
              <div>
                <label className="block text-sm md:text-base font-bold text-gray-900 mb-3">
                  1. ประเภทการลา
                </label>
                <div className="grid grid-cols-3 gap-3 md:gap-4">
                  <button
                    type="button"
                    onClick={() => setLeaveType("personal")}
                    className={`cursor-pointer p-3 md:p-4 rounded-[20px] border-2 transition-all flex flex-col items-center gap-2 ${leaveType === "personal" ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-white hover:border-gray-200"}`}
                  >
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center ${leaveType === "personal" ? "bg-blue-500 text-white shadow-md shadow-blue-500/30" : "bg-gray-100 text-gray-400"}`}>
                      <FileText size={20} className="md:w-6 md:h-6" />
                    </div>
                    <span className={`text-xs md:text-sm font-bold ${leaveType === "personal" ? "text-blue-700" : "text-gray-500"}`}>ลากิจ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType("annual")}
                    className={`cursor-pointer p-3 md:p-4 rounded-[20px] border-2 transition-all flex flex-col items-center gap-2 ${leaveType === "annual" ? "border-orange-500 bg-orange-50" : "border-gray-100 bg-white hover:border-gray-200"}`}
                  >
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center ${leaveType === "annual" ? "bg-orange-500 text-white shadow-md shadow-orange-500/30" : "bg-gray-100 text-gray-400"}`}>
                      <Parasol size={20} className="md:w-6 md:h-6" />
                    </div>
                    <span className={`text-xs md:text-sm font-bold ${leaveType === "annual" ? "text-orange-700" : "text-gray-500"}`}>พักร้อน</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType("sick")}
                    className={`cursor-pointer p-3 md:p-4 rounded-[20px] border-2 transition-all flex flex-col items-center gap-2 ${leaveType === "sick" ? "border-pink-500 bg-pink-50" : "border-gray-100 bg-white hover:border-gray-200"}`}
                  >
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center ${leaveType === "sick" ? "bg-pink-500 text-white shadow-md shadow-pink-500/30" : "bg-gray-100 text-gray-400"}`}>
                      <HeartPulse size={20} className="md:w-6 md:h-6" />
                    </div>
                    <span className={`text-xs md:text-sm font-bold ${leaveType === "sick" ? "text-pink-700" : "text-gray-500"}`}>ลาป่วย</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm md:text-base font-bold text-gray-900 mb-3">
                  2. รูปแบบการลา
                </label>
                <div className="grid grid-cols-3 gap-2 md:gap-4 bg-gray-50 p-1 md:p-1.5 rounded-2xl border border-gray-100">
                  <button
                    type="button"
                    onClick={() => setLeaveFormat("full")}
                    className={`cursor-pointer py-2.5 md:py-3.5 text-xs md:text-sm font-bold rounded-xl transition-all ${leaveFormat === "full" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    เต็มวัน
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveFormat("half")}
                    className={`cursor-pointer py-2.5 md:py-3.5 text-xs md:text-sm font-bold rounded-xl transition-all ${leaveFormat === "half" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    ครึ่งวัน
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveFormat("hourly")}
                    className={`cursor-pointer py-2.5 md:py-3.5 text-xs md:text-sm font-bold rounded-xl transition-all ${leaveFormat === "hourly" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    ราย ชม.
                  </button>
                </div>
              </div>

              <div className="bg-white p-5 md:p-6 rounded-[24px] border border-gray-100 shadow-sm">
                {leaveFormat === "full" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs md:text-sm font-bold text-gray-500 mb-1.5">เริ่มวันที่</label>
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="cursor-pointer w-full text-sm md:text-base font-medium bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs md:text-sm font-bold text-gray-500 mb-1.5">ถึงวันที่</label>
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="cursor-pointer w-full text-sm md:text-base font-medium bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                )}

                {leaveFormat === "half" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs md:text-sm font-bold text-gray-500 mb-1.5">วันที่ลา</label>
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="cursor-pointer w-full text-sm md:text-base font-medium bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setHalfDayPeriod("morning")} className={`cursor-pointer py-3 md:py-4 rounded-xl border-2 font-bold text-sm transition-all ${halfDayPeriod === "morning" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-100 bg-white text-gray-500"}`}>
                        ช่วงเช้า<br /><span className="text-[10px] md:text-xs font-normal opacity-70">09:00 - 12:00 น.</span>
                      </button>
                      <button type="button" onClick={() => setHalfDayPeriod("afternoon")} className={`cursor-pointer py-3 md:py-4 rounded-xl border-2 font-bold text-sm transition-all ${halfDayPeriod === "afternoon" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-100 bg-white text-gray-500"}`}>
                        ช่วงบ่าย<br /><span className="text-[10px] md:text-xs font-normal opacity-70">13:00 - 18:00 น.</span>
                      </button>
                    </div>
                  </div>
                )}

                {leaveFormat === "hourly" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs md:text-sm font-bold text-gray-500 mb-1.5">วันที่ลา</label>
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="cursor-pointer w-full text-sm md:text-base font-medium bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs md:text-sm font-bold text-gray-500 mb-1.5 flex items-center gap-1"><Clock size={12} /> ตั้งแต่เวลา</label>
                        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className="cursor-pointer w-full text-sm md:text-base font-medium bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs md:text-sm font-bold text-gray-500 mb-1.5 flex items-center gap-1"><Clock size={12} /> ถึงเวลา</label>
                        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className="cursor-pointer w-full text-sm md:text-base font-medium bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm md:text-base font-bold text-gray-900 mb-3">
                  3. รายละเอียดเพิ่มเติม
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder="เหตุผลการลางาน..."
                  className="w-full text-sm md:text-base font-medium bg-white border border-gray-200 rounded-[20px] px-5 py-4 text-gray-900 focus:outline-none focus:border-blue-500 h-28 resize-none mb-4 shadow-sm"
                />

                <label className="w-full border-2 border-dashed border-gray-200 rounded-[20px] p-5 flex flex-col items-center justify-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition-all active:scale-[0.98]">
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                  {file ? (
                    <>
                      <CheckCircle2 size={28} className="text-green-500 mb-2 md:w-8 md:h-8" />
                      <p className="text-xs md:text-sm font-bold text-gray-700">{file.name}</p>
                      <p className="text-[10px] md:text-xs text-green-500 mt-1">แนบไฟล์เรียบร้อยแล้ว (คลิกเพื่อเปลี่ยน)</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={28} className="text-blue-500 mb-2 md:w-8 md:h-8" />
                      <p className="text-xs md:text-sm font-bold text-gray-700">แนบเอกสาร (ถ้ามี)</p>
                      <p className="text-[10px] md:text-xs text-gray-400 mt-1">เช่น ใบรับรองแพทย์ (สูงสุด 1 MB)</p>
                    </>
                  )}
                </label>
              </div>

              <div className="pb-24 md:pb-32">
                <button type="submit" disabled={isSubmitting} className={`cursor-pointer w-full font-bold md:text-lg py-4 md:py-5 rounded-[20px] md:rounded-[24px] flex items-center justify-center gap-2 transition-all active:scale-95 ${isSubmitting ? "bg-gray-100 text-gray-400" : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30"}`}>
                  {isSubmitting ? <><Loader2 size={22} className="animate-spin" /> กำลังส่งคำขอ...</> : "ส่งคำขอลางาน"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="px-6 md:px-10 py-6 md:py-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="font-bold text-gray-900 text-sm md:text-base mb-4 flex items-center gap-2">
              รายการคำขอ
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                {pendingRequests.length}
              </span>
            </h2>

            {isLoadingPending ? (
              <LoadingScreen text="กำลังโหลดข้อมูลคำขอ…"/>
            ) : pendingRequests.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-gray-100 flex flex-col items-center">
                <CheckCircle2 size={40} className="text-green-500 mb-3 md:w-12 md:h-12" />
                <h3 className="text-gray-900 font-bold mb-1">ไม่มีคำขอค้าง</h3>
                <p className="text-xs text-gray-500">คุณทำรายการอนุมัติครบถ้วนแล้ว</p>
              </div>
            ) : (
              <div className="space-y-4 md:grid md:grid-cols-2 md:space-y-0 md:gap-4 pb-20">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative w-12 h-12 rounded-full overflow-hidden bg-blue-50 border border-blue-100 shrink-0 flex items-center justify-center">
                        {req.employee_picture_url ? (
                          <img src={req.employee_picture_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <User size={24} className="text-blue-500" />
                        )}
                      </div>

                      <div>
                        <h4 className="font-bold text-gray-900 text-sm md:text-base truncate w-48 md:w-64">
                          {req.employee_name || req.line_user_id}
                        </h4>
                        
                        {/* 🌟 แสดงป้ายบอกชัดเจนว่าเป็น "ขอลา" หรือ "ขอยกเลิก" */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block">
                            {getLeaveTypeName(req.leave_type)}
                          </span>
                          {req.status === "cancel_pending" && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <AlertCircle size={10} /> ขอยกเลิก
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-100">
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-1.5">
                        <Calendar size={14} /> วันที่เริ่ม: {req.start_date}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-1.5">
                        <Clock size={14} />{" "}
                        {getLeaveFormatName(req.leave_format, req.half_day_period, req.start_time, req.end_time)}
                      </p>
                      <p className="text-xs text-gray-700 font-medium border-t border-gray-200 pt-1.5 mt-1.5">
                        เหตุผล: {req.reason}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(req.id, "reject")}
                        className="cursor-pointer flex-1 py-3 rounded-xl border border-red-200 text-red-500 font-bold text-xs md:text-sm hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center gap-1"
                      >
                        <XCircle size={16} /> ไม่อนุมัติ
                      </button>
                      <button
                        onClick={() => handleApprove(req.id, "approve")}
                        className="cursor-pointer flex-1 py-3 rounded-xl bg-green-500 text-white font-bold text-xs md:text-sm hover:bg-green-600 shadow-md shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 size={16} /> อนุมัติ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
