import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createClient} from '@supabase/supabase-js';import {randomUUID} from 'node:crypto';
const credentials=JSON.parse(await fs.readFile('.admin-bootstrap.local.json','utf8'));
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}}),base='http://localhost:3000';
let cookie;let attendanceId,photoPath;
async function request(path,method='GET',body,auth=true){const headers={Origin:base};if(auth&&cookie)headers.Cookie=cookie;if(body!==undefined)headers['Content-Type']='application/json';return fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});}
try{
 let response=await request('/api/auth/login','POST',{username:credentials.username,password:'incorrect',deviceToken:'a'.repeat(64)},false);assert.equal(response.status,401);
 response=await request('/api/auth/login','POST',{username:credentials.username,password:credentials.password,deviceToken:'a'.repeat(64)},false);assert.equal(response.status,200);cookie=response.headers.get('set-cookie').split(';')[0];
 const user=await response.json();assert.equal(user.employee.role,'Admin');
 for(const table of ['employees','attendance','leave_requests','travel_trips','travel_checkpoints','calendar_events','notifications','company_settings','company_holidays']){response=await request('/api/data/'+table+'?select=*');assert.equal(response.status,200,table);}
 response=await request('/api/admin/accounts');assert.equal(response.status,200);
 response=await request('/api/auth/login','POST',{username:credentials.username,password:credentials.password,deviceToken:'b'.repeat(64)},false);assert.equal(response.status,403);
 response=await request('/api/data/office_credentials');assert.equal(response.status,404);
 response=await request('/api/data/attendance','GET',undefined,false);assert.equal(response.status,401);
 const date='2000-01-01';response=await request('/api/data/attendance','POST',[{line_user_id:user.employee.line_user_id,work_date:date,check_in_time:new Date().toISOString()}]);assert.equal(response.status,201);
 const record=await db.from('attendance').select('id').eq('line_user_id',user.employee.line_user_id).eq('work_date',date).single();assert.ok(record.data);attendanceId=record.data.id;
 response=await request('/api/data/attendance','POST',[{line_user_id:user.employee.line_user_id,work_date:date}]);assert.equal(response.status,409);
 const form=new FormData();form.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'test.png');response=await fetch(base+'/api/photos',{method:'POST',headers:{Origin:base,Cookie:cookie},body:form});assert.equal(response.status,200);const photo=await response.json();photoPath=new URL(photo.url,base).searchParams.get('path');response=await request(photo.url);assert.equal(response.status,200);response=await request(photo.url,'GET',undefined,false);assert.equal(response.status,401);
 response=await request('/api/auth/logout','POST',{});assert.equal(response.status,200);response=await request('/api/auth/session');assert.equal(response.status,401);
 console.log('Live Supabase checks passed: login, 9 work tables, admin access, device binding, duplicate attendance, private photos and logout');
}finally{
 if(attendanceId)await db.from('attendance').delete().eq('id',attendanceId);
 if(photoPath)await db.storage.from('attendance_photos').remove([photoPath]);
 await db.rpc('office_reset_device',{p_employee_id:credentials.employeeId});
 await db.from('office_login_attempts').delete().eq('key',(await import('node:crypto')).createHash('sha256').update(credentials.username).digest('hex'));
}
