"use client";
import BackButton from "@/components/BackButton";
import LoadingScreen from "@/components/LoadingScreen";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Map,
  Calendar,
  MapPin,
  Navigation,
  X,
  Route,
  Filter,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
// 🌟 1. นำเข้า createPortal
import { createPortal } from "react-dom";

export default function TravelHistoryPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<any>(null);

  // 🌟 2. สร้าง State isMounted เพื่อดักจับว่าหน้าเว็บโหลดฝั่ง Client เสร็จหรือยัง ป้องกัน Error document is not defined
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [trips, setTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterMode, setFilterMode] = useState<"billing" | "custom">("billing");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

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
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
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

      loadTripsHistory(parsedEmp.line_user_id, startStr, endStr);
    } else {
      router.push("/login");
    }
  }, [router]);

  const loadTripsHistory = async (
    lineUserId: string,
    start: string,
    end: string,
  ) => {
    if (!start || !end) return;
    setIsLoading(true);
    setCurrentPage(1);

    try {
      const { data, error } = await supabase
        .from("travel_trips")
        .select("*")
        .eq("line_user_id", lineUserId)
        .gte("created_at", `${start}T00:00:00.000Z`)
        .lte("created_at", `${end}T23:59:59.999Z`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTrips(data || []);
    } catch (error) {
      toast.error("ไม่สามารถดึงข้อมูลประวัติได้");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (employee && startDate && endDate) {
      loadTripsHistory(employee.line_user_id, startDate, endDate);
    }
  }, [filterMode, startDate, endDate]);

  const handleFilterModeChange = (mode: "billing" | "custom") => {
    setFilterMode(mode);
    if (mode === "billing") {
      const { startStr, endStr } = calculateBillingCycle();
      setStartDate(startStr);
      setEndDate(endStr);
    }
  };

  const openTripDetails = async (trip: any) => {
    setSelectedTrip(trip);
    setLoadingDetails(true);
    try {
      const { data, error } = await supabase
        .from("travel_checkpoints")
        .select("*")
        .eq("trip_id", trip.id)
        .order("sequence", { ascending: true });
      if (error) throw error;
      setCheckpoints(data || []);
    } catch (error) {
      toast.error("ไม่สามารถดึงรายละเอียดเส้นทางได้");
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeTripDetails = () => {
    setSelectedTrip(null);
    setCheckpoints([]);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="bg-green-100 text-green-700 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold">
            เสร็จสิ้น
          </span>
        );
      case "in_progress":
        return (
          <span className="bg-blue-100 text-blue-700 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold">
            กำลังเดินทาง
          </span>
        );
      default:
        return (
          <span className="bg-gray-100 text-gray-700 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold">
            {status}
          </span>
        );
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTrips = trips.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(trips.length / itemsPerPage);

  return (
    <div className="app-page">
      
      {/* 🌟 3. Popup Modal ที่ใช้ createPortal โยนไปหน้าสุด (แก้ทับเมนู และอยู่กลางจอ) */}
      {isMounted && selectedTrip && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4">
          {/* Overlay พื้นหลังดำ */}
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
            onClick={closeTripDetails}
          />
          
          {/* กล่อง Modal ตรงกลางจอ */}
          <div className="relative bg-white w-full max-w-sm sm:max-w-md md:max-w-lg rounded-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden mx-auto">
            
            <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 text-lg md:text-xl line-clamp-1">
                  {selectedTrip.purpose}
                </h3>
                <p className="text-sm md:text-base text-gray-500 mt-0.5 flex items-center gap-1.5">
                  <Calendar size={16} />
                  {new Date(selectedTrip.created_at).toLocaleDateString(
                    "th-TH",
                    { year: "numeric", month: "long", day: "numeric" },
                  )}
                </p>
              </div>
              <button
                onClick={closeTripDetails}
                className="w-10 h-10 md:w-12 md:h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <X size={20} className="md:w-6 md:h-6" />
              </button>
            </div>
            
            <div className="p-5 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-2xl p-4 md:p-5 mb-6 md:mb-8">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                    <Route size={20} className="md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-[11px] md:text-sm font-bold text-blue-600">
                      ระยะทางรวม
                    </p>
                    <p className="text-lg md:text-xl font-black text-gray-900">
                      {selectedTrip.total_distance_km
                        ? `${selectedTrip.total_distance_km} กม.`
                        : "กำลังคำนวณ..."}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] md:text-sm font-bold text-blue-600">
                    ระยะทางสำหรับเบิก
                  </p>
                  <p className="text-lg md:text-xl font-black text-green-600">
                    {selectedTrip.total_allowance
                      ? `${selectedTrip.total_allowance} กม.`
                      : "-"}
                  </p>
                </div>
              </div>
              
              <h4 className="font-bold text-gray-900 text-sm md:text-base mb-5 flex items-center gap-2">
                <Map size={16} className="text-blue-500 md:w-5 md:h-5" />{" "}
                ลำดับการเดินทาง
              </h4>
              
              {loadingDetails ? (
                <LoadingScreen text="กำลังโหลดเส้นทาง…"/>
              ) : (
                <div className="relative border-l-2 border-dashed border-gray-200 ml-3 md:ml-4 space-y-7 md:space-y-8 pb-4">
                  {checkpoints.map((pt) => {
                    // 🌟 ดักจับชื่อคอลัมน์พิกัด (เผื่อใช้ lat/lng หรือ latitude/longitude)
                    const lat = pt.lat || pt.latitude;
                    const lng = pt.lng || pt.longitude;

                    return (
                      <div key={pt.id} className="relative pl-6 md:pl-8 flex flex-col">
                        <div
                          className={`absolute -left-[9px] md:-left-[11px] top-1 w-4 h-4 md:w-5 md:h-5 rounded-full border-4 border-white ${pt.point_type === "start" ? "bg-green-500" : pt.point_type === "end" ? "bg-red-500" : "bg-blue-500"}`}
                        ></div>
                        <h4 className="text-xs md:text-sm font-bold text-gray-900 flex items-center gap-2 md:gap-3">
                          {pt.point_type === "start"
                            ? "จุดเริ่มต้น"
                            : pt.point_type === "end"
                              ? "สิ้นสุดการเดินทาง"
                              : `แวะ: ${pt.note || "ไม่ระบุ"}`}
                          <span className="text-[9px] md:text-[11px] font-medium text-gray-400 bg-gray-50 px-2 md:px-3 py-0.5 md:py-1 rounded-full">
                            {new Date(pt.recorded_at).toLocaleTimeString(
                              "th-TH",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </span>
                        </h4>
                        <p className="text-[11px] md:text-sm text-gray-500 mt-1.5 line-clamp-2">
                          {pt.location_name || "ไม่ระบุชื่อสถานที่"}
                        </p>

                        {/* 🌟 เพิ่มปุ่มลิงก์ไป Google Maps ตรงนี้ครับ */}
                        {lat && lng && (
                          <a
                            href={`https://maps.google.com/?q=${lat},${lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 text-[10px] md:text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-md w-fit transition-colors hover:bg-blue-100"
                          >
                            📍 ดูบนแผนที่ ({Number(lat).toFixed(4)}, {Number(lng).toFixed(4)})
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Header ของหน้าจอหลัก */}
      <div
        className="pt-12 md:pt-16 pb-16 md:pb-20 bg-cover bg-center relative overflow-hidden bg-blue-50 shrink-0"
        style={{ backgroundImage: `url('/img/bg-head.jpg')` }}
      >
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]"></div>
        <div className="px-6 md:px-10 flex items-center justify-between relative z-10">
          <BackButton fallback="/travel" className="cursor-pointer w-10 h-10 md:w-12 md:h-12 bg-white/90 backdrop-blur-md border border-white/50 rounded-full flex items-center justify-center text-gray-700 active:scale-95 transition-all shadow-sm" />
          <h1 className="text-base md:text-lg font-bold text-gray-900 absolute left-1/2 -translate-x-1/2 drop-shadow-md">
            ประวัติการเดินทาง
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
            <path
              fill="#FAFAFA"
              d="M0,120 C480,0 960,0 1440,120 L1440,120 L0,120 Z"
            ></path>
          </svg>
        </div>
      </div>

      {/* กล่องตัวกรอง (Filter Section) */}
      <div className="px-6 md:px-10 -mt-6 md:-mt-8 relative z-20 shrink-0 mb-2">
        <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex bg-gray-50 p-1 rounded-2xl md:w-1/2">
            <button
              onClick={() => handleFilterModeChange("billing")}
              className={`cursor-pointer flex-1 py-2 md:py-3 text-xs md:text-sm font-bold rounded-xl transition-all ${filterMode === "billing" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              รอบบิลปัจจุบัน
            </button>
            <button
              onClick={() => handleFilterModeChange("custom")}
              className={`cursor-pointer flex-1 py-2 md:py-3 text-xs md:text-sm font-bold rounded-xl transition-all ${filterMode === "custom" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              ระบุวันที่
            </button>
          </div>

          {filterMode === "custom" && (
            <div className="flex items-center gap-2 md:gap-4 md:w-1/2">
              <div className="flex-1">
                <label className="text-[10px] md:text-xs font-bold text-gray-400 ml-1 mb-1 block">
                  เริ่มวันที่
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="cursor-pointer w-full text-xs md:text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 md:px-4 py-2 md:py-3 text-gray-700 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] md:text-xs font-bold text-gray-400 ml-1 mb-1 block">
                  ถึงวันที่
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="cursor-pointer w-full text-xs md:text-sm font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 md:px-4 py-2 md:py-3 text-gray-700 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ส่วนรายการเดินทาง */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-10 pt-2 pb-4">
        {isLoading ? (
          <LoadingScreen text="กำลังค้นหาประวัติ…"/>
        ) : trips.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 md:p-16 text-center shadow-sm border border-gray-100 flex flex-col items-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-4 md:mb-6">
              <Filter size={32} className="md:w-10 md:h-10" />
            </div>
            <h3 className="text-gray-900 font-bold md:text-lg mb-1 md:mb-2">
              ไม่พบข้อมูล
            </h3>
            <p className="text-xs md:text-sm text-gray-500">
              ไม่มีประวัติการเดินทางในช่วงเวลาที่เลือก
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentTrips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => openTripDetails(trip)}
                className="bg-white p-5 md:p-6 rounded-[24px] shadow-sm border border-gray-100 cursor-pointer hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex items-start justify-between mb-3 md:mb-4">
                  <h3 className="font-bold text-gray-900 text-sm md:text-base line-clamp-1 pr-2">
                    {trip.purpose}
                  </h3>
                  {getStatusBadge(trip.status)}
                </div>
                <div className="flex items-center gap-4 text-[11px] md:text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg">
                    <Calendar
                      size={12}
                      className="text-blue-500 md:w-4 md:h-4"
                    />
                    {new Date(trip.created_at).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })}
                  </span>
                  <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg">
                    <Route size={12} className="text-green-500 md:w-4 md:h-4" />
                    {trip.total_distance_km
                      ? `${trip.total_distance_km} กม.`
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <p className="text-[10px] md:text-[11px] text-gray-400">
                    แตะเพื่อดูเส้นทางที่แวะ
                  </p>
                  <p className="text-xs md:text-sm font-bold text-gray-900">
                    ระยะทางเบิก:{" "}
                    <span className="text-green-600">
                      {trip.total_allowance
                        ? `${trip.total_allowance} กม.`
                        : "-"}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!isLoading && trips.length > 0 && totalPages > 1 && (
        <div className="px-6 md:px-10 pt-3 pb-6 shrink-0 bg-[#fbf9fd] flex justify-center">
          <div className="flex items-center gap-3 md:gap-5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-white border border-gray-200 text-gray-600 disabled:opacity-30 disabled:border-gray-100 disabled:cursor-not-allowed hover:border-blue-300 hover:text-blue-600 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <ChevronLeft size={18} className="md:w-5 md:h-5" />
            </button>

            <span className="text-xs md:text-sm font-bold text-gray-600 min-w-[70px] md:min-w-[90px] text-center">
              หน้า {currentPage}/{totalPages}
            </span>

            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center bg-white border border-gray-200 text-gray-600 disabled:opacity-30 disabled:border-gray-100 disabled:cursor-not-allowed hover:border-blue-300 hover:text-blue-600 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <ChevronRight size={18} className="md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
