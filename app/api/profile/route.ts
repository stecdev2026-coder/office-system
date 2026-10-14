import {NextRequest,NextResponse} from 'next/server';
import {AuthError,checkOrigin,currentSession,database,failure,publicEmployee} from '@/lib/auth/server';
export async function GET(){try{const {employee}=await currentSession();const account=await database().from('office_credentials').select('username').eq('employee_id',employee.id).maybeSingle();if(account.error)throw account.error;return NextResponse.json({employee:publicEmployee(employee),username:account.data?.username||null,hasPassword:!!account.data},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function PATCH(request:NextRequest){
 try{
  checkOrigin(request);const {employee}=await currentSession(),body=await request.json();
  const allowed=['first_name','last_name','nickname','email','phone','profile_photo_url'];
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))throw new AuthError('ข้อมูล HR แก้ไขได้โดยผู้ดูแลเท่านั้น',403);
  for(const key of Object.keys(body)){if(typeof body[key]!=='string'||body[key].length>200)throw new AuthError('ข้อมูลส่วนตัวไม่ถูกต้อง');body[key]=body[key].trim();}
  for(const key of ['first_name','last_name'])if(key in body&&!body[key])throw new AuthError('กรุณากรอกชื่อและนามสกุล');
  if('email' in body&&body.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))throw new AuthError('อีเมลไม่ถูกต้อง');
  if('phone' in body&&body.phone&&!/^[+0-9() .-]{3,40}$/.test(body.phone))throw new AuthError('เบอร์โทรไม่ถูกต้อง');
  if(body.profile_photo_url){
   const prefix=`/api/photos?path=${employee.id}/`;
   const filename=body.profile_photo_url.slice(prefix.length);
   if(!body.profile_photo_url.startsWith(prefix)||! /^[a-f0-9-]+\.(jpg|png|webp)$/.test(filename))throw new AuthError('รูปต้องเป็นของบัญชีนี้',403);
   const file=await database().storage.from('attendance_photos').download(body.profile_photo_url.slice('/api/photos?path='.length));
   if(file.error)throw new AuthError('ไม่พบรูปโปรไฟล์');
  }
  const result=await database().from('employees').update(body).eq('id',employee.id).select('*').single();if(result.error)throw result.error;
  return NextResponse.json({employee:publicEmployee(result.data)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e);}
}
