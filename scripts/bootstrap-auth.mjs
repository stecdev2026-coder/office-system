// Operator-only bootstrap; never expose this operation as a public API.
import { createClient } from '@supabase/supabase-js';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Configure SUPABASE_SECRET_KEY and apply the SQL migration first.');
let muted = false;
const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback(); } });
const terminal = createInterface({ input: process.stdin, output, terminal: !!process.stdin.isTTY });
try {
  const employeeId = (await terminal.question('Existing approved Admin employee ID: ')).trim();
  const username = (await terminal.question('Username (3-64 characters): ')).trim().toLowerCase();
  process.stdout.write('Password (8-128 characters, hidden): '); muted = true;
  const password = await terminal.question(''); muted = false; process.stdout.write('\n');
  if (!/^[a-z0-9._-]{3,64}$/.test(username) || password.length < 8 || password.length > 128) throw new Error('Invalid username or password length.');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
  const { data: employee, error } = await db.from('employees').select('id,role,is_active').eq('id',employeeId).single();
  if (error || employee?.role !== 'Admin' || employee?.is_active !== true) throw new Error('Choose an existing approved Admin.');
  const salt = randomBytes(16).toString('hex');
  const hash = await promisify(scrypt)(password,salt,64);
  const { error: saveError } = await db.rpc('office_set_credentials', { p_employee_id: employeeId, p_username: username, p_password_hash: `scrypt:${salt}:${hash.toString('hex')}` });
  if (saveError) throw new Error('Could not save credentials. Check migration and username uniqueness.');
  const { error: adminError } = await db.from('office_auth_admins').upsert({ employee_id: employeeId });
  if (adminError) throw new Error('Could not grant trusted administrator access.');
  console.log('Admin account configured. Sign in with the new username and password.');
} finally { terminal.close(); }
