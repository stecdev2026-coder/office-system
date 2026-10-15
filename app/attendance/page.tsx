"use client";
import BackButton from "@/components/BackButton";
import LoadingScreen from "@/components/LoadingScreen";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, Calendar, Filter, ChevronRight,
  CheckCircle2, AlertCircle, LogIn, LogOut, MapPin, X,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { createClient } from '@/utils/supabase/client';

export default function AttendancePage() {
  const router = useRouter();
  const supabase = createClient();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [employee, setEmployee] = useState<any>(null);
  
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterMode, setFilterMode] = useState<'billing' | 'custom'>('billing');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; 

  // 🌟 State สำหรับเปิด Popup รายละเอียด
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  const calculateBillingCycle = () => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let start, end;
    if (currentDay > 20) {
      start = new Date(currentYear, currentMonth, 21);
      end = new Date(currentYear, currentMonth + 1, 20);
    } else {
      start = new Date(currentYear, currentMonth - 1, 21);
      end = new Date(currentYear, currentMonth, 20);
    }

    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    return { startStr: formatDate(start), endStr: formatDate(end) };
  };

  useEffect(() => {
    const empData = localStorage.getItem("employee_data");
    if (empData) {
      const parsedEmp = JSON.parse(empData);
      setEmployee(parsedEmp);
      
      const { startStr, endStr } = calculateBillingCycle();
      setStartDate(startStr);
      setEndDate(endStr);
      
      loadAttendanceHistory(parsedEmp.line_user_id, startStr, endStr);
    } else {
      router.push("/login");
    }
  }, [router]);

  const loadAttendanceHistory = async (lineUserId: string, start: string, end: string) => {
    if (!start || !end) return;
    setIsLoading(true);
    setCurrentPage(1);

    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('line_user_id', lineUserId)
        .gte('work_date', start)
        .lte('work_date', end)
        .order('work_date', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      toast.error('ไม่สามารถดึงข้อมูลประวัติการลงเวลาได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (employee && startDate && endDate) {
      loadAttendanceHistory(employee.line_user_id, startDate, endDate);
    }
  }, [filterMode, startDate, endDate]);

  const handleFilterModeChange = (mode: 'billing' | 'custom') => {
    setFilterMode(mode);
    if (mode === 'billing') {
      const { startStr, endStr } = calculateBillingCycle();
      setStartDate(startStr);
      setEndDate(endStr);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Present' || status === 'on_time') {
      return <span className="bg-green-100 text-green-700 px-2.5 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold flex items-center gap-1"><CheckCircle2 size={12} /> ปกติ</span>;
    } else if (status === 'late') {
      return <span className="bg-orange-100 text-orange-700 px-2.5 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold flex items-center gap-1"><AlertCircle size={12} /> มาสาย</span>;
    }
    return <span className="bg-gray-100 text-gray-700 px-2.5 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold">{status || 'ไม่มีสถานะ'}</span>;
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return "-";
    const date = new Date(timeString);
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentHistory = history.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(history.length / itemsPerPage);

 return (
    <div className="app-page">
      
      {/* Header */}
      <div className="pt-12 md:pt-16 pb-16 md:pb-20 bg-cover bg-center relative overflow-hidden bg-blue-50 shrink-0" style={{ backgroundImage: `url('/img/bg-head.jpg')` }}>
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]"></div>
        <div className="px-6 md:px-10 flex items-center justify-between relative z-10">
          <BackButton fallback="/" className="cursor-pointer w-10 h-10 md:w-12 md:h-12 bg-white/90 backdrop-blur-md border border-white/50 rounded-full flex items-center justify-center text-gray-700 active:scale-95 transition-all shadow-sm" />
          <h1 className="text-base md:text-lg font-bold text-gray-900 absolute left-1/2 -translate-x-1/2 drop-shadow-md">ประวัติการลงเวลา</h1>
          <div className="w-10 md:w-12"></div>
        </div>
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" className="w-full h-8 sm:h-12 md:h-16 block" preserveAspectRatio="none"><path fill="#FAFAFA" d="M0,120 C480,0 960,0 1440,120 L1440,120 L0,120 Z"></path></svg>
        </div>
      </div>

      {/* Filter Section */}
      <div className="px-6 md:px-10 -mt-6 md:-mt-8 relative z-20 shrink-0 mb-2">
        <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex bg-gray-50 p-1 rounded-2xl md:w-1/2">
            <button onClick={() => handleFilterModeChange('billing')} className={`cursor-pointer flex-1 py-2 md:py-3 text-xs md:text-sm font-bold rounded-xl transition-all ${filterMode === 'billing' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>รอบเดือนปัจจุบัน</button>
            <button onClick={() => handleFilterModeChange('custom')} className={`cursor-pointer flex-1 py-2 md:py-3 text-xs md:text-sm font-bold rounded-xl transition-all ${filterMode === 'custom' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>ระบุวันที่</button>
          </div>
          
          {filterMode === 'custom' && (
            <div className="flex items-center gap-2 md:gap-4 md:w-1/2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex-1">
                <label className="text-[10px] md:text-xs font-bold text-gray-400 ml-1 mb-1 block">เริ่มวันที่</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="cursor-pointer w-full text-xs md:text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 md:px-4 py-2 md:py-3 text-gray-700 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] md:text-xs font-bold text-gray-400 ml-1 mb-1 block">ถึงวันที่</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="cursor-pointer w-full text-xs md:text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 md:px-4 py-2 md:py-3 text-gray-700 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-10 pt-2 pb-4">
        {isLoading ? (
          <LoadingScreen text="กำลังโหลดประวัติ…"/>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 md:p-16 text-center shadow-sm border border-gray-100 flex flex-col items-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4 md:mb-6"><Filter size={32} className="md:w-10 md:h-10" /></div>
            <h3 className="text-gray-900 font-bold md:text-lg mb-1 md:mb-2">ไม่พบข้อมูล</h3>
            <p className="text-xs md:text-sm text-gray-500">ไม่มีประวัติการลงเวลาในช่วงวันที่เลือก</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {currentHistory.map((record) => (
              <div 
                key={record.id} 
                onClick={() => setSelectedRecord(record)} // 🌟 กดเพื่อเปิด Popup
                className="bg-white p-4 md:p-5 rounded-[20px] shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all active:scale-[0.98]"
              >
                
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="font-bold text-gray-900 text-[13px] md:text-[14px] flex items-center gap-2">
                    <Calendar size={14} className="text-blue-500 md:w-4 md:h-4" />
                    {formatDateDisplay(record.work_date)}
                  </h3>
                  {getStatusBadge(record.status)}
                </div>
                
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="flex-1 bg-gray-50/80 rounded-xl p-2.5 md:p-3 flex items-center gap-2.5 border border-gray-100">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      <LogIn size={16} strokeWidth={2.5} className="md:w-5 md:h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] md:text-[11px] text-gray-400 font-bold mb-0.5 leading-none">เวลาเข้างาน</span>
                      <span className="text-[13px] md:text-[15px] font-black text-gray-800 flex items-center gap-1.5 leading-none mt-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500"></div>
                        {formatTime(record.check_in_time)}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 bg-gray-50/80 rounded-xl p-2.5 md:p-3 flex items-center gap-2.5 border border-gray-100">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 shrink-0">
                      <LogOut size={16} strokeWidth={2.5} className="md:w-5 md:h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] md:text-[11px] text-gray-400 font-bold mb-0.5 leading-none">เวลาเลิกงาน</span>
                      <span className="text-[13px] md:text-[15px] font-black text-gray-800 flex items-center gap-1.5 leading-none mt-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-gray-300"></div>
                        {formatTime(record.check_out_time)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-center text-[10px] md:text-xs text-blue-500 font-bold">
                  กดดูรายละเอียด &rarr;
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!isLoading && history.length > 0 && totalPages > 1 && (
        <div className="px-6 md:px-10 pt-3 pb-6 shrink-0 bg-[#FAFAFA] flex justify-center border-t border-gray-100">
          <div className="flex items-center gap-3 md:gap-4">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-white border border-gray-200 text-gray-600 disabled:opacity-30 disabled:border-gray-100 disabled:cursor-not-allowed hover:border-blue-300 hover:text-blue-600 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <ChevronLeft size={18} className="md:w-5 md:h-5" />
            </button>
            
            <span className="text-xs md:text-sm font-bold text-gray-600 min-w-[70px] md:min-w-[90px] text-center">
              หน้า {currentPage}/{totalPages}
            </span>
            
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
              disabled={currentPage === totalPages}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-white border border-gray-200 text-gray-600 disabled:opacity-30 disabled:border-gray-100 disabled:cursor-not-allowed hover:border-blue-300 hover:text-blue-600 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <ChevronRight size={18} className="md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      )}

      {/* 🌟 Popup แสดงรายละเอียดการลงเวลา (ดีดทะลุเมนูด้วย Portal) */}
      {isMounted && selectedRecord && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4">
          {/* Overlay พื้นหลังดำ */}
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedRecord(null)}
          />
          
          {/* กล่อง Modal */}
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm mx-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">รายละเอียดลงเวลา</h2>
              <button 
                onClick={() => setSelectedRecord(null)}
                className="w-8 h-8 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl mb-6">
              <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Calendar size={16} className="text-blue-500" />
                {formatDateDisplay(selectedRecord.work_date)}
              </span>
              {getStatusBadge(selectedRecord.status)}
            </div>

            {/* ส่วนข้อมูล Scroll ได้เผื่อเนื้อหายาว */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 px-1">
              
              {/* 🌟 ข้อมูลการเข้างาน */}
              <div className="relative pl-8">
                {/* ขยับเส้นและจุดเข้ามาด้านในด้วยค่าบวก (left-2, left-[3px]) */}
                <div className="absolute left-2 top-0 bottom-[-20px] w-0.5 bg-blue-100"></div>
                <div className="absolute left-[3px] top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white"></div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">เข้างาน</h3>
                
                <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-sm shrink-0">
                      <Clock size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold mb-0.5">เวลาที่ลง</p>
                      <p className="text-sm font-black text-gray-900">{formatTime(selectedRecord.check_in_time)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 pt-2 border-t border-blue-100">
                    <div className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-sm shrink-0">
                      <MapPin size={16} strokeWidth={2.5} />
                    </div>
                    <div className="w-full">
                      <p className="text-[10px] text-gray-500 font-bold mb-0.5">สถานที่ / พิกัด</p>
                      
                      {/* 📍 ดึงพิกัดจากฐานข้อมูลมาเป็นลิงก์ Google Maps */}
                      {selectedRecord.check_in_lat && selectedRecord.check_in_lng ? (
                        <a 
                          href={`https://maps.google.com/?q=${selectedRecord.check_in_lat},${selectedRecord.check_in_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1 bg-blue-100/50 px-2 py-1 rounded-md mt-1"
                        >
                          📍 ดูบนแผนที่ ({selectedRecord.check_in_lat.toFixed(4)}, {selectedRecord.check_in_lng.toFixed(4)})
                        </a>
                      ) : (
                        <p className="text-xs font-medium text-gray-500">ไม่พบข้อมูลพิกัด</p>
                      )}

                      {/* 📸 ดึงรูปภาพเข้างาน */}
                      {selectedRecord.check_in_photo_url && (
                        <div className="mt-3 w-full h-28 rounded-xl bg-gray-200 overflow-hidden relative shadow-sm border border-gray-100">
                           <img src={selectedRecord.check_in_photo_url} alt="Check In" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 🌟 ข้อมูลการออกงาน */}
              <div className="relative pl-8 pt-2">
                {/* ขยับจุดเข้ามาด้านใน (left-[3px]) */}
                <div className="absolute left-[3px] top-3 w-3 h-3 rounded-full bg-orange-500 ring-4 ring-white"></div>
                <h3 className="text-sm font-bold text-gray-900 mb-3">ออกงาน</h3>
                
                <div className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100/50 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-white text-orange-500 flex items-center justify-center shadow-sm shrink-0">
                      <Clock size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold mb-0.5">เวลาที่ลง</p>
                      <p className="text-sm font-black text-gray-900">
                        {selectedRecord.check_out_time ? formatTime(selectedRecord.check_out_time) : "-"}
                      </p>
                    </div>
                  </div>
                  
                  {selectedRecord.check_out_time && (
                    <div className="flex items-start gap-3 pt-2 border-t border-orange-100">
                      <div className="w-8 h-8 rounded-full bg-white text-orange-500 flex items-center justify-center shadow-sm shrink-0">
                        <MapPin size={16} strokeWidth={2.5} />
                      </div>
                      <div className="w-full">
                        <p className="text-[10px] text-gray-500 font-bold mb-0.5">สถานที่ / พิกัด</p>

                        {/* 📍 ดึงพิกัดจากฐานข้อมูลมาเป็นลิงก์ Google Maps */}
                        {selectedRecord.check_out_lat && selectedRecord.check_out_lng ? (
                          <a 
                            href={`https://maps.google.com/?q=${selectedRecord.check_out_lat},${selectedRecord.check_out_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-orange-600 hover:underline inline-flex items-center gap-1 bg-orange-100/50 px-2 py-1 rounded-md mt-1"
                          >
                            📍 ดูบนแผนที่ ({selectedRecord.check_out_lat.toFixed(4)}, {selectedRecord.check_out_lng.toFixed(4)})
                          </a>
                        ) : (
                          <p className="text-xs font-medium text-gray-500">ไม่พบข้อมูลพิกัด</p>
                        )}

                        {/* 📸 ดึงรูปภาพออกงาน */}
                        {selectedRecord.check_out_photo_url && (
                          <div className="mt-3 w-full h-28 rounded-xl bg-gray-200 overflow-hidden relative shadow-sm border border-gray-100">
                             <img src={selectedRecord.check_out_photo_url} alt="Check Out" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            <button 
              onClick={() => setSelectedRecord(null)}
              className="mt-6 w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors active:scale-95 cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>,
        document.body // ส่งไปโผล่ที่ Body ทับเมนูแน่นอน 100%
      )}
    </div>
  );
}
