import {NextRequest,NextResponse} from 'next/server';
import {AuthError,checkOrigin,database,failure,publicEmployee} from '@/lib/auth/server';
import {requirePermission,rejectSuperTarget,protectedEmployeeIds} from '@/lib/permissions/server';
import {permissionCatalog,allPermissionKeys,hasPermission,permissionDependencies} from '@/lib/permissions/catalog';
import {allRows,uuid} from '@/lib/groups/database';
export async function GET(){try{await requirePermission('permissions.view');const [roles,assignments,employees,superIds]=await Promise.all([allRows('permission_roles'),allRows('employee_permission_roles'),allRows('employees','id,first_name,last_name,employee_code,branch,is_active'),protectedEmployeeIds()]);return NextResponse.json({catalog:permissionCatalog,roles,assignments,employees:employees.map(e=>({...publicEmployee(e),is_super_admin:superIds.includes(e.id)}))},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(request:NextRequest){try{checkOrigin(request);const auth=await requirePermission('permissions.manage'),b=await request.json(),db=database();
 if(b.type==='role'){
  const p=b.value;if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||!Array.isArray(p.permissions)||p.permissions.some((k:string)=>!allPermissionKeys.includes(k as any)))throw new AuthError('บทบาทหรือสิทธิ์ไม่ถูกต้อง');
  if(/^super\s*admin$/i.test(p.name.trim()))throw new AuthError('ชื่อ Super Admin สงวนสำหรับบัญชีเริ่มต้นของระบบ');
  if(p.permissions.some((key:string)=>permissionDependencies[key]&&!p.permissions.includes(permissionDependencies[key])))throw new AuthError('ต้องเลือกสิทธิ์ดูเมนูก่อนเลือกสิทธิ์ดำเนินการ');
  if(!auth.isSuperAdmin&&p.permissions.some((key:string)=>!hasPermission(auth.permissions,key)))throw new AuthError('มอบได้เฉพาะสิทธิ์ที่คุณมี',403);
  const row={name:p.name.trim(),description:String(p.description||'').slice(0,300),permissions:[...new Set(p.permissions)]};
  if(p.id){if(!uuid(p.id))throw new AuthError('บทบาทไม่ถูกต้อง');const role=await db.from('permission_roles').select('is_system').eq('id',p.id).single();if(role.error)throw role.error;if(role.data.is_system)throw new AuthError('บทบาทเริ่มต้นแก้ไขไม่ได้ ให้สร้างบทบาทใหม่');const r=await db.from('permission_roles').update(row).eq('id',p.id);if(r.error)throw r.error;}else{const r=await db.from('permission_roles').insert(row);if(r.error)throw new AuthError('ชื่อบทบาทนี้มีแล้ว',409);}
 }else if(b.type==='assignment'){
  if(!uuid(b.employeeId)||!Array.isArray(b.roleIds)||b.roleIds.some((id:string)=>!uuid(id)))throw new AuthError('ข้อมูลมอบสิทธิ์ไม่ถูกต้อง');await rejectSuperTarget(b.employeeId);if(b.employeeId===auth.employee.id)throw new AuthError('ไม่สามารถเปลี่ยนบทบาทของตัวเองจากหน้านี้');
  const r=await db.rpc('office_assign_roles',{p_actor_id:auth.employee.id,p_employee_id:b.employeeId,p_role_ids:b.roleIds});if(r.error)throw new AuthError('มอบบทบาทไม่สำเร็จ ตรวจสิทธิ์และบทบาทที่เลือก',403);
 }else throw new AuthError('คำขอไม่ถูกต้อง');return NextResponse.json({ok:true});
}catch(e){return failure(e);}}
