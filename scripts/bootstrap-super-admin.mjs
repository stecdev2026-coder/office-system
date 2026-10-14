import {createClient} from '@supabase/supabase-js';import {randomUUID,randomBytes} from 'node:crypto';import fs from 'node:fs/promises';import {hashPassword} from '../lib/auth/crypto.ts';
if(process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://ikkgncneoenaktlwotmp.supabase.co')throw Error('Unexpected project');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY),file='.super-admin-bootstrap.local.json';
const existing=await db.from('office_super_admins').select('employee_id').limit(1);if(existing.error)throw existing.error;
if(existing.data.length){console.log('Super Admin already exists; no password changed');}else{
 let credentials;try{credentials=JSON.parse(await fs.readFile(file,'utf8'));}catch{credentials={employeeId:randomUUID(),username:'superadmin',password:randomBytes(24).toString('base64url')};await fs.writeFile(file,JSON.stringify(credentials,null,2),{flag:'wx'});}
 const r=await db.rpc('office_bootstrap_super',{p_employee_id:credentials.employeeId,p_hash:await hashPassword(credentials.password)});if(r.error)throw r.error;console.log('Super Admin created; credentials saved in local ignored file');
}
