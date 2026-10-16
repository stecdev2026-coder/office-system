'use client';
import {Delete} from 'lucide-react';

export default function PinKeypad({value,onChange,disabled=false,label='PIN 6 หลัก'}:{value:string;onChange:(value:string)=>void;disabled?:boolean;label?:string}){
 const press=(digit:string)=>{if(!disabled&&value.length<6)onChange(value+digit);};
 const remove=()=>{if(!disabled)onChange(value.slice(0,-1));};
 return <div className="mx-auto w-full max-w-[290px]" aria-label={label}>
  <div className="mb-6 flex items-center justify-center gap-3" role="status" aria-live="polite" aria-label={`กรอกแล้ว ${value.length} จาก 6 หลัก`}>
   {Array.from({length:6},(_,index)=><span key={index} className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${index<value.length?'scale-110 border-blue-600 bg-blue-600 shadow-sm shadow-blue-300':'border-slate-300 bg-white'}`}/>) }
  </div>
  <div className="grid grid-cols-3 gap-x-5 gap-y-3">
   {['1','2','3','4','5','6','7','8','9'].map(digit=><button key={digit} type="button" disabled={disabled} onClick={()=>press(digit)} aria-label={`เลข ${digit}`} className="mx-auto flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-slate-50 text-2xl font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 transition active:scale-95 active:bg-blue-100 disabled:opacity-40">{digit}</button>)}
   <span aria-hidden="true"/>
   <button type="button" disabled={disabled} onClick={()=>press('0')} aria-label="เลข 0" className="mx-auto flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-slate-50 text-2xl font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 transition active:scale-95 active:bg-blue-100 disabled:opacity-40">0</button>
   <button type="button" disabled={disabled||value.length===0} onClick={remove} aria-label="ลบตัวเลขล่าสุด" className="mx-auto flex h-16 w-16 cursor-pointer items-center justify-center rounded-full text-slate-500 transition active:scale-95 active:bg-slate-100 disabled:opacity-30"><Delete size={27}/></button>
  </div>
 </div>;
}
