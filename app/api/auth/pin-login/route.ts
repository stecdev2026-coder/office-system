import { NextRequest, NextResponse } from 'next/server';
import { permissionsFor } from '@/lib/permissions/server';
import { AuthError, checkOrigin, database, deviceMetadata, failure, publicEmployee } from '@/lib/auth/server';
import { newToken, tokenHash, verifyPassword } from '@/lib/auth/crypto';

export const runtime = 'nodejs';

export async function POST(request:NextRequest){
 try{
  checkOrigin(request);
  const {employeeId,deviceToken,pin}=await request.json();
  if(typeof employeeId!=='string'||employeeId.length>128||typeof deviceToken!=='string'||!/^[a-zA-Z0-9_-]{32,128}$/.test(deviceToken)||typeof pin!=='string'||!/^\d{6}$/.test(pin))throw new AuthError('กรุณากรอก PIN 6 หลัก');
  const db=database(),deviceHash=tokenHash(deviceToken),now=new Date();
  const [{data:credential,error:credentialError},{data:employee,error:employeeError},{data:device,error:deviceError},{data:admin,error:adminError}]=await Promise.all([
   db.from('office_pin_credentials').select('*').eq('employee_id',employeeId).maybeSingle(),
   db.from('employees').select('*').eq('id',employeeId).maybeSingle(),
   db.from('office_devices').select('device_hash').eq('employee_id',employeeId).maybeSingle(),
   db.from('office_auth_admins').select('employee_id').eq('employee_id',employeeId).maybeSingle()
  ]);
  if(credentialError||employeeError||deviceError||adminError)throw new AuthError('ตรวจสอบ PIN ไม่สำเร็จ',503);
  if(!employee||employee.is_active!==true||admin&&employee.role==='Admin')throw new AuthError('บัญชีนี้ไม่สามารถเข้าสู่ระบบด้วย PIN',403);
  if(!credential?.enabled||credential.device_hash!==deviceHash||device?.device_hash!==deviceHash)throw new AuthError('PIN ไม่พร้อมใช้บนเครื่องนี้ กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้หรือ LINE',401);
  const reauthExpiry=new Date(String(credential.reauth_expires_at||0));
  if(!Number.isFinite(reauthExpiry.getTime())||reauthExpiry<=now)throw new AuthError('อายุการเข้าสู่ระบบครบแล้ว กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้หรือ LINE ใหม่',401);
  const attemptKey=tokenHash(`pin-login:${employeeId}`),{data:permitted,error:throttleError}=await db.rpc('office_login_attempt',{p_key:attemptKey});
  if(throttleError)throw new AuthError('ระบบ PIN ยังไม่พร้อม',503);
  if(!permitted)throw new AuthError('กรอก PIN ผิดหลายครั้ง กรุณารอ 15 นาที',429);
  if(!await verifyPassword(pin,credential.pin_hash))throw new AuthError('PIN ไม่ถูกต้อง',401);
  const token=newToken(),hashedToken=tokenHash(token),issued=await db.rpc('office_issue_session',{p_employee_id:employeeId,p_device_hash:deviceHash,p_token_hash:hashedToken,p_method:'pin'});
  if(issued.error)throw new AuthError('สร้าง session ไม่สำเร็จ',503);
  const remembered=await db.from('office_devices').update(deviceMetadata(request)).eq('employee_id',employeeId).eq('device_hash',deviceHash);
  if(remembered.error)throw new AuthError('บันทึกรายละเอียดอุปกรณ์ไม่สำเร็จ',503);
  const expiry=await db.from('office_sessions').update({expires_at:reauthExpiry.toISOString()}).eq('token_hash',hashedToken);
  if(expiry.error)throw new AuthError('กำหนดอายุ session ไม่สำเร็จ',503);
  await db.from('office_login_attempts').delete().eq('key',attemptKey);
  const access=await permissionsFor(employeeId),profile={userId:employee.line_user_id||`employee_${employee.id}`,displayName:`${employee.first_name||''} ${employee.last_name||''}`.trim(),pictureUrl:employee.profile_photo_url||''};
  const response=NextResponse.json({...access,sessionDays:Math.ceil((reauthExpiry.getTime()-now.getTime())/86400000),employee:{...publicEmployee(employee),is_super_admin:access.isSuperAdmin},profile});
  response.headers.set('Cache-Control','no-store');
  response.cookies.set('office_session',token,{httpOnly:true,sameSite:'lax',secure:new URL(process.env.APP_URL||request.url).protocol==='https:',path:'/',maxAge:Math.max(1,Math.floor((reauthExpiry.getTime()-now.getTime())/1000))});
  return response;
 }catch(error){return failure(error);}
}
