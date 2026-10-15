"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";

type LogoLoaderProps={text?:string;size?:"sm"|"md"|"lg";className?:string;progress?:number};

let sharedProgress=4;
let sharedTimer:ReturnType<typeof setInterval>|null=null;
let resetTimer:ReturnType<typeof setTimeout>|null=null;
const progressListeners=new Set<(value:number)=>void>();

function startSharedProgress(){
 if(resetTimer){clearTimeout(resetTimer);resetTimer=null;}
 if(sharedTimer)return;
 sharedTimer=setInterval(()=>{
  if(sharedProgress<96)sharedProgress=Math.min(96,sharedProgress+Math.max(1,Math.ceil((96-sharedProgress)*.07)));
  progressListeners.forEach(listener=>listener(sharedProgress));
 },180);
}

function stopSharedProgress(){
 if(progressListeners.size||!sharedTimer)return;
 clearInterval(sharedTimer);sharedTimer=null;
 resetTimer=setTimeout(()=>{sharedProgress=4;resetTimer=null;},650);
}

export default function LogoLoader({text="กำลังโหลดข้อมูล…",size="md",className="",progress}:LogoLoaderProps){
 const [simulatedProgress,setSimulatedProgress]=useState(progress??sharedProgress);

 useEffect(()=>{
  if(progress!==undefined){setSimulatedProgress(Math.min(100,Math.max(0,progress)));return;}
  progressListeners.add(setSimulatedProgress);setSimulatedProgress(sharedProgress);startSharedProgress();
  return()=>{progressListeners.delete(setSimulatedProgress);stopSharedProgress();};
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
