import {createClient} from '@supabase/supabase-js';
import {randomBytes,randomUUID,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
if(url!=='https://ikkgncneoenaktlwotmp.supabase.co')throw Error('This setup only targets the authorized new project');
const db=createClient(url,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
for(const table of ['employees','office_credentials','office_auth_admins']){const {error}=await db.from(table).select('*').limit(1);if(error)throw Error('Apply supabase/setup/new-project.sql before running administrator setup');}
let credentials;try{credentials=JSON.parse(await readFile('.admin-bootstrap.local.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;credentials={employeeId:randomUUID(),username:'admin',password:randomBytes(18).toString('base64url')};await writeFile('.admin-bootstrap.local.json',JSON.stringify(credentials,null,2)+'\n',{flag:'wx'});}
const {data:existing}=await db.from('employees').select('id').eq('id',credentials.employeeId).maybeSingle();
if(!existing){const {count}=await db.from('employees').select('id',{head:true,count:'exact'});if(count!==0)throw Error('Database already contains employees; use the existing Admin bootstrap instead');const {error}=await db.from('employees').insert({id:credentials.employeeId,first_name:'ผู้ดูแล',last_name:'ระบบ',employee_code:'ADMIN001',role:'Admin',is_active:true,status:'active'});if(error)throw Error('Creating initial administrator failed');}
const {data:account}=await db.from('office_credentials').select('username').eq('employee_id',credentials.employeeId).maybeSingle();
if(!account){const salt=randomBytes(16).toString('hex'),key=await promisify(scrypt)(credentials.password,salt,64);const {error}=await db.rpc('office_set_credentials',{p_employee_id:credentials.employeeId,p_username:credentials.username,p_password_hash:`scrypt:${salt}:${key.toString('hex')}`});if(error)throw Error('Saving administrator credentials failed');}
const {error}=await db.from('office_auth_admins').upsert({employee_id:credentials.employeeId});if(error)throw Error('Saving administrator authorization failed');
if(!process.env.LINE_LOGIN_CHANNEL_ID){const {error}=await db.rpc('office_set_line_login',{p_enabled:false});if(error)throw Error('Saving initial login settings failed');}
console.log('Initial administrator ready. Credentials are in .admin-bootstrap.local.json (not printed).');
