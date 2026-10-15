"use client";

import {useMemo,useState} from "react";
import {CalendarPlus,ChevronLeft,ChevronRight,Clock,Loader2} from "lucide-react";

interface CalendarViewProps {events:any[];isLoading:boolean;onDateClick:(dateStr:string)=>void;onEventClick:(event:any)=>void;}
const pad=(value:number)=>String(value).padStart(2,"0");
const localDate=(date=new Date())=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const includesDate=(event:any,date:string)=>event.event_date<=date&&(event.end_date||event.event_date)>=date;

export default function CalendarView({events,isLoading,onDateClick,onEventClick}:CalendarViewProps){
 const today=localDate(),[currentDate,setCurrentDate]=useState(()=>new Date()),[selectedDate,setSelectedDate]=useState(today);
 const year=currentDate.getFullYear(),month=currentDate.getMonth(),daysInMonth=new Date(year,month+1,0).getDate(),firstDay=new Date(year,month,1).getDay();
 const monthNames=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"],dayNames=["อา","จ","อ","พ","พฤ","ศ","ส"];
 const selectedEvents=useMemo(()=>events.filter(event=>includesDate(event,selectedDate)).sort((a,b)=>(a.start_time||"").localeCompare(b.start_time||"")),[events,selectedDate]);
 const move=(delta:number)=>{const next=new Date(year,month+delta,1);setCurrentDate(next);setSelectedDate(`${next.getFullYear()}-${pad(next.getMonth()+1)}-01`);};
 const cells=[];
 for(let i=0;i<firstDay;i++)cells.push(<div key={`empty-${i}`} aria-hidden="true" className="aspect-square rounded-xl bg-slate-50/70"/>);
 for(let day=1;day<=daysInMonth;day++){
  const date=`${year}-${pad(month+1)}-${pad(day)}`,dayEvents=events.filter(event=>includesDate(event,date)),isToday=date===today,isSelected=date===selectedDate;
  cells.push(<button type="button" key={date} onClick={()=>setSelectedDate(date)} aria-label={`เลือกวันที่ ${day} มี ${dayEvents.length} รายการ`} className={`aspect-square min-w-0 rounded-xl border p-1.5 transition ${isSelected?'border-blue-600 bg-blue-50 ring-2 ring-blue-100':isToday?'border-blue-300 bg-blue-50/50':'border-slate-200 bg-white hover:border-blue-300'}`}>
   <span className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${isToday?'bg-blue-600 text-white':'text-slate-700'}`}>{day}</span>
   <span className="mt-1 flex min-h-2 items-center justify-center gap-1" aria-hidden="true">{dayEvents.slice(0,3).map((event,index)=><i key={`${event.id}-${index}`} className={`h-1.5 w-1.5 rounded-full ${event.event_type==='holiday'?'bg-rose-400':event.event_type==='meeting'?'bg-blue-500':'bg-emerald-400'}`}/>)}</span>
   {dayEvents.length>3&&<span className="block text-[9px] text-slate-500">+{dayEvents.length-3}</span>}
  </button>);
 }
 const selectedLabel=new Date(`${selectedDate}T00:00:00`).toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
 return <div className="rounded-[24px] border border-blue-100 bg-gradient-to-br from-white to-blue-50/40 p-4 shadow-sm md:p-6">
  <div className="mb-5 flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/70 p-2 md:p-3"><button type="button" onClick={()=>move(-1)} aria-label="เดือนก่อนหน้า" className="rounded-xl border border-transparent p-2 text-blue-700 hover:border-blue-100 hover:bg-white md:p-3"><ChevronLeft size={20}/></button><h2 className="text-base font-black text-blue-700 md:text-xl">{monthNames[month]} {year+543}</h2><button type="button" onClick={()=>move(1)} aria-label="เดือนถัดไป" className="rounded-xl border border-transparent p-2 text-blue-700 hover:border-blue-100 hover:bg-white md:p-3"><ChevronRight size={20}/></button></div>
  {isLoading?<div className="flex flex-col items-center justify-center gap-3 py-20"><Loader2 size={32} className="animate-spin text-blue-500"/><p className="text-sm font-medium text-slate-500">กำลังโหลดปฏิทิน...</p></div>:<>
   <div className="grid grid-cols-7 gap-1.5 md:gap-2">{dayNames.map(day=><div key={day} className="py-1 text-center text-xs font-bold text-slate-400 md:text-sm">{day}</div>)}{cells}</div>
   <section className="mt-6 border-t border-blue-100 pt-5" aria-label={`รายการวันที่ ${selectedLabel}`}><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-blue-600">รายการของวันที่เลือก</p><h3 className="mt-1 font-bold text-slate-900">{selectedLabel}</h3></div>{selectedDate>=today&&<button type="button" onClick={()=>onDateClick(selectedDate)} className="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"><CalendarPlus size={17}/>เพิ่มนัดหมาย</button>}</div>
    <div className="space-y-2">{selectedEvents.map(event=><button type="button" key={event.id} onClick={()=>onEventClick(event)} className="flex w-full items-center gap-3 rounded-2xl border border-blue-100 bg-white p-4 text-left hover:border-blue-300"><span className={`h-3 w-3 shrink-0 rounded-full ${event.event_type==='holiday'?'bg-rose-400':event.event_type==='meeting'?'bg-blue-500':'bg-emerald-400'}`}/><span className="min-w-0 flex-1"><b className="block truncate text-sm text-slate-900">{event.title}</b><small className="mt-1 flex items-center gap-1 text-slate-500">{event.start_time?<><Clock size={13}/>{event.start_time.slice(0,5)}{event.end_time?`–${event.end_time.slice(0,5)}`:''} น.</>:'ตลอดวัน'}</small></span><ChevronRight size={18} className="text-slate-400"/></button>)}{!selectedEvents.length&&<div className="rounded-2xl border border-dashed border-blue-200 bg-white/70 px-4 py-8 text-center text-sm text-slate-400">วันนี้ยังไม่มีรายการ</div>}</div>
   </section>
  </>}
 </div>;
}
