"use client";
import BackButton from "@/components/BackButton";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Play,
  Square,
  Loader2,
  ChevronLeft,
  Map,
  X,
  History,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import Tooltip from "@/components/ui/Tooltip";
import LoadingScreen from "@/components/LoadingScreen";

export default function TravelPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<any>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);

  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🌟 State สำหรับ Popup (Modal)
  const [showStartModal, setShowStartModal] = useState(false);
  const [purposeInput, setPurposeInput] = useState("");

  const [showWaypointModal, setShowWaypointModal] = useState(false);
  const [waypointNote, setWaypointNote] = useState("");

  useEffect(() => {
    const empData = localStorage.getItem("employee_data");
    if (empData) {
      const parsedEmp = JSON.parse(empData);
      setEmployee(parsedEmp);
      loadActiveTrip(parsedEmp.line_user_id);
      getLocation();
    } else {
      router.push("/login");
    }
  }, [router]);

  const loadActiveTrip = async (lineUserId: string) => {
    const { data: trip } = await supabase
      .from("travel_trips")
      .select("*")
      .eq("line_user_id", lineUserId)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (trip) {
      setActiveTrip(trip);
      const { data: pts } = await supabase
        .from("travel_checkpoints")
        .select("*")
        .eq("trip_id", trip.id)
        .order("sequence", { ascending: true });
      if (pts) setCheckpoints(pts);
    } else {
      setActiveTrip(null);
      setCheckpoints([]);
    }
  };

  const getLocation = () => {
    setLoadingLocation(true);
    setLocationName(null);
    if (!navigator.geolocation) {
      toast.error("เบราว์เซอร์ไม่รองรับ GPS");
      setLoadingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocation({ lat, lng });

        try {
          const apiKey = process.env.NEXT_PUBLIC_LONGDO_MAP_KEY;
          if (apiKey) {
            const res = await fetch(
              `https://api.longdo.com/map/services/address?lon=${lng}&lat=${lat}&key=${apiKey}`,
            );
            const data = await res.json();
            if (data && data.subdistrict && data.district) {
              setLocationName(
                `${data.subdistrict} ${data.district} ${data.province}`,
              );
            }
          }
        } catch (error) {}
        setLoadingLocation(false);
      },
      () => {
        toast.error("กรุณาเปิดสิทธิ์ GPS ให้กับแอป");
        setLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  // 1. บันทึกเริ่มเดินทาง (หลังกรอก Popup)
  const confirmStartTrip = async () => {
    if (!location || !purposeInput.trim()) {
      toast.error("กรุณากรอกหัวข้อ/จุดประสงค์การเดินทาง");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: newTrip, error: tripError } = await supabase
        .from("travel_trips")
        .insert([
          {
            line_user_id: employee.line_user_id,
            purpose: purposeInput,
          },
        ])
        .select()
        .single();

      if (tripError) throw tripError;

      await supabase.from("travel_checkpoints").insert([
        {
          trip_id: newTrip.id,
          point_type: "start",
          sequence: 1,
          lat: location.lat,
          lng: location.lng,
          location_name: locationName || "ไม่ระบุสถานที่",
        },
      ]);

      toast.success("เริ่มบันทึกการเดินทาง!");
      setShowStartModal(false);
      setPurposeInput("");
      loadActiveTrip(employee.line_user_id);
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. บันทึกจุดแวะพัก (หลังกรอก Popup)
  const confirmAddWaypoint = async () => {
    if (!location || !activeTrip || !waypointNote.trim()) {
      toast.error("กรุณากรอกรายละเอียดจุดที่แวะ");
      return;
    }
    setIsSubmitting(true);
    try {
      const nextSeq = checkpoints.length + 1;
      await supabase.from("travel_checkpoints").insert([
        {
          trip_id: activeTrip.id,
          point_type: "waypoint",
          sequence: nextSeq,
          lat: location.lat,
          lng: location.lng,
          location_name: locationName || "ไม่ระบุสถานที่",
          note: waypointNote,
        },
      ]);

      toast.success("บันทึกจุดแวะพักแล้ว");
      setShowWaypointModal(false);
      setWaypointNote("");
      loadActiveTrip(employee.line_user_id);
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. กดปุ่มสิ้นสุดการเดินทาง
  const handleEndTrip = async () => {
    if (!location || !activeTrip) return;
    setIsSubmitting(true);

    try {
      const nextSeq = checkpoints.length + 1;

      // บันทึกจุดสิ้นสุดลงฐานข้อมูลก่อน
      await supabase.from("travel_checkpoints").insert([
        {
          trip_id: activeTrip.id,
          point_type: "end",
          sequence: nextSeq,
          lat: location.lat,
          lng: location.lng,
          location_name: locationName || "ไม่ระบุสถานที่",
        },
      ]);

      // ดึงพิกัดทั้งหมดของทริปนี้เรียงตามลำดับ sequence
      const { data: allPoints } = await supabase
        .from("travel_checkpoints")
        .select("lat, lng")
        .eq("trip_id", activeTrip.id)
        .order("sequence", { ascending: true });

      let totalDistKm = 0;

      if (allPoints && allPoints.length >= 2) {
        // คำนวณระยะทางจริงจากพิกัด GPS (Haversine Formula) ทุกช่วงการเดินทาง
        for (let i = 0; i < allPoints.length - 1; i++) {
          const p1 = allPoints[i];
          const p2 = allPoints[i + 1];

          const R = 6371;
          const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
          const dLng = (p2.lng - p1.lng) * (Math.PI / 180);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(p1.lat * (Math.PI / 180)) *
              Math.cos(p2.lat * (Math.PI / 180)) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const d = R * c;

          totalDistKm += d;
        }
      }

      const finalTotalDistance = parseFloat(totalDistKm.toFixed(2));

      // หักลบระยะทางเดินทางมาออฟฟิศปกติของพนักงาน
      const normalCommuteKm = employee?.commute_distance_km || 0;
      let finalAllowanceDistance = finalTotalDistance - normalCommuteKm;
      if (finalAllowanceDistance < 0) finalAllowanceDistance = 0;
      finalAllowanceDistance = parseFloat(finalAllowanceDistance.toFixed(2));

      // อัปเดตข้อมูลลง Supabase
      await supabase
        .from("travel_trips")
        .update({
          status: "completed",
          total_distance_km: finalTotalDistance,
          total_allowance: finalAllowanceDistance,
        })
        .eq("id", activeTrip.id);

      toast.success(`สิ้นสุดการเดินทาง! ระยะทางรวม ${finalTotalDistance} กม.`);
      setActiveTrip(null);
      setCheckpoints([]);
      router.push("/travel/history");
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!employee || loadingLocation) {
    return <LoadingScreen text="กำลังโหลดข้อมูลการเดินทาง…" />;
  }

  return (
    // 🌟 ขยายขนาดความกว้างสำหรับ iPad (md:max-w-3xl) และเพิ่มเงา
    <div className="app-page app-page-scroll">
      
      {/* 🌟 Popup Modal: เริ่มเดินทาง */}
      {showStartModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm md:max-w-md rounded-3xl p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4 md:mb-5">
              <h3 className="font-bold text-gray-900 text-lg md:text-xl">
                หัวข้อการเดินทาง
              </h3>
              <button
                onClick={() => setShowStartModal(false)}
                className="text-gray-400 hover:text-gray-600 active:scale-95 transition-transform cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-sm md:text-base text-gray-500 mb-4 md:mb-5">
              โปรดระบุจุดประสงค์หรือชื่อลูกค้าที่จะไปพบ เพื่อใช้ในการเบิกจ่าย
            </p>
            <input
              type="text"
              value={purposeInput}
              onChange={(e) => setPurposeInput(e.target.value)}
              placeholder="เช่น ไปพบลูกค้าบริษัท ABC"
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 md:text-lg rounded-2xl px-4 py-3 md:py-4 mb-6 md:mb-8 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              autoFocus
            />
            <button
              onClick={confirmStartTrip}
              disabled={isSubmitting || !purposeInput.trim()}
              className="w-full py-3.5 md:py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold md:text-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Play size={24} fill="currentColor" />
              )}
              ยืนยันการเริ่มเดินทาง
            </button>
          </div>
        </div>
      )}

      {/* 🌟 Popup Modal: แวะระหว่างทาง */}
      {showWaypointModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm md:max-w-md rounded-3xl p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4 md:mb-5">
              <h3 className="font-bold text-gray-900 text-lg md:text-xl">
                จุดที่แวะระหว่างทาง
              </h3>
              <button
                onClick={() => setShowWaypointModal(false)}
                className="text-gray-400 hover:text-gray-600 active:scale-95 transition-transform cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-sm md:text-base text-gray-500 mb-4 md:mb-5">
              ระบุรายละเอียดหรือสถานที่ที่แวะ
            </p>
            <input
              type="text"
              value={waypointNote}
              onChange={(e) => setWaypointNote(e.target.value)}
              placeholder="เช่น แวะรับของ / แวะเติมน้ำมัน"
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 md:text-lg rounded-2xl px-4 py-3 md:py-4 mb-6 md:mb-8 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              autoFocus
            />
            <button
              onClick={confirmAddWaypoint}
              disabled={isSubmitting || !waypointNote.trim()}
              className="w-full py-3.5 md:py-4 rounded-2xl bg-gray-900 hover:bg-black text-white font-bold md:text-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <MapPin size={24} />
              )}
              บันทึกจุดแวะ
            </button>
          </div>
        </div>
      )}

      {/* Header มินิมอล */}
      <div
        className="pt-12 md:pt-16 pb-16 md:pb-20 bg-cover bg-center relative overflow-hidden bg-blue-50"
        style={{ backgroundImage: `url('/img/bg-head.jpg')` }}
      >
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]"></div>
        <div className="px-6 md:px-10 flex items-center justify-between relative z-10">
          <BackButton fallback="/" className="cursor-pointer w-10 h-10 md:w-12 md:h-12 bg-white/90 backdrop-blur-md border border-white/50 rounded-full flex items-center justify-center text-gray-700 active:scale-95 transition-all shadow-sm" />
          <h1 className="text-base md:text-lg font-bold text-gray-900 absolute left-1/2 -translate-x-1/2 drop-shadow-md">
            บันทึกการเดินทาง
          </h1>
          <Tooltip content="ประวัติการเดินทาง" position="left">
            <button
              type="button"
              onClick={() => router.push("/travel/history")}
              aria-label="ประวัติการเดินทาง"
              className="flex h-10 w-10 md:h-12 md:w-12 cursor-pointer items-center justify-center rounded-full border border-white/50 bg-white/90 text-blue-600 shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <History size={20} className="md:w-6 md:h-6" />
            </button>
          </Tooltip>
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

      <div className="px-6 md:px-10 flex flex-col items-center mt-4 md:mt-6">
        {/* กล่องพิกัดปัจจุบัน */}
        <div className="w-full bg-white rounded-[32px] p-5 md:p-6 shadow-sm border border-gray-100 mb-6 md:mb-8">
          <div className="flex items-center gap-3 md:gap-4">
            <div
              className={`w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center shrink-0 ${location ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-400"}`}
            >
              {loadingLocation ? (
                <Loader2 size={20} className="animate-spin md:w-7 md:h-7" />
              ) : (
                <MapPin size={20} className="md:w-7 md:h-7" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-sm md:text-base mb-0.5 md:mb-1">
                พิกัดปัจจุบัน
              </h3>
              <p className="text-[11px] md:text-sm text-gray-500 truncate">
                {locationName ||
                  (location
                    ? `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng.toFixed(4)}`
                    : "กำลังค้นหา...")}
              </p>
            </div>
            <button
              onClick={getLocation}
              className="ml-2 flex items-center gap-1 text-[10px] md:text-xs text-blue-600 font-bold bg-blue-50 px-3 py-1.5 md:px-4 md:py-2 rounded-md active:scale-95 transition-all shrink-0 cursor-pointer hover:bg-blue-100"
            >
              <RefreshCw size={12} strokeWidth={2.5} className="md:w-4 md:h-4" />
              รีเฟรช
            </button>
          </div>
        </div>

        {/* Timeline แสดงจุดแวะ */}
        {activeTrip && checkpoints.length > 0 && (
          <div className="w-full bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 mb-6 md:mb-8">
            <div className="mb-4 pb-4 border-b border-gray-100">
              <h3 className="text-xs md:text-sm font-bold text-gray-400 mb-1">
                หัวข้อการเดินทาง:
              </h3>
              <p className="text-sm md:text-lg font-bold text-blue-700">
                {activeTrip.purpose}
              </p>
            </div>
            <h3 className="font-bold text-gray-900 text-sm md:text-base mb-4 md:mb-6 flex items-center gap-2">
              <Map size={16} className="text-blue-500 md:w-5 md:h-5" /> ลำดับการเดินทาง
            </h3>
            <div className="relative border-l-2 border-dashed border-gray-200 ml-3 md:ml-4 space-y-6 md:space-y-8">
              {checkpoints.map((pt, index) => (
                <div key={pt.id} className="relative pl-6 md:pl-8">
                  <div
                    className={`absolute -left-[9px] md:-left-[11px] top-1 w-4 h-4 md:w-5 md:h-5 rounded-full border-4 border-white ${pt.point_type === "start" ? "bg-green-500" : "bg-blue-500"}`}
                  ></div>
                  <h4 className="text-xs md:text-sm font-bold text-gray-900 flex items-center gap-2 md:gap-3">
                    {pt.point_type === "start"
                      ? "จุดเริ่มต้น"
                      : `แวะ: ${pt.note || "ไม่ระบุ"}`}
                    <span className="text-[9px] md:text-[11px] font-medium text-gray-400 bg-gray-50 px-2 md:px-3 py-0.5 md:py-1 rounded-full">
                      {new Date(pt.recorded_at).toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </h4>
                  <p className="text-[11px] md:text-sm text-gray-500 mt-1 md:mt-1.5 line-clamp-2">
                    {pt.location_name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ปุ่มควบคุมการเดินทาง */}
        <div className="w-full pb-8">
          {!activeTrip ? (
            <button
              onClick={() => setShowStartModal(true)}
              disabled={!location}
              className={`cursor-pointer w-full py-4 md:py-5 rounded-[20px] md:rounded-[24px] flex items-center justify-center gap-2 transition-all ${
                !location
                  ? "bg-gray-100 text-gray-400"
                  : "bg-green-600 hover:bg-green-700 text-white active:scale-95 shadow-lg shadow-green-500/30"
              }`}
            >
              <Play size={22} fill="currentColor" className="md:w-6 md:h-6" />
              <span className="text-base md:text-lg font-bold">เริ่มการเดินทาง</span>
            </button>
          ) : (
            // 🌟 ปรับให้ปุ่มแวะ และ สิ้นสุด เรียงข้างกัน (ซ้าย-ขวา) บนจอ iPad
            <div className="flex flex-col md:flex-row gap-3 md:gap-4">
              <button
                onClick={() => setShowWaypointModal(true)}
                disabled={!location}
                className="cursor-pointer flex-1 py-4 md:py-5 rounded-[20px] md:rounded-[24px] bg-white border-2 border-blue-100 hover:bg-blue-50 text-blue-600 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <MapPin size={20} className="md:w-6 md:h-6" />
                <span className="text-sm md:text-lg font-bold">แวะจุดระหว่างทาง</span>
              </button>

              <button
                onClick={handleEndTrip}
                disabled={isSubmitting || !location}
                className={`cursor-pointer flex-1 py-4 md:py-5 rounded-[20px] md:rounded-[24px] flex items-center justify-center gap-2 transition-all ${
                  isSubmitting || !location
                    ? "bg-gray-100 text-gray-400"
                    : "bg-red-500 hover:bg-red-600 text-white active:scale-95 shadow-lg shadow-red-500/30"
                }`}
              >
                {isSubmitting ? (
                  <Loader2 size={22} className="animate-spin md:w-6 md:h-6" />
                ) : (
                  <Square size={20} fill="currentColor" className="md:w-6 md:h-6" />
                )}
                <span className="text-base md:text-lg font-bold">สิ้นสุดการเดินทาง</span>
              </button>
            </div>
          )}
          
          <button
            onClick={() => router.push("/travel/history")}
            className="cursor-pointer mt-4 md:mt-6 w-full py-3.5 md:py-4 rounded-[16px] md:rounded-[20px] flex items-center justify-center gap-2 text-[13px] md:text-base font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50/50 transition-all active:scale-95 group"
          >
            <History
              size={18}
              className="text-gray-400 group-hover:text-blue-500 transition-colors md:w-5 md:h-5"
            />
            <span>ดูรายการเดินทางย้อนหลัง</span>
          </button>
        </div>
      </div>
    </div>
  );
}
