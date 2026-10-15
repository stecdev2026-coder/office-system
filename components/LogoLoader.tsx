"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";

type LogoLoaderProps={text?:string;size?:"sm"|"md"|"lg";className?:string;progress?:number};

export default function LogoLoader({text="กำลังโหลดข้อมูล…",size="md",className="",progress}:LogoLoaderProps){
 const [simulatedProgress,setSimulatedProgress]=useState(progress??4);

 useEffect(()=>{
  if(progress!==undefined){setSimulatedProgress(Math.min(100,Math.max(0,progress)));return;}
  const timer=window.setInterval(()=>setSimulatedProgress(current=>{
   if(current>=96)return 96;
   return Math.min(96,current+Math.max(1,Math.ceil((96-current)*.07)));
  }),180);
  return()=>window.clearInterval(timer);
 },[progress]);

 const displayedProgress=Math.round(simulatedProgress);
 const progressStyle={"--loader-progress":`${displayedProgress*3.6}deg`} as CSSProperties;

 return <div role="status" aria-live="polite" aria-label={text||"กำลังโหลด"} className={`flex flex-col items-center justify-center gap-3 text-center ${className}`}>
  <div data-logo-loader-ring data-size={size} style={progressStyle}>
   <span data-logo-loader-track aria-hidden="true"/>
   <span data-logo-loader-spinner aria-hidden="true"/>
   <Image src="/brand/logo-app-stec.png" alt="" width={96} height={96} priority={size==="lg"}/>
  </div>
  <p data-logo-loader-label className="text-sm font-medium text-slate-500">
   {text&&<span>{text} </span>}<strong>{displayedProgress}%</strong>
  </p>
 </div>;
}
