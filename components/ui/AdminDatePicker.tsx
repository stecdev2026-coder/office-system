"use client";
import DatePicker,{registerLocale} from 'react-datepicker';
import {th} from 'date-fns/locale/th';
import {CalendarDays} from 'lucide-react';
import {useId} from 'react';
registerLocale('th-office',th);
const parse=(v?:string)=>v?new Date(v+'T12:00:00'):null;
export default function AdminDatePicker({value,onChange,label,min,max}:{value:string;onChange:(value:string)=>void;label:string;min?:string;max?:string}){
 const id=useId();return <div className="office-date-field"><label htmlFor={id} className="block mb-2">{label}</label><div className="office-date-control"><CalendarDays aria-hidden size={17}/><DatePicker id={id} selected={parse(value)} onChange={(date:Date|null)=>{if(date)onChange(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`);}} dateFormat="dd/MM/yyyy" locale="th-office" minDate={parse(min)||undefined} maxDate={parse(max)||undefined} className="office-date-input" calendarClassName="office-calendar" popperClassName="office-date-popper" popperProps={{strategy:'fixed'}} showPopperArrow={false} previousMonthAriaLabel="เดือนก่อนหน้า" nextMonthAriaLabel="เดือนถัดไป" autoComplete="off" shouldCloseOnSelect/></div></div>;
}
