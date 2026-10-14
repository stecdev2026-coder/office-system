export const permissionCatalog=[
 ['attendance.view','ดูรายการลงเวลา','ลงเวลา'],['attendance.export','ส่งออก Excel ลงเวลา','ลงเวลา'],['absence.view','ดูการขาดงานรายสัปดาห์','ลงเวลา'],
 ['users.view','ดูพนักงาน','พนักงาน'],['users.create','เพิ่มพนักงาน','พนักงาน'],['users.edit','แก้ไข/อนุมัติพนักงาน','พนักงาน'],['users.delete','ลบพนักงาน','พนักงาน'],['users.accounts','จัดการ Username/Password และเครื่อง','พนักงาน'],['users.import','นำเข้าพนักงาน Excel','พนักงาน'],
 ['groups.view','ดูกลุ่มงาน','กลุ่มงาน'],['groups.edit','สร้าง/แก้ไขกลุ่มและวันทำงาน','กลุ่มงาน'],['groups.members','จัดการสมาชิก/วันทำงานต่อคน','กลุ่มงาน'],
 ['locations.view','ดูสถานที่ลงเวลา','สถานที่'],['locations.edit','แก้ไขสถานที่/รูปถ่าย','สถานที่'],['locations.assign','กำหนดกลุ่มที่ใช้สถานที่','สถานที่'],
 ['requests.view','ดูคำขอลา','คำขอลา'],['requests.approve','อนุมัติคำขอลา','คำขอลา'],['settings.view','ดูตั้งค่าระบบ','ระบบ'],['settings.edit','แก้ไขตั้งค่าระบบ','ระบบ'],['usage.view','ดูการใช้งาน Supabase/Vercel','ระบบ'],
 ['permissions.view','ดู Permission','สิทธิ์'],['permissions.manage','จัดการบทบาทและมอบสิทธิ์','สิทธิ์'],['calendar.manage','จัดการปฏิทิน','ระบบ'],['travel.manage','จัดการการเดินทาง','ระบบ']
] as const;
export const allPermissionKeys=permissionCatalog.map(p=>p[0]);
export const menuPermission:Record<string,string>={'/admin/attendance':'attendance.view','/admin/absence':'absence.view','/admin/users':'users.view','/admin/groups':'groups.view','/admin/workforce':'locations.view','/admin/leaves':'requests.view','/admin/settings':'settings.view','/admin/usage':'usage.view','/admin/permissions':'permissions.view'};
menuPermission['/admin/workforce/create']='locations.edit';
Object.assign(menuPermission,{'/admin/groups/create':'groups.edit','/admin/groups/edit':'groups.view','/admin/groups/schedules':'groups.view','/admin/groups/schedules/create':'groups.edit','/admin/groups/schedules/edit':'groups.view','/admin/permissions/create':'permissions.manage','/admin/permissions/edit':'permissions.view','/admin/permissions/assign':'permissions.view'});
export const hasPermission=(permissions:readonly string[],key:string)=>permissions.includes('*')||permissions.includes(key);
export const canAccessBackoffice=(permissions:readonly string[])=>permissions.includes('*')||Object.values(menuPermission).some(key=>permissions.includes(key));

export const permissionDependencies:Record<string,string>={'attendance.export':'attendance.view','users.create':'users.view','users.edit':'users.view','users.delete':'users.view','users.accounts':'users.view','users.import':'users.view','groups.edit':'groups.view','groups.members':'groups.view','locations.edit':'locations.view','locations.assign':'locations.view','requests.approve':'requests.view','settings.edit':'settings.view','permissions.manage':'permissions.view'};
