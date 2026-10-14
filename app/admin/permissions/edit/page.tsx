import PermissionRoleEditor from '@/components/PermissionRoleEditor';
export default async function Page({searchParams}:{searchParams:Promise<{id?:string}>}){const {id}=await searchParams;return id?<PermissionRoleEditor roleId={id}/>:<p role="alert">ไม่พบบทบาท กรุณาเลือกจากหน้ารายการ</p>;}
