import LegacySchedules from '@/components/LegacySchedules';
export default async function Page({searchParams}:{searchParams:Promise<{id?:string}>}){const {id}=await searchParams;return id?<LegacySchedules editor scheduleId={id}/>:<p role="alert">ไม่พบตารางงาน</p>;}
