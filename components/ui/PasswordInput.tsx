"use client";
import {useState,forwardRef} from 'react';
import {Eye,EyeOff} from 'lucide-react';
import type {InputHTMLAttributes} from 'react';
const PasswordInput=forwardRef<HTMLInputElement,InputHTMLAttributes<HTMLInputElement>>(function PasswordInput({className='',disabled,...props},ref){const [visible,S]=useState(false);return <div className="relative"><input {...props} ref={ref} disabled={disabled} type={visible?'text':'password'} className={`${className} pr-12`}/><button type="button" disabled={disabled} onClick={()=>S(!visible)} aria-label={visible?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน'} aria-pressed={visible} className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40">{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>;});
export default PasswordInput;
