import {NextRequest,NextResponse} from 'next/server';
import {AuthError,checkOrigin,currentSession,database,failure} from '@/lib/auth/server';
import {hashPassword,verifyPassword} from '@/lib/auth/crypto';

const validPin=(value:unknown):value is string=>typeof value==='string'&&/^\d{6}$/.test(value);
async function isEligible(employeeId:string){const admin=await database().from('office_auth_admins').select('employee_id').eq('employee_id',employeeId).maybeSingle();if(admin.error)throw admin.error;return !admin.data;}

export async function GET(){try{const {employee,session}=await currentSession(),eligible=await isEligible(String(employee.id));if(!eligible)return NextResponse.json({eligible:false,enabled:false});const pin=await database().from('office_pin_credentials').select('enabled,device_hash').eq('employee_id',employee.id).maybeSingle();if(pin.error)throw pin.error;return NextResponse.json({eligible:true,enabled:!!pin.data?.enabled&&pin.data.device_hash===session.device_hash},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}

export async function POST(request:NextRequest){try{checkOrigin(request);const {employee,session}=await currentSession(),employeeId=String(employee.id);if(!await isEligible(employeeId))throw new AuthError('บัญชี Admin ใช้ PIN สำหรับสิทธิ์หลังบ้านไม่ได้',403);const body=await request.json(),action=body.action,db=database(),stored=await db.from('office_pin_credentials').select('*').eq('employee_id',employeeId).maybeSingle();if(stored.error)throw stored.error;
 if(action==='verify'){
  if(!validPin(body.pin)||!stored.data?.enabled||stored.data.device_hash!==session.device_hash)throw new AuthError('PIN ไม่พร้อมใช้งาน กรุณาเข้าสู่ระบบใหม่',401);
  const attempt=await db.rpc('office_login_attempt',{p_key:`pin:${employeeId}`});if(attempt.error)throw attempt.error;if(!attempt.data)throw new AuthError('กรอก PIN ผิดหลายครั้ง กรุณารอ 15 นาที',429);
  if(!await verifyPassword(body.pin,stored.data.pin_hash))throw new AuthError('PIN ไม่ถูกต้อง',401);
  await db.from('office_login_attempts').delete().eq('key',`pin:${employeeId}`);return NextResponse.json({ok:true});
 }
 if(action==='save'){
  if(!validPin(body.pin)||body.pin!==body.confirmPin)throw new AuthError('PIN ต้องเป็นตัวเลข 6 หลักและยืนยันให้ตรงกัน');
  const fresh=Date.now()-Date.parse(session.created_at||0)<10*60000;
  if(stored.data?.enabled&&!fresh){if(!validPin(body.currentPin)||!await verifyPassword(body.currentPin,stored.data.pin_hash))throw new AuthError('PIN ปัจจุบันไม่ถูกต้อง',403);}
  const result=await db.from('office_pin_credentials').upsert({employee_id:employeeId,device_hash:session.device_hash,pin_hash:await hashPassword(body.pin),enabled:true,updated_at:new Date().toISOString()});if(result.error)throw result.error;return NextResponse.json({ok:true,enabled:true});
 }
 if(action==='disable'){
  if(!stored.data?.enabled)return NextResponse.json({ok:true,enabled:false});const fresh=Date.now()-Date.parse(session.created_at||0)<10*60000;
  if(!fresh&&(!validPin(body.currentPin)||!await verifyPassword(body.currentPin,stored.data.pin_hash)))throw new AuthError('PIN ปัจจุบันไม่ถูกต้อง',403);
  const result=await db.from('office_pin_credentials').delete().eq('employee_id',employeeId);if(result.error)throw result.error;return NextResponse.json({ok:true,enabled:false});
 }
 throw new AuthError('คำขอไม่ถูกต้อง');
}catch(e){return failure(e);}}
