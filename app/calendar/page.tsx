"use client";
import BackButton from "@/components/BackButton";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  CalendarDays, 
  Clock, 
  X, 
  Loader2, 
  Calendar as CalendarIcon, 
  AlignLeft
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { createPortal } from "react-dom";

// 🌟 เรียกใช้ CalendarView
import CalendarView from "@/components/CalendarView";

export default function CalendarPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<any>(null);

  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // State สำหรับ Modal เพิ่มนัดหมาย (Add)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🌟 State สำหรับ Modal ดูข้อมูล (View)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventType, setEventType] = useState("general");

  useEffect(() => {
    setIsMounted(true);
    const empData = localStorage.getItem("employee_data");
    if (empData) {
      setEmployee(JSON.parse(empData));
      fetchEvents();
    } else {
      router.push("/login");
    }
  }, [router]);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .order("start_time", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Fetch Error:", error);
      toast.error("ไม่สามารถดึงข้อมูลปฏิทินได้");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStartTime("");
    setEndTime("");
    setEventType("general");
  };

  const openAddModal = (dateStr: string) => {
    resetForm();
    setSelectedDate(dateStr);
    setEndDate(dateStr);
    setIsAddModalOpen(true);
  };

  // 🌟 ฟังก์ชันเมื่อกดคลิกที่ตัวกิจกรรม (Event)
  const handleEventClick = (evt: any) => {
    setSelectedEvent(evt);
    setIsViewModalOpen(true); // เปิดหน้าต่าง View Modal
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return toast.error("ไม่พบข้อมูลผู้ใช้งาน");
    if (endDate < selectedDate) return toast.error("วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น");
    setIsSubmitting(true);

    try {
      const payload = {
        line_user_id: employee.line_user_id,
        title: title,
        description: description || null,
        event_date: selectedDate,
        end_date: endDate,
        start_time: startTime || null,
        end_time: endTime || null,
        event_type: eventType
      };

      const { error } = await supabase.from("calendar_events").insert([payload]);

      if (error) throw error;

      toast.success("บันทึกคิวงานสำเร็จ!");
      setIsAddModalOpen(false);
      resetForm();
      fetchEvents(); 
    } catch (error: any) {
      console.error("Supabase Insert Error:", error);
      toast.error(`บันทึกไม่สำเร็จ: ${error?.message || "โปรดเช็คฐานข้อมูล"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ฟังก์ชันแปลงวันที่ให้สวยงาม
  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });
  };

  // ฟังก์ชันกำหนดสไตล์ตามประเภทงาน
  const getEventStyle = (type: string) => {
    switch (type) {
      case "meeting": return { label: "ประชุม", color: "text-blue-700 bg-blue-100", border: "border-blue-200" };
      case "holiday": return { label: "วันหยุด", color: "text-red-700 bg-red-100", border: "border-red-200" };
      default: return { label: "ทั่วไป", color: "text-green-700 bg-green-100", border: "border-green-200" };
    }
  };

  return (
    <div className="app-page">
      
      {/* 🌟 1. Modal ดูรายละเอียดข้อมูล (View Modal) */}
      {isMounted && isViewModalOpen && selectedEvent && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4">
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsViewModalOpen(false)}
          />
          <div className="relative bg-white rounded-3xl w-full max-w-sm md:max-w-md shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
            
            {/* Header ของ Modal (ปุ่มปิด) */}
            <div className="flex justify-end p-4 pb-0">
              <button 
                onClick={() => setIsViewModalOpen(false)} 
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* เนื้อหาข้อมูล */}
            <div className="px-6 pb-8">
              {/* ป้ายประเภทงาน */}
              <div className="mb-3">
                <span className={`text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-md border ${getEventStyle(selectedEvent.event_type).color} ${getEventStyle(selectedEvent.event_type).border}`}>
                  {getEventStyle(selectedEvent.event_type).label}
                </span>
              </div>
              
              {/* หัวข้อ */}
              <h3 className="font-black text-gray-900 text-xl md:text-2xl mb-5 leading-tight">
                {selectedEvent.title}
              </h3>

              <div className="space-y-4">
                {/* วันที่ */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                    <CalendarIcon size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold mb-0.5">วันที่จัดงาน</p>
                    <p className="text-sm md:text-base font-bold text-gray-900">{formatThaiDate(selectedEvent.event_date)}{selectedEvent.end_date&&selectedEvent.end_date!==selectedEvent.event_date?` – ${formatThaiDate(selectedEvent.end_date)}`:''}</p>
                  </div>
                </div>

                {/* เวลา */}
                {selectedEvent.start_time && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold mb-0.5">เวลา</p>
                      <p className="text-sm md:text-base font-bold text-gray-900">
                        {selectedEvent.start_time.substring(0, 5)} น. 
                        {selectedEvent.end_time ? ` - ${selectedEvent.end_time.substring(0, 5)} น.` : ""}
                      </p>
                    </div>
                  </div>
                )}

                {/* รายละเอียด */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                    <AlignLeft size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 font-bold mb-0.5">รายละเอียดเพิ่มเติม</p>
                    <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 mt-1 whitespace-pre-wrap">
                      {selectedEvent.description || <span className="text-gray-400 italic">ไม่มีรายละเอียดระบุไว้</span>}
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 🌟 2. Modal เพิ่มนัดหมาย (Add Modal) */}
      {isMounted && isAddModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4">
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => !isSubmitting && setIsAddModalOpen(false)}
          />
          <div className="relative bg-white rounded-3xl w-full max-w-md md:max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-blue-50/50">
              <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <CalendarDays size={20} className="text-blue-600" /> เพิ่มนัดหมาย
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all cursor-pointer shadow-sm">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddEvent} className="p-5 md:p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
                <div><label className="text-xs font-bold text-gray-500 mb-1.5 block">วันเริ่มต้น</label><input type="date" value={selectedDate} onChange={(e) => {setSelectedDate(e.target.value);if(!endDate||endDate<e.target.value)setEndDate(e.target.value);}} required className="w-full text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500" /></div>
                <div><label className="text-xs font-bold text-gray-500 mb-1.5 block">วันสิ้นสุด</label><input type="date" min={selectedDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500" /></div>
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">หัวข้อ/ชื่องาน</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ประชุมทีม, นัดพบลูกค้า" required className="w-full text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1"><Clock size={12} /> เวลาเริ่ม</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1"><Clock size={12} /> เวลาสิ้นสุด</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">ประเภท</label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setEventType("general")} className={`py-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${eventType === "general" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-100 bg-white text-gray-500"}`}>ทั่วไป</button>
                  <button type="button" onClick={() => setEventType("meeting")} className={`py-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${eventType === "meeting" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-100 bg-white text-gray-500"}`}>ประชุม</button>
                  <button type="button" onClick={() => setEventType("holiday")} className={`py-2 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${eventType === "holiday" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-100 bg-white text-gray-500"}`}>วันหยุด</button>
                </div>
              </div>
              <div className="mb-6">
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">รายละเอียดเพิ่มเติม</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="สถานที่, ลิงก์ประชุม, ฯลฯ" className="w-full text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-blue-500 h-20 resize-none" />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-md shadow-blue-500/30 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "บันทึกคิวงาน"}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Header ของหน้าหลัก */}
      <div
        className="pt-12 pb-16 md:pb-20 bg-cover bg-center relative overflow-hidden bg-blue-600 shrink-0 z-10"
        style={{ backgroundImage: `url('/img/bg-head.jpg')` }}
      >
        <div className="absolute inset-0 bg-blue-600/90 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
        <div className="px-6 md:px-10 flex items-center justify-between relative z-20">
          <BackButton fallback="/" className="cursor-pointer w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white active:scale-95 transition-all shadow-sm" />
          <h1 className="text-base md:text-lg font-bold text-white absolute left-1/2 -translate-x-1/2 drop-shadow-md">
            ปฏิทินส่วนกลาง
          </h1>
          <div className="w-10"></div>
        </div>
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-20">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full h-8 sm:h-12 md:h-16 block" preserveAspectRatio="none">
            <path fill="#FAFAFA" d="M0,120 C480,0 960,0 1440,120 L1440,120 L0,120 Z"></path>
          </svg>
        </div>
      </div>

      {/* เรียกใช้ Component CalendarView */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-4 pb-8 relative z-30 shrink-0 -mt-6 md:-mt-8">
        <CalendarView 
          events={events} 
          isLoading={isLoading} 
          onDateClick={openAddModal} 
          onEventClick={handleEventClick} 
        />
      </div>
    </div>
  );
}
