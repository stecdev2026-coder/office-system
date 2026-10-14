import {NextRequest,NextResponse} from 'next/server';
import {AuthError,checkOrigin,database,failure,settings} from '@/lib/auth/server';
export async function POST(request:NextRequest){try{
 checkOrigin(request);if(!(await settings()).line_login_enabled)throw new AuthError('ปิดการลงชื่อผ่าน LINE แล้ว',403);
 const {accessToken,firstName,lastName,nickname,position}=await request.json();
 if(typeof accessToken!=='string'||typeof firstName!=='string'||typeof lastName!=='string'||!firstName.trim()||!lastName.trim()||[firstName,lastName,nickname,position].some(v=>v!==undefined&&(typeof v!=='string'||v.length>100)))throw new AuthError('ข้อมูลไม่ถูกต้อง');
 if(!process.env.LINE_LOGIN_CHANNEL_ID)throw new AuthError('ยังไม่ได้ตั้งค่า LINE',503);
 const verified=await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
 const claims=await verified.json();if(!verified.ok||claims.client_id!==process.env.LINE_LOGIN_CHANNEL_ID||claims.expires_in<=0)throw new AuthError('กรุณาลงชื่อผ่าน LINE ใหม่',401);
 const profileResponse=await fetch('https://api.line.me/v2/profile',{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'});if(!profileResponse.ok)throw new AuthError('ตรวจสอบ LINE ไม่สำเร็จ',401);const profile=await profileResponse.json();
 const db=database();const {error}=await db.from('employees').insert({line_user_id:profile.userId,first_name:firstName.trim(),last_name:lastName.trim(),nickname:nickname||null,position:position||null,role:'Staff',is_active:false,status:'pending'});
 if(error?.code==='23505')throw new AuthError('บัญชีนี้ลงทะเบียนแล้ว',409);if(error)throw new AuthError('ลงทะเบียนไม่สำเร็จ',503);return NextResponse.json({ok:true});
}catch(error){return failure(error);}}
