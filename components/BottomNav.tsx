"use client";

import React, { useState, useEffect } from "react";
import { Home, LogOut, CalendarDays, Car, Clock } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export default function BottomNav() {
  // 🌟 1. ลบ State activeTab ออกไปเลยครับ
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const empData = localStorage.getItem("employee_data");
    if (empData) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
  }, [pathname]);

  if (pathname === "/login" || pathname === "/admin-login" || pathname === "/register" || pathname === "/pending" || pathname.startsWith("/admin") || !isLoggedIn) {
    return null;
  }

  const navItems = [
    { id: "home", label: "หน้าแรก", icon: Home, route: "/" },
    { id: "hr", label: "ลางาน", icon: LogOut, route: "/hr" },
    {
      id: "action",
      label: "ลงเวลางาน",
      icon: Clock,
      route: "/check-in",
      isAction: true,
    },
    { id: "calendar", label: "ปฏิทิน", icon: CalendarDays, route: "/calendar" },
    { id: "travel", label: "เดินทาง", icon: Car, route: "/travel" },
  ];

  const handleNavigation = (id: string, route: string) => {
    // 🌟 2. ลบคำสั่ง setActiveTab(id) ออกไปเช่นกัน
    if (route !== "#") {
      router.push(route);
    }
  };

  return (
    <nav aria-label="เมนูหลัก" className="bottom-nav">
      <div className="bg-white rounded-t-[30px] border-t border-gray-100 px-6 pt-2 pb-4 flex justify-between items-end relative">
        {navItems.map((item) => {
          
          // 🌟 3. ปรับ Logic การเช็คสถานะ Active ใหม่ตรงนี้ครับ
          // ถ้าเป็น "/" (หน้าแรก) ต้องเช็คให้ตรงเป๊ะๆ (===) ไม่งั้นมันจะไปตรงกับทุกหน้า
          // ถ้าเป็นหน้าอื่นๆ ใช้ startsWith เพื่อให้ครอบคลุมหน้าย่อยด้วย เช่น เข้าไปที่ /travel/history เมนูเดินทางก็ยัง Active อยู่
          const isActive = item.route === "/" 
            ? pathname === item.route 
            : pathname?.startsWith(item.route);

          const Icon = item.icon;

          if (item.isAction) {
            return (
              <div key={item.id} className="relative -top-1 flex flex-col items-center justify-center">
                <button 
                  aria-label={item.label} aria-current={isActive ? "page" : undefined} onClick={() => handleNavigation(item.id, item.route)}
                  className="cursor-pointer w-12 h-12 bg-[#2563eb] rounded-full flex items-center justify-center text-white shadow-lg shadow-teal-900/10 transform transition-transform active:scale-95 mb-1"
                >
                  <Icon size={26} strokeWidth={2.5} />
                </button>
                <span className="text-[10px] font-bold text-[#2563eb] whitespace-nowrap">
                  {item.label}
                </span>
              </div>
            );
          }

          return (
            <button 
              key={item.id}
              aria-label={item.label} aria-current={isActive ? "page" : undefined} onClick={() => handleNavigation(item.id, item.route)}
              className="cursor-pointer flex flex-col items-center justify-center gap-1 min-w-[50px] pb-1"
            >
              <Icon 
                size={22} 
                className={`transition-colors duration-200 ${isActive ? 'text-[#2563eb]' : 'text-gray-400'}`} 
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] transition-colors duration-200 ${isActive ? 'text-[#2563eb] font-bold' : 'text-gray-400 font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
