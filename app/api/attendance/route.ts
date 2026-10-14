import {permissionsFor} from '@/lib/permissions/server';
import { NextRequest, NextResponse } from 'next/server';
import { AuthError, checkOrigin, currentSession, database, failure } from '@/lib/auth/server';
export async function GET() {
 try {
  const {employee}=await currentSession(); const db=database();
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const access=await permissionsFor(String(employee.id));
  const membership=await db.from('work_group_members').select('group_id,work_groups(active)').eq('employee_id',employee.id);if(membership.error)throw new AuthError('ยังไม่ได้ติดตั้งกลุ่มงาน',503);
  const ids=(membership.data||[]).filter((m:any)=>m.work_groups?.active).map(m=>m.group_id);
  const assigned=access.isSuperAdmin?null:await db.from('attendance_location_groups').select('location_id').in('group_id',ids.length?ids:['00000000-0000-0000-0000-000000000000']);if(assigned?.error)throw assigned.error;
  let locationsQuery=db.from('attendance_locations').select('*').eq('active',true);if(!access.isSuperAdmin)locationsQuery=locationsQuery.in('id',assigned?.data?.length?[...new Set(assigned.data.map(a=>a.location_id))]:['00000000-0000-0000-0000-000000000000']);
  const [locations,policy,record]=await Promise.all([locationsQuery,db.from('attendance_policy').select('*').eq('id',1).single(),db.from('attendance').select('*').eq('line_user_id',employee.line_user_id).eq('work_date',day).maybeSingle()]);
  if(locations.error||policy.error||record.error)throw new AuthError('อ่านข้อมูลลงเวลาไม่สำเร็จ',503);
  const events=record.data?await db.from('attendance_events').select('*,attendance_locations(name)').eq('attendance_id',record.data.id).order('recorded_at'): {data:[],error:null};
  if(events.error)throw events.error;
  return NextResponse.json({locations:locations.data,photoRequired:policy.data.photo_required,record:record.data,events:events.data},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
export async function POST(request:NextRequest){
 try {
  checkOrigin(request);const {employee}=await currentSession(); const b=await request.json();
  if(!['in','checkpoint','out'].includes(b.kind)||!Number.isFinite(b.latitude)||!Number.isFinite(b.longitude)||typeof b.locationId!=='string')throw new AuthError('ข้อมูลลงเวลาไม่ถูกต้อง');
  // Client GPS is evidence of a reported position, not proof against mock-location software.
  if(!Number.isFinite(b.timestamp)||Math.abs(Date.now()-b.timestamp)>120000)throw new AuthError('ตำแหน่งหมดอายุ กรุณาตรวจตำแหน่งใหม่');
  if(!Number.isFinite(b.accuracy)||b.accuracy<0||b.accuracy>200)throw new AuthError('GPS คลาดเคลื่อนเกิน 200 เมตร กรุณาตรวจตำแหน่งใหม่');
  if(b.photoUrl){
   const prefix=`/api/photos?path=${employee.id}/`;
   if(typeof b.photoUrl!=='string'||!b.photoUrl.startsWith(prefix))throw new AuthError('รูปไม่ถูกต้อง');
   const path=b.photoUrl.slice('/api/photos?path='.length); const file=await database().storage.from('attendance_photos').download(path);
   if(file.error)throw new AuthError('ไม่พบรูปยืนยัน');
  }
  const {data,error}=await database().rpc('office_record_attendance',{p_employee_id:employee.id,p_location_id:b.locationId,p_kind:b.kind,p_lat:b.latitude,p_lng:b.longitude,p_photo:b.photoUrl||null});
  if(error){const messages:Record<string,string>={OUTSIDE_RADIUS:'อยู่นอกรัศมีสถานที่ที่อนุญาต',LOCATION_DENIED:'ไม่ได้รับสิทธิ์ลงเวลาที่สถานที่นี้',PHOTO_REQUIRED:'กรุณาถ่ายรูปก่อนลงเวลา',ALREADY_STARTED:'ลงเวลาเข้างานแล้ว',NO_OPEN_ATTENDANCE:'ยังไม่เข้างาน หรือออกงานแล้ว',INVALID_INPUT:'พิกัดไม่ถูกต้อง'};throw new AuthError(Object.entries(messages).find(([key])=>error.message.includes(key))?.[1]||'บันทึกลงเวลาไม่สำเร็จ',409);}
  return NextResponse.json({id:data});
 }catch(e){return failure(e);}
}
