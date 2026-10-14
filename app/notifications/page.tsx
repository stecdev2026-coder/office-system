"use client";
import BackButton from "@/components/BackButton";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Bell,
  CheckCheck,
  Megaphone,
  CalendarCheck,
  CalendarX,
  Settings,
  Info,
  Loader2,
  ClipboardList,
  Trash2
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { createPortal } from "react-dom"; // 🌟 นำเข้า createPortal สำหรับ Popup

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<"all" | "unread">("unread");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🌟 State สำหรับ Popup
  const [isMounted, setIsMounted] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const empData = localStorage.getItem("employee_data");
    if (empData) {
      const parsedEmp = JSON.parse(empData);
      setEmployee(parsedEmp);
      fetchNotifications(parsedEmp.line_user_id);
    } else {
      router.push("/login");
    }
  }, [router]);

  const fetchNotifications = async (lineUserId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("line_user_id", lineUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error(error);
      toast.error("ไม่สามารถดึงข้อมูลการแจ้งเตือนได้");
    } finally {
      setIsLoading(false);
    }
  };

  const markAllAsRead = async () => {
    if (!employee) return;
    
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("line_user_id", employee.line_user_id)
      .eq("is_read", false);
      
    toast.success("อัปเดตเป็นอ่านแล้วทั้งหมด");
  };

  // 🌟 ฟังก์ชันเปิด Popup ยืนยันการลบ
  const handleClearClick = () => {
    setIsConfirmModalOpen(true);
  };

  // 🌟 ฟังก์ชันทำการลบจริง (เมื่อกดยืนยันใน Popup)
  const executeClearRead = async () => {
    if (!employee) return;
    setIsDeleting(true);

    try {
      // ลบจากตารางในฐานข้อมูลแบบ Hard Delete
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("line_user_id", employee.line_user_id)
        .eq("is_read", true);

      if (error) throw error;
      
      // เอาออกจากหน้าจอทันที
      setNotifications((prev) => prev.filter((n) => !n.is_read));
      toast.success("ลบการแจ้งเตือนที่อ่านแล้วเรียบร้อย");
      
    } catch (error) {
      console.error("Error deleting notifications:", error);
      toast.error("เกิดข้อผิดพลาดในการลบการแจ้งเตือน");
    } finally {
      setIsDeleting(false);
      setIsConfirmModalOpen(false);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      await supabase.from("notifications").update({ is_read: true }).eq("id", notif.id);
    }

    if (notif.type === "leave_request_pending" || notif.type === "cancel_request_pending") {
      router.push("/hr/leave");
    } else if (notif.type === "leave_approved" || notif.type === "leave_rejected") {
      router.push("/hr/leave/history");
    }
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'เมื่อสักครู่';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} นาทีที่แล้ว`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ชั่วโมงที่แล้ว`;
    return `${Math.floor(diffInSeconds / 86400)} วันที่แล้ว`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "leave_approved":
        return { icon: <CalendarCheck size={20} />, bg: "bg-green-100", text: "text-green-600" };
      case "leave_rejected":
        return { icon: <CalendarX size={20} />, bg: "bg-red-100", text: "text-red-500" };
      case "leave_request_pending":
      case "cancel_request_pending":
        return { icon: <ClipboardList size={20} />, bg: "bg-blue-100", text: "text-blue-600" };
      case "announcement":
        return { icon: <Megaphone size={20} />, bg: "bg-orange-100", text: "text-orange-500" };
      case "system":
        return { icon: <Settings size={20} />, bg: "bg-gray-100", text: "text-gray-600" };
      default:
        return { icon: <Info size={20} />, bg: "bg-blue-100", text: "text-blue-500" };
    }
  };

  const displayNotifications = activeTab === "all" 
    ? notifications 
    : notifications.filter(n => !n.is_read);

  const hasReadNotifications = notifications.some(n => n.is_read);

  return (
    <div className="app-page">
      
      {/* 🌟 Popup ยืนยันการลบที่อ่านแล้ว */}
      {isMounted && isConfirmModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4">
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => !isDeleting && setIsConfirmModalOpen(false)}
          />
          <div className="relative bg-white rounded-[32px] p-6 shadow-2xl w-full max-w-[320px] mx-auto animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 ring-4 ring-red-50/50">
              <Trash2 size={32} strokeWidth={2.5} />
            </div>
            
            <h3 className="text-xl font-black text-gray-900 mb-2">ลบการแจ้งเตือน?</h3>
            <p className="text-sm font-bold text-gray-700 mb-1">คุณต้องการลบที่ "อ่านแล้ว" ใช่หรือไม่?</p>
            <p className="text-[11px] text-gray-500 font-medium mb-8 leading-relaxed">
              (ข้อมูลที่ถูกลบไปแล้วจะไม่สามารถกู้คืนได้)
            </p>
            
            <div className="flex gap-3 w-full">
              <button 
                disabled={isDeleting}
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                ย้อนกลับ
              </button>
              <button 
                disabled={isDeleting}
                onClick={executeClearRead}
                className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-colors shadow-md shadow-red-500/20 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
              >
                {isDeleting ? <Loader2 size={18} className="animate-spin" /> : "ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Header */}
      <div
        className="pt-12 pb-16 md:pb-20 bg-cover bg-center relative overflow-hidden bg-blue-600 shrink-0 z-10"
        style={{ backgroundImage: `url('/img/bg-head.jpg')` }}
      >
        <div className="absolute inset-0 bg-blue-600/90 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
        <div className="px-6 md:px-10 flex items-center justify-between relative z-20">
          <BackButton fallback="/" className="cursor-pointer w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white active:scale-95 transition-all shadow-sm" />
          <h1 className="text-base md:text-lg font-bold text-white absolute left-1/2 -translate-x-1/2 drop-shadow-md">
            การแจ้งเตือน
          </h1>
          <div className="w-10"></div>
        </div>
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-20">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full h-8 sm:h-12 md:h-16 block" preserveAspectRatio="none">
            <path fill="#FAFAFA" d="M0,120 C480,0 960,0 1440,120 L1440,120 L0,120 Z"></path>
          </svg>
        </div>
      </div>

      {/* เครื่องมือจัดการ (Tabs + Action Buttons) */}
      <div className="px-6 md:px-10 relative z-30 shrink-0 -mt-8 md:-mt-10">
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex bg-gray-50 p-1 rounded-xl w-2/3 md:w-1/2">
            <button
              onClick={() => setActiveTab("all")}
              className={`cursor-pointer flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${
                activeTab === "all" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setActiveTab("unread")}
              className={`cursor-pointer flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${
                activeTab === "unread" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              ยังไม่อ่าน
            </button>
          </div>
          
          <div className="flex items-center gap-1 md:gap-3 pr-1 md:pr-2">
            <button 
              onClick={markAllAsRead}
              title="อ่านทั้งหมด"
              className="text-gray-400 hover:text-blue-500 p-1.5 md:p-2 cursor-pointer transition-colors active:scale-95 bg-gray-50 hover:bg-blue-50 rounded-lg"
            >
              <CheckCheck size={18} />
            </button>
            {hasReadNotifications && (
              <button 
                onClick={handleClearClick} // 🌟 เปลี่ยนมาเรียก Popup แทน
                title="ลบที่อ่านแล้ว"
                className="text-gray-400 hover:text-red-500 p-1.5 md:p-2 cursor-pointer transition-colors active:scale-95 bg-gray-50 hover:bg-red-50 rounded-lg"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* รายการแจ้งเตือน */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-10 pt-4 pb-8 relative z-20">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
          </div>
        ) : displayNotifications.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100 flex flex-col items-center mt-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4">
              <Bell size={32} />
            </div>
            <h3 className="text-gray-900 font-bold mb-1">ไม่มีการแจ้งเตือน</h3>
            <p className="text-xs text-gray-500">
              {activeTab === "unread" ? "คุณอ่านการแจ้งเตือนครบหมดแล้ว" : "ยังไม่มีความเคลื่อนไหวใดๆ ในขณะนี้"}
            </p>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {displayNotifications.map((notif) => {
              const style = getNotificationIcon(notif.type);
              
              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`relative p-4 md:p-5 rounded-[24px] border transition-all cursor-pointer hover:shadow-md ${
                    notif.is_read 
                      ? "bg-white border-gray-100" 
                      : "bg-blue-50/40 border-blue-100 hover:border-blue-200"
                  }`}
                >
                  {!notif.is_read && (
                    <div className="absolute top-4 md:top-5 right-4 md:right-5 w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-50"></div>
                  )}

                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}>
                      {style.icon}
                    </div>
                    <div className="flex-1 pr-4">
                      <h4 className={`text-sm md:text-base font-bold mb-1 ${notif.is_read ? "text-gray-700" : "text-gray-900"}`}>
                        {notif.title}
                      </h4>
                      <p className={`text-xs md:text-sm mb-2 leading-relaxed ${notif.is_read ? "text-gray-500" : "text-gray-600 font-medium"}`}>
                        {notif.message}
                      </p>
                      <span className="text-[10px] md:text-xs font-bold text-gray-400">
                        {getRelativeTime(notif.created_at)}
                      </span>
                    </div>
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