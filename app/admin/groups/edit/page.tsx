import GroupEditor from '@/components/GroupEditor';
export default async function Page({searchParams}:{searchParams:Promise<{id?:string}>}){const {id}=await searchParams;return id?<GroupEditor groupId={id}/>:<p role="alert">ไม่พบกลุ่มงาน กรุณาเลือกจากหน้ารายการ</p>;}
