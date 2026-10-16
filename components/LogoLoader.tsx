"use client";

import Image from "next/image";

type LogoLoaderProps={text?:string;size?:"sm"|"md"|"lg";className?:string};

export default function LogoLoader({text="กำลังโหลดข้อมูล…",size="md",className=""}:LogoLoaderProps){
 return <div role="status" aria-live="polite" aria-label={text||"กำลังโหลด"} className={`flex flex-col items-center justify-center gap-3 text-center ${className}`}>
  <div data-logo-loader-ring data-size={size}>
   <span data-logo-loader-track aria-hidden="true"/>
   <span data-logo-loader-spinner aria-hidden="true"/>
   <Image src="/brand/logo-app-stec.png" alt="" width={96} height={96} priority={size==="lg"}/>
  </div>
  {text&&<p data-logo-loader-label className="text-sm font-medium text-slate-500">{text}</p>}
 </div>;
}
