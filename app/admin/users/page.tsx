"use client";
import {usePermissions,Can} from '@/components/Permissions';
import EmployeeImport from '@/components/EmployeeImport';
import AdminSelect from "@/components/ui/AdminSelect";

import EmployeeAccountForm from "@/components/EmployeeAccountForm";
import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  ShieldCheck,
  User,
  X,
  Save,
  Loader2,
  AlertTriangle,
  UserCheck,
  Users,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

export default function UsersManagementPage() {
  const supabase = createClient();
  const {can}=usePermissions();
  const [lookups,setLookups]=useState<any>({groups:[],departments:[],divisions:[],branches:[],positions:[]});
  useEffect(()=>{fetch("/api/admin/lookups",{cache:"no-store"}).then(r=>r.json()).then(d=>setLookups(d)).catch(()=>{});},[]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 🌟 เพิ่ม State สำหรับ Tab และการค้นหา
  const [activeTab, setActiveTab] = useState<"pending" | "active">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);

  // ดึงข้อมูล
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employees") // อิงจากตาราง employees ที่พี่ใช้
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("ไม่สามารถดึงข้อมูลพนักงานได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleAddNew = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const syncIdentity = async (employeeId: unknown) => {
    const response = await fetch('/api/admin/accounts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId: String(employeeId) }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'บันทึกการผูกบัญชีไม่สำเร็จ');
  };

  // 🌟 ฟังก์ชันอนุมัติพนักงานที่ล็อกอินผ่าน LINE เข้ามาใหม่
  const handleApprove = async (user: any) => {
    if(!can("users.edit")||user.is_super_admin)return;
    setProcessingId(user.id || user.line_user_id);
    try {
      const pkColumn = user.id ? "id" : "line_user_id";
      const pkValue = user.id || user.line_user_id;

      const { error } = await supabase
        .from("employees")
        .update({
          is_active: true,
          ...(can("permissions.manage")?{role:"Staff"}:{}),
        })
        .eq(pkColumn, pkValue);

      if (error) throw error;
      await syncIdentity(user.id);
      toast.success("อนุมัติพนักงานสำเร็จ!");

      // ให้เปิดฟอร์มแก้ไขต่อเลย เผื่อแอดมินอยากใส่รหัสพนักงาน หรือแผนก
      setEditingUser({ ...user, is_active: true, role: "Staff" });
      setIsModalOpen(true);

      fetchEmployees();
    } catch (error: any) {
      console.error("Error approving:", error);
      toast.error(`เกิดข้อผิดพลาด: ${error?.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  // ฟังก์ชันบันทึกข้อมูล (เพิ่มใหม่ / แก้ไข)
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);

    const formData = new FormData(e.currentTarget);
    const employeeData:Record<string,any> = {
      first_name: formData.get("first_name") || null,
      last_name: formData.get("last_name") || null,
      nickname: formData.get("nickname") || null,
      employee_code: formData.get("employee_code") || null,
      email: formData.get("email") || null,
      department: formData.get("department") || null,
      position: formData.get("position") || null,
      division: formData.get("division") || null, branch: formData.get("branch") || null, work_group: formData.get("work_group") || null,
      role: formData.get("role") || "Staff",
      annual_leave_quota: Number(formData.get("annual_leave_quota")) || 0,
      is_active: formData.get("is_active") === "on",
    };
    if(!can('permissions.manage'))delete employeeData.role;
    if(!can('groups.members'))delete employeeData.work_group;
    if(editingUser&&employeeData.role===editingUser.role)delete employeeData.role;

    try {
      if (editingUser) {
        const pkColumn = editingUser.id ? "id" : "line_user_id";
        const pkValue = editingUser.id || editingUser.line_user_id;

        const { error } = await supabase
          .from("employees")
          .update(employeeData)
          .eq(pkColumn, pkValue);

        if (error) throw error;
        await syncIdentity(editingUser.id);
        toast.success("แก้ไขข้อมูลพนักงานสำเร็จ!");
      } else {
        const { data: savedEmployee, error } = await supabase
          .from("employees")
          .insert([employeeData]).select('id').single();

        if (error) throw error;
        if(can('users.edit'))await syncIdentity(savedEmployee.id);
        toast.success("เพิ่มพนักงานใหม่สำเร็จ!");
      }

      setIsModalOpen(false);
      fetchEmployees();
    } catch (error: any) {
      console.error("Error saving employee:", error);
      toast.error(`เกิดข้อผิดพลาด: ${error?.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (user: any) => {
    setUserToDelete(user);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      const pkColumn = userToDelete.id ? "id" : "line_user_id";
      const pkValue = userToDelete.id || userToDelete.line_user_id;

      const { error } = await supabase
        .from("employees")
        .delete()
        .eq(pkColumn, pkValue);

      if (error) throw error;
      toast.success("ลบข้อมูลพนักงานสำเร็จ!");
      fetchEmployees();
    } catch (error: any) {
      console.error("Error deleting employee:", error);
      toast.error(`เกิดข้อผิดพลาดในการลบ: ${error?.message}`);
    } finally {
      setUserToDelete(null);
    }
  };

  // 🌟 กรองข้อมูลตาม Tab และ Search
  const filteredUsers = users.filter((u) => {
    const matchesTab =
      activeTab === "pending" ? u.is_active === false : u.is_active === true;

    const searchLower = searchQuery.toLowerCase();
    const fullName = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
    const displayName = (u.display_name || "").toLowerCase();

    const matchesSearch =
      fullName.includes(searchLower) ||
      displayName.includes(searchLower) ||
      (u.nickname && u.nickname.toLowerCase().includes(searchLower)) ||
      (u.email && u.email.toLowerCase().includes(searchLower));

    const matchesDept =
      departmentFilter === "" || u.department === departmentFilter;

    return matchesTab && matchesSearch && matchesDept;
  });

  const pendingCount = users.filter((u) => u.is_active === false).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการพนักงาน</h1>
          <p className="text-sm text-gray-500 mt-1">
            เพิ่ม ลบ แก้ไข และกำหนดสิทธิ์การใช้งานของพนักงานในระบบ
          </p>
        </div>
        <button
          onClick={handleAddNew}
          hidden={!can("users.create")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm shadow-blue-200 transition-all active:scale-95 flex items-center gap-2 w-fit"
        >
          <Plus size={18} />
          เพิ่มพนักงานใหม่
        </button>
      </div>

      {/* 🌟 Tabs ควบคุม */}
      <div className="flex bg-white p-1 rounded-xl w-full sm:w-80 shadow-sm border border-gray-100">
        <button
          onClick={() => setActiveTab("active")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "active"
              ? "bg-blue-50 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Users size={16} /> อนุมัติแล้ว
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "pending"
              ? "bg-orange-50 text-orange-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          รออนุมัติ
          {pendingCount > 0 && (
            <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white z-10 relative">
          <div className="relative w-full sm:w-80">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล หรือชื่อ LINE..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <AdminSelect
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs md:text-sm rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 font-medium cursor-pointer"
            >
              <option value="">ทุกแผนก</option>
              <option value="IT Support">IT Support</option>
              <option value="HR">HR</option>
            </AdminSelect>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/80 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-bold">ชื่อพนักงาน / LINE</th>
                <th className="px-6 py-4 font-bold">รหัสพนักงาน</th>
                <th className="px-6 py-4 font-bold">แผนก / ตำแหน่ง</th>
                <th className="px-6 py-4 font-bold">ระดับสิทธิ์</th>
                <th className="px-6 py-4 font-bold text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr key="loading-row">
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                      <p className="text-sm font-medium">
                        กำลังโหลดข้อมูลพนักงาน...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr key="empty-row">
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      {activeTab === "pending" ? (
                        <ShieldAlert size={32} className="text-gray-300" />
                      ) : (
                        <Users size={32} className="text-gray-300" />
                      )}
                      <p className="text-sm font-medium mt-2">
                        {activeTab === "pending"
                          ? "ไม่มีผู้ใช้งานที่รอการอนุมัติ"
                          : "ไม่พบข้อมูลพนักงานในระบบ"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, rowIndex) => (
                  <tr
                    key={user.id || user.line_user_id}
                    onClick={() => handleEdit(user)}
                    tabIndex={0}
                    aria-label={`ดูรายละเอียด ${user.first_name || user.display_name || 'พนักงาน'} ${user.last_name || ''}`}
                    onKeyDown={event => {
                      if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        handleEdit(user);
                      }
                    }}
                    className={`border-b border-slate-200 hover:bg-teal-100/70 focus-visible:bg-teal-100/70 focus-visible:outline-2 focus-visible:outline-[#2563eb] transition-colors group cursor-pointer ${rowIndex % 2 === 0 ? "bg-white" : "bg-slate-100/80"}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {/* 🌟 แสดงรูปภาพจาก LINE ถ้ามี */}
                        {(user.profile_photo_url || user.picture_url) ? (
                          <img
                            src={user.profile_photo_url || user.picture_url}
                            alt="profile"
                            className="w-10 h-10 rounded-full border border-gray-100 object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                            {user.first_name
                              ? user.first_name.charAt(0)
                              : user.display_name
                                ? user.display_name.charAt(0)
                                : "?"}
                          </div>
                        )}

                        <div>
                          <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            {user.first_name
                              ? `${user.first_name} ${user.last_name || ""}`
                              : user.display_name || "ไม่มีชื่อ"}
                            {user.nickname && (
                              <span className="text-gray-500 font-normal">
                                ({user.nickname})
                              </span>
                            )}
                            {!user.first_name && user.display_name && (
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded uppercase">
                                LINE
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {user.email || "-"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 font-medium">
                        {user.employee_code || (
                          <span className="text-gray-300 italic">
                            ยังไม่ระบุ
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-700 font-medium">
                        {user.department || "-"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {user.position || "-"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {user.role === "Admin" ? (
                          <ShieldCheck size={16} className="text-indigo-500" />
                        ) : (
                          <User size={16} className="text-gray-400" />
                        )}
                        <span
                          className={`text-sm font-medium ${user.role === "Admin" ? "text-indigo-600" : "text-gray-600"}`}
                        >
                          {user.is_super_admin?"Super Admin":user.role || "Staff"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div onClick={event => event.stopPropagation()} className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        {activeTab === "pending" ? (
                          <button
                            onClick={() => handleApprove(user)}
                            hidden={!can('users.edit')||user.is_super_admin}
                            disabled={
                              processingId === (user.id || user.line_user_id)
                            }
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
                          >
                            {processingId === (user.id || user.line_user_id) ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <UserCheck size={14} />
                            )}
                            อนุมัติ
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEdit(user)}
                            hidden={!can('users.edit')||user.is_super_admin}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit size={18} />
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteClick(user)}
                          hidden={!can("users.delete")||user.is_super_admin}
                          disabled={!can("users.delete")||user.is_super_admin}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={18} />
                        </button>
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
          <span className="font-medium">
            จำนวนพนักงานทั้งหมด {filteredUsers.length} รายการ
          </span>
        </div>
      </div>

      <Can permission="users.import"><EmployeeImport onImported={fetchEmployees}/></Can>
      {/* 🌟 Slide-over Modal สำหรับฟอร์มพนักงาน */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
            onClick={() => !isSaving && setIsModalOpen(false)}
          />

          <form
            onSubmit={handleSave}
            className="relative w-full md:w-[85vw] lg:w-[70vw] max-w-none bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
          >
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingUser ? (!can('users.edit')||editingUser.is_super_admin?'รายละเอียดพนักงาน':'แก้ไขข้อมูลพนักงาน') : "เพิ่มพนักงานใหม่"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editingUser
                    ? `ข้อมูลของ ${editingUser.first_name || editingUser.display_name}`
                    : "ระบบจะรอให้พนักงานผูกบัญชี LINE ในภายหลัง"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 mb-5">{editingUser?.is_super_admin?<p className="md:col-span-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-700">บัญชี Super Admin ป้องกันการจัดการจากหน้าพนักงาน ใช้หน้าข้อมูลส่วนตัวสำหรับเจ้าของบัญชี</p>:editingUser?.id&&can('users.accounts')?<EmployeeAccountForm key={String(editingUser.id)} employeeId={String(editingUser.id)}/>:!editingUser&&can('users.accounts')?<p className="md:col-span-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">บันทึกพนักงานก่อน แล้วเปิดแก้ไขเพื่อตั้ง Username/Password</p>:null}</div>
            <fieldset disabled={!can(editingUser?"users.edit":"users.create")||(editingUser?.is_super_admin===true)} className="grid grid-cols-1 md:grid-cols-2 content-start items-start gap-5">
              {[["division","ฝ่าย"],["branch","สาขา"],["work_group","กลุ่มทำงาน"]].map(([key,label]) => <label key={key} className="block">{label}{key==="work_group"?<AdminSelect name={key} disabled={!can("groups.members")||!can(editingUser?"users.edit":"users.create")||editingUser?.is_super_admin} defaultValue={editingUser?.[key]||""} aria-label={label}><option value="">ยังไม่กำหนดกลุ่มหลัก</option>{editingUser?.work_group&&!lookups.groups?.some((g:any)=>g.name===editingUser.work_group)&&<option value={editingUser.work_group}>{editingUser.work_group} (กลุ่มปัจจุบัน)</option>}{lookups.groups?.map((g:any)=><option key={g.id} value={g.name}>{g.name}</option>)}</AdminSelect>:<input name={key} defaultValue={editingUser?.[key]||""} className="block w-full border rounded-lg p-3"/>}</label>)}
              <div className="contents">
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                    ชื่อจริง <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    name="first_name"
                    type="text"
                    defaultValue={editingUser?.first_name || ""}
                    placeholder="ชื่อ"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                    นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    name="last_name"
                    type="text"
                    defaultValue={editingUser?.last_name || ""}
                    placeholder="นามสกุล"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
              </div>

              <div className="contents">
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                    ชื่อเล่น
                  </label>
                  <input
                    name="nickname"
                    type="text"
                    defaultValue={editingUser?.nickname || ""}
                    placeholder="ชื่อเล่น"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                    รหัสพนักงาน
                  </label>
                  <input
                    name="employee_code"
                    type="text"
                    defaultValue={editingUser?.employee_code || ""}
                    placeholder="EMP-001"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                  อีเมล (Email)
                </label>
                <input
                  name="email"
                  type="email"
                  defaultValue={editingUser?.email || ""}
                  placeholder="example@stplus.com"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div className="contents">
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                    แผนก
                  </label>
                  <input
                    name="department"
                    type="text"
                    defaultValue={editingUser?.department || ""}
                    placeholder="ระบุแผนก"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                    ตำแหน่ง
                  </label>
                  <input
                    name="position"
                    type="text"
                    defaultValue={editingUser?.position || ""}
                    placeholder="ระบุตำแหน่ง"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                  สิทธิ์การใช้งาน (Role)
                </label>
                <AdminSelect
                  name="role"
                  disabled={!can('permissions.manage')||!can(editingUser?'users.edit':'users.create')||editingUser?.is_super_admin}
                  defaultValue={editingUser?.role || "Staff"}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                >
                  <option value="Staff">พนักงานทั่วไป (Staff)</option>
                  <option value="Manager">ผู้จัดการ (Manager)</option>
                  <option value="Admin">ผู้ดูแลระบบ (Admin)</option>
                </AdminSelect>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 mb-1.5 block">
                  โควตาวันลาพักร้อน (วัน/ปี)
                </label>
                <input
                  name="annual_leave_quota"
                  type="number"
                  defaultValue={editingUser?.annual_leave_quota ?? 6}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      name="is_active"
                      type="checkbox"
                      className="sr-only peer"
                      defaultChecked={
                        editingUser ? editingUser.is_active : true
                      }
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                  <span className="text-sm font-bold text-gray-700">
                    สถานะ: ใช้งานปกติ (Active)
                  </span>
                </label>
              </div>
            </fieldset></div>

            <div className="p-6 border-t border-gray-100 bg-gray-50/50 shrink-0 flex gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                hidden={!can(editingUser?'users.edit':'users.create')||editingUser?.is_super_admin}
                disabled={isSaving||(!can(editingUser?"users.edit":"users.create"))||editingUser?.is_super_admin}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
              >
                {isSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                {editingUser ? "บันทึกการแก้ไข" : "เพิ่มพนักงาน"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 🌟 Popup ยืนยันการลบ */}
      {userToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setUserToDelete(null)}
          />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                <AlertTriangle size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                ยืนยันการลบพนักงาน
              </h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                คุณแน่ใจหรือไม่ว่าต้องการลบ{" "}
                <span className="font-bold text-gray-900">
                  {userToDelete.first_name || userToDelete.display_name}
                </span>{" "}
                ออกจากระบบ? <br /> การกระทำนี้ไม่สามารถย้อนกลับได้
              </p>
              <div className="flex w-full gap-3">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-red-200 transition-colors cursor-pointer"
                >
                  ใช่, ลบเลย
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
