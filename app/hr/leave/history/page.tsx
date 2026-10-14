"use client";
import BackButton from "@/components/BackButton";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Calendar,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  ClipboardList,
  Parasol,
  HeartPulse,
  Ban,
  AlertTriangle // 🌟 เพิ่มไอคอนเตือนสำหรับ Popup
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import LoadingScreen from "@/components/LoadingScreen";
import { createPortal } from "react-dom"; // 🌟 ใช้ createPortal ให้ Popup ทับทุกสิ่ง

export default function LeaveHistoryPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<any>(null);
  const [leaveList, setLeaveList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  const [isMounted, setIsMounted] = useState(false);

  // 🌟 State สำหรับจัดการ Popup ยืนยันการยกเลิก
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    id: "",
    newStatus: "",
    title: "",
    message: "",
    subMessage: "",
    successMsg: ""
  });
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const empData = localStorage.getItem("employee_data");
    if (empData) {
      const parsedEmp = JSON.parse(empData);
      setEmployee(parsedEmp);
      fetchLeaveHistory(parsedEmp.line_user_id);
    } else {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    if (employee) {
      fetchLeaveHistory(employee.line_user_id, filterStartDate, filterEndDate);
    }
  }, [filterStartDate, filterEndDate, employee]);

  const fetchLeaveHistory = async (
    lineUserId: string,
    start?: string,
    end?: string,
  ) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("leave_requests")
        .select("*")
        .eq("line_user_id", lineUserId)
        .order("created_at", { ascending: false });

      if (start) query = query.gte("start_date", start);
      if (end) query = query.lte("start_date", end);

      const { data, error } = await query;
      if (error) throw error;
      setLeaveList(data || []);
    } catch (error) {
      console.error(error);
      toast.error("ไม่สามารถดึงประวัติการลาได้");
    } finally {
      setIsLoading(false);
    }
  };

  // 🌟 ฟังก์ชันเมื่อกดปุ่มยกเลิก (เปลี่ยนมาเปิด Popup แทน window.confirm)
  const handleCancelClick = (id: string, currentStatus: string) => {
    if (currentStatus === "pending") {
      setConfirmModal({
        isOpen: true,
        id,
        newStatus: "cancelled",
        title: "ยกเลิกคำขอลางาน?",
        message: "คุณต้องการยกเลิกคำขอนี้ใช่หรือไม่?",
        subMessage: "(คำขอจะถูกยกเลิกทันที เนื่องจากยังไม่ได้รับการอนุมัติ)",
        successMsg: "ยกเลิกคำขอเรียบร้อยแล้ว"
      });
    } else if (currentStatus === "approved") {
      setConfirmModal({
        isOpen: true,
        id,
        newStatus: "cancel_pending",
        title: "ส่งคำขอยกเลิกวันลา?",
        message: "คุณต้องการส่งเรื่องขอยกเลิกใช่หรือไม่?",
        subMessage: "(ระบบจะส่งเรื่องให้หัวหน้าอนุมัติ เพื่อคืนโควตาวันลาให้คุณ)",
        successMsg: "ส่งคำขอยกเลิกเรียบร้อย รอหัวหน้าอนุมัติ"
      });
    }
  };

  // 🌟 ฟังก์ชันยืนยันการยกเลิก (เมื่อกดยืนยันใน Popup)
  const executeCancelLeave = async () => {
    const { id, newStatus, successMsg } = confirmModal;
    setIsCancelling(true);

    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;
      
      toast.success(successMsg);
      // รีเฟรชข้อมูลหน้าจอ
      setLeaveList(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการยกเลิก");
    } finally {
      setIsCancelling(false);
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold flex items-center gap-1.5 w-fit">
            <CheckCircle2 size={14} /> อนุมัติแล้ว
          </span>
        );
      case "rejected":
        return (
          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold flex items-center gap-1.5 w-fit">
            <XCircle size={14} /> ไม่อนุมัติ
          </span>
        );
      case "cancel_pending":
        return (
          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold flex items-center gap-1.5 w-fit">
            <Loader2 size={14} className="animate-spin" /> รออนุมัติยกเลิก
          </span>
        );
      case "cancelled":
        return (
          <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold flex items-center gap-1.5 w-fit">
            <Ban size={14} /> ยกเลิกแล้ว
          </span>
        );
      default:
        return (
          <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold flex items-center gap-1.5 w-fit">
            <AlertCircle size={14} /> รอการอนุมัติ
          </span>
        );
    }
  };

  const getLeaveTypeInfo = (type: string) => {
    switch (type) {
      case "personal":
        return { name: "ลากิจ", icon: <ClipboardList size={16} />, colorClass: "text-blue-700 bg-blue-100" };
      case "annual":
        return { name: "พักร้อน", icon: <Parasol size={16} />, colorClass: "text-orange-700 bg-orange-100" };
      case "sick":
        return { name: "ลาป่วย", icon: <HeartPulse size={16} />, colorClass: "text-pink-700 bg-pink-100" };
      default:
        return { name: type, icon: <FileText size={16} />, colorClass: "text-gray-700 bg-gray-100" };
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
      return `ครึ่งวัน (${halfPeriod === "morning" ? "ช่วงเช้า" : "ช่วงบ่าย"})`;
    if (format === "hourly") return `รายชั่วโมง (${startTime} - ${endTime} น.)`;
    return format;
  };

  if (isLoading && leaveList.length === 0) {
    return <LoadingScreen text="กำลังโหลดข้อมูล..." />;
  }

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  return (
    <div className="app-page">
      
      {/* 🌟 Popup ยืนยันการยกเลิก */}
      {isMounted && confirmModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4">
          {/* พื้นหลังทึบ */}
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => !isCancelling && setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          />
          
          {/* กล่องข้อความ */}
          <div className="relative bg-white rounded-[32px] p-6 shadow-2xl w-full max-w-[320px] mx-auto animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 ring-4 ring-red-50/50">
              <AlertTriangle size={32} strokeWidth={2.5} />
            </div>
            
            <h3 className="text-xl font-black text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-sm font-bold text-gray-700 mb-1">{confirmModal.message}</p>
            <p className="text-[11px] text-gray-500 font-medium mb-8 leading-relaxed">
              {confirmModal.subMessage}
            </p>
            
            <div className="flex gap-3 w-full">
              <button 
                disabled={isCancelling}
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl transition-colors active:scale-95 disabled:opacity-50"
              >
                ย้อนกลับ
              </button>
              <button 
                disabled={isCancelling}
                onClick={executeCancelLeave}
                className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-colors shadow-md shadow-red-500/20 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isCancelling ? <Loader2 size={18} className="animate-spin" /> : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Header */}
      <div
        className="pt-12 pb-20 md:pb-24 bg-cover bg-center relative overflow-hidden bg-blue-600 shrink-0 z-10"
        style={{ backgroundImage: `url('/img/bg-head.jpg')` }}
      >
        <div className="absolute inset-0 bg-blue-600/90 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
        <div className="px-6 md:px-10 flex items-center justify-between relative z-20">
          <BackButton fallback="/hr" className="cursor-pointer w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white active:scale-95 transition-all shadow-sm" />
          <h1 className="text-base md:text-lg font-bold text-white absolute left-1/2 -translate-x-1/2 drop-shadow-md">
            ประวัติการลางาน
          </h1>
          <div className="w-10"></div>
        </div>
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-20">
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

      <div className="px-6 md:px-10 relative z-30 shrink-0 -mt-10 md:-mt-12">
        <div className="bg-white p-4 md:p-5 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-2 md:gap-4 w-full">
          <div className="flex-1">
            <label className="text-[10px] md:text-xs font-bold text-gray-400 ml-1 mb-1 block">
              เริ่มวันที่
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="cursor-pointer w-full text-xs md:text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 md:px-4 md:py-3 text-gray-900 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] md:text-xs font-bold text-gray-400 ml-1 mb-1 block">
              ถึงวันที่
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="cursor-pointer w-full text-xs md:text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 md:px-4 md:py-3 text-gray-900 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 md:px-10 pt-4 pb-8 overflow-y-auto custom-scrollbar relative z-20">
        
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
          </div>
        ) : leaveList.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100 flex flex-col items-center mt-4">
            <FileText size={48} className="text-gray-300 mb-3" />
            <h3 className="text-gray-900 font-bold mb-1">ไม่พบข้อมูลการลา</h3>
            <p className="text-xs text-gray-500">
              ในช่วงเวลาที่คุณระบุ หรือยังไม่เคยส่งคำขอลางาน
            </p>
          </div>
        ) : (
          <div className="space-y-4 md:grid md:grid-cols-2 md:space-y-0 md:gap-4">
            {leaveList.map((item) => {
              const typeInfo = getLeaveTypeInfo(item.leave_type);
              const daysText = item.total_days === 0.5 ? "ครึ่งวัน" : item.total_days === 0.125 ? "ราย ชม." : `${item.total_days || "-"} วัน`;

              const itemStartDate = new Date(item.start_date);
              itemStartDate.setHours(0, 0, 0, 0);
              const isPastDate = todayDate > itemStartDate;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 flex flex-col justify-between hover:border-blue-200 hover:shadow-md transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`font-bold text-sm px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${typeInfo.colorClass}`}>
                        {typeInfo.icon}
                        {typeInfo.name}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>

                    <div className="space-y-2 mb-4 text-xs md:text-sm text-gray-600 bg-gray-50/80 p-4 rounded-xl border border-gray-100">
                      
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className="text-blue-500 shrink-0" />
                          <span>
                            <strong>{item.start_date}</strong>{" "}
                            {item.end_date && item.end_date !== item.start_date
                              ? `ถึง ${item.end_date}`
                              : ""}
                          </span>
                        </div>
                        <div className="text-blue-600 font-black bg-blue-100/50 px-2.5 py-1 rounded-md shrink-0">
                           {daysText}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-gray-500 text-[11px] md:text-xs pt-1">
                          <Clock size={14} className="shrink-0" />
                          <span>
                            รูปแบบ: {getLeaveFormatName(
                              item.leave_format,
                              item.half_day_period,
                              item.start_time,
                              item.end_time,
                            )}
                          </span>
                      </div>
                      
                      <p className="border-t border-gray-200 pt-2.5 mt-2.5 text-gray-700 leading-relaxed">
                        <strong className="text-gray-900">เหตุผล:</strong> {item.reason}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <div className="text-[10px] text-gray-400 font-medium">
                      ส่งเมื่อ: {new Date(item.created_at).toLocaleDateString("th-TH")}
                    </div>
                    
                    {/* 🌟 เรียกใช้ handleCancelClick ที่เปิด Modal */}
                    {item.status === "pending" && (
                      <button 
                        onClick={() => handleCancelClick(item.id, "pending")}
                        className="cursor-pointer text-[11px] font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors active:scale-95"
                      >
                        ยกเลิกคำขอ
                      </button>
                    )}
                    
                    {item.status === "approved" && (
                      isPastDate ? (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                          <Ban size={12} /> หมดเวลายกเลิก
                        </span>
                      ) : (
                        <button 
                          onClick={() => handleCancelClick(item.id, "approved")}
                          className="cursor-pointer text-[11px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors active:scale-95"
                        >
                          ขอยกเลิกวันลา
                        </button>
                      )
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}