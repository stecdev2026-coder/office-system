"use client";

import {usePermissions} from '@/components/Permissions';
import LoadingScreen from '@/components/LoadingScreen';
import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { 
  Search, 
  Check, 
  X as XIcon, 
  Eye, 
  Clock, 
  CheckCircle2, 
  XCircle,
  CalendarRange,
  Filter
} from "lucide-react";

export default function LeaveRequestsPage() {
  const supabase = createClient();
  const {can}=usePermissions();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // 🌟 ฟังก์ชันดึงข้อมูลการลางาน
  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeaves(data || []);
    } catch (error: any) {
      console.error("Error fetching leaves:", error);
      toast.error(`ไม่สามารถดึงข้อมูลการลาได้: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  // 🌟 ฟังก์ชันอัปเดตสถานะ อนุมัติ/ปฏิเสธ
  const updateLeaveStatus = async (id: string, newStatus: "approved" | "rejected") => {
    const actionText = newStatus === "approved" ? "อนุมัติ" : "ปฏิเสธ";
    
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการ "${actionText}" การลางานรายการนี้?`)) {
      try {
        const { error } = await supabase
          .from("leave_requests")
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", id);
          
        if (error) throw error;
        
        toast.success(`ทำรายการ ${actionText} สำเร็จแล้ว!`);
        fetchLeaves(); // รีเฟรชตาราง
      } catch (error: any) {
        console.error("Error updating status:", error);
        toast.error(`เกิดข้อผิดพลาด: ${error?.message || "ไม่สามารถทำรายการได้"}`);
      }
    }
  };

  // แปลงชื่อประเภทการลาให้เป็นภาษาไทย
  const getLeaveTypeName = (type: string) => {
    const types: Record<string, string> = {
      personal: "ลากิจ",
      sick: "ลาป่วย",
      annual: "พักร้อน"
    };
    return types[type?.toLowerCase()] || type || "ไม่ระบุ";
  };

  // ฟังก์ชันสำหรับแสดงสีและไอคอนของสถานะ
  const getStatusUI = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100"><CheckCircle2 size={14}/> อนุมัติแล้ว</span>;
      case "rejected":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-100"><XCircle size={14}/> ปฏิเสธ</span>;
      case "pending":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-600 border border-orange-100"><Clock size={14}/> รออนุมัติ</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500 border border-gray-200">ไม่ทราบสถานะ</span>;
    }
  };

  // กรองข้อมูลตามแท็บที่เลือก
  const filteredLeaves = leaves.filter(leave => activeTab === "all" || leave.status === activeTab);
  const pendingCount = leaves.filter(l => l.status === "pending").length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 🌟 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการคำขอลางาน</h1>
          <p className="text-sm text-gray-500 mt-1">ตรวจสอบ อนุมัติ หรือปฏิเสธคำขอลางานของพนักงาน</p>
        </div>
        
        {/* สถิติสรุปแบบด่วน */}
        <div className="flex items-center gap-3">
          <div className="bg-orange-50 border border-orange-100 px-4 py-2 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center"><Clock size={16} /></div>
            <div>
              <p className="text-[10px] font-bold text-orange-600 uppercase">รอพิจารณา</p>
              <p className="text-lg font-black text-gray-900 leading-none">{pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 Table Card */}
      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        
        {/* Tabs & Toolbar */}
        <div className="border-b border-gray-100">
          <div className="flex overflow-x-auto custom-scrollbar px-4 pt-2">
            {[
              { id: "all", label: "รายการทั้งหมด" },
              { id: "pending", label: "รออนุมัติ" },
              { id: "approved", label: "อนุมัติแล้ว" },
              { id: "rejected", label: "ปฏิเสธ" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id 
                    ? "border-blue-600 text-blue-600" 
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Filter */}
        <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/30">
          <div className="relative w-full sm:w-80">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="ค้นหาชื่อพนักงาน..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors shrink-0">
            <Filter size={16} /> ตัวกรองเพิ่มเติม
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-white text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-bold">พนักงาน</th>
                <th className="px-6 py-4 font-bold">ประเภทการลา</th>
                <th className="px-6 py-4 font-bold">วันที่ลา (จำนวนวัน)</th>
                <th className="px-6 py-4 font-bold">เหตุผล</th>
                <th className="px-6 py-4 font-bold">สถานะ</th>
                <th className="px-6 py-4 font-bold text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr key="loading-row">
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <LoadingScreen text="กำลังโหลดข้อมูลการลา…"/>
                  </td>
                </tr>
              ) : filteredLeaves.length === 0 ? (
                <tr key="empty-row">
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400 text-sm font-medium">
                    ไม่พบข้อมูลการลางานในหมวดหมู่นี้
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {leave.employee_picture_url ? (
                          <img src={leave.employee_picture_url} alt="Profile" className="w-10 h-10 rounded-full border border-gray-200 object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {(leave.employee_name || "?").charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-gray-900">{leave.employee_name || "ไม่ทราบชื่อ"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-700">{getLeaveTypeName(leave.leave_type)}</span>
                      {leave.leave_format && leave.leave_format !== 'full' && (
                        <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">
                          {leave.leave_format === 'half' ? `ครึ่งวัน (${leave.half_day_period})` : 'ระบุเวลา'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <CalendarRange size={16} className="text-gray-400" />
                        <span>{leave.start_date} <span className="text-gray-400 mx-1">ถึง</span> {leave.end_date}</span>
                      </div>
                      <p className="text-xs font-bold text-blue-600 mt-1 pl-6">รวม {leave.total_days} วัน</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 truncate max-w-[150px]" title={leave.reason}>
                        {leave.reason || "-"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusUI(leave.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {leave.document_url && (
                          <a href={leave.document_url} target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="ดูเอกสารแนบ">
                            <Eye size={18} />
                          </a>
                        )}
                        {leave.status === "pending" && (
                          <>
                            <button 
                              hidden={!can('requests.approve')} onClick={() => updateLeaveStatus(leave.id, "approved")}
                              className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="อนุมัติ"
                            >
                              <Check size={18} />
                            </button>
                            <button 
                              hidden={!can('requests.approve')} onClick={() => updateLeaveStatus(leave.id, "rejected")}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ปฏิเสธ"
                            >
                              <XIcon size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-gray-500 bg-gray-50/30">
          <span className="font-medium">แสดงผล {filteredLeaves.length} รายการ</span>
        </div>
      </div>

    </div>
  );
}
