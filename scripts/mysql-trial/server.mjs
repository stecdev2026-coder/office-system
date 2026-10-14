import http from 'node:http';
import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
const derive=promisify(scrypt),hash=value=>createHash('sha256').update(value).digest('hex');
const port=Number(process.env.MYSQL_TRIAL_API_PORT||4001);
if(!process.env.MYSQL_PASSWORD)throw Error('Configure .env.mysql.local first');
const pool=mysql.createPool({host:'127.0.0.1',port:3307,user:'office_app',password:process.env.MYSQL_PASSWORD,database:'office_trial',connectionLimit:10,waitForConnections:true,queueLimit:500,timezone:'Z',dateStrings:true});
await pool.query(`CREATE TABLE IF NOT EXISTS trial_users (id INT PRIMARY KEY,username VARCHAR(64) UNIQUE NOT NULL,password_hash VARCHAR(200) NOT NULL,device_hash CHAR(64) NULL) ENGINE=InnoDB`);
await pool.query(`CREATE TABLE IF NOT EXISTS trial_sessions (token_hash CHAR(64) PRIMARY KEY,user_id INT NOT NULL,expires_at DATETIME NOT NULL,FOREIGN KEY(user_id) REFERENCES trial_users(id)) ENGINE=InnoDB`);
await pool.query(`CREATE TABLE IF NOT EXISTS trial_attendance (id BIGINT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,work_date DATE NOT NULL,check_in_time DATETIME(3) NOT NULL,UNIQUE KEY one_checkin(user_id,work_date),FOREIGN KEY(user_id) REFERENCES trial_users(id)) ENGINE=InnoDB`);
for(let id=1;id<=200;id++){
 const [found]=await pool.execute('SELECT id FROM trial_users WHERE id=?',[id]);if(found.length)continue;
 const salt=randomBytes(16).toString('hex'),key=await derive('TrialOnly-2026!',salt,64);
 await pool.execute('INSERT INTO trial_users(id,username,password_hash) VALUES(?,?,?)',[id,`demo${String(id).padStart(3,'0')}`,`${salt}:${key.toString('hex')}`]);
}
async function transaction(task){
 for(let attempt=0;attempt<4;attempt++){
  const connection=await pool.getConnection();
  try{await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await connection.beginTransaction();await task(connection);await connection.commit();return;}
  catch(error){await connection.rollback();if(!['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code)||attempt===3)throw error;}
  finally{connection.release();}
  await new Promise(resolve=>setTimeout(resolve,20*(attempt+1)+Math.random()*30));
 }
}
const attempts=new Map();
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>8192)throw Error('INVALID_BODY');}return JSON.parse(text||'{}');}
async function user(req){const match=(req.headers.cookie||'').match(/(?:^|;\s*)mysql_trial_session=([a-f0-9]{64})(?:;|$)/);if(!match)throw Error('UNAUTHORIZED');const [rows]=await pool.execute('SELECT user_id FROM trial_sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP()',[hash(match[1])]);if(!rows.length)throw Error('UNAUTHORIZED');return rows[0].user_id;}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,`http://localhost:${port}`);
  if(req.method==='POST'&&req.headers.origin&& ![`http://localhost:${port}`,`http://127.0.0.1:${port}`].includes(req.headers.origin))return reply(res,403,{error:'Origin rejected'});
  if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"});return res.end(await readFile(new URL('./index.html',import.meta.url)));}
  if(req.method==='GET'&&url.pathname==='/health'){await pool.execute('SELECT 1');return reply(res,200,{ready:true,database:'office_trial',isolated:true});}
  if(req.method==='POST'&&url.pathname==='/login'){
   const {username,password,deviceToken}=await body(req);
   if(typeof username!=='string'||typeof password!=='string'||password.length>128||typeof deviceToken!=='string'||!/^[a-zA-Z0-9_-]{32,128}$/.test(deviceToken))return reply(res,400,{error:'Invalid login fields'});
   const attemptKey=hash(username.toLowerCase()),previous=attempts.get(attemptKey),now=Date.now();
   const attempt=!previous||now-previous.start>900000?{start:now,count:0}:previous;
   if(++attempt.count>10)return reply(res,429,{error:'Too many attempts'});attempts.set(attemptKey,attempt);
   const [rows]=await pool.execute('SELECT * FROM trial_users WHERE username=?',[username.toLowerCase()]);
   const [salt,expected]=(rows[0]?.password_hash||`${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
   const actual=await derive(password,salt,64);
   if(!rows.length||!timingSafeEqual(actual,Buffer.from(expected,'hex')))return reply(res,401,{error:'Username or password incorrect'});
   const token=randomBytes(32).toString('hex');
   await transaction(async connection=>{const [locked]=await connection.execute('SELECT device_hash FROM trial_users WHERE id=? FOR UPDATE',[rows[0].id]);
    if(locked[0].device_hash&&locked[0].device_hash!==hash(deviceToken))throw Error('DEVICE_MISMATCH');
    await connection.execute('UPDATE trial_users SET device_hash=? WHERE id=?',[hash(deviceToken),rows[0].id]);
    await connection.execute('DELETE FROM trial_sessions WHERE user_id=?',[rows[0].id]);
    await connection.execute('INSERT INTO trial_sessions(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY))',[hash(token),rows[0].id]);
   });
   attempts.delete(attemptKey);res.setHeader('Set-Cookie',`mysql_trial_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);return reply(res,200,{username:rows[0].username,userId:rows[0].id});
  }
  if(url.pathname==='/attendance'&&req.method==='POST'){
   const id=await user(req),payload=await body(req);
   const date=payload.workDate||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return reply(res,400,{error:'Invalid work date'});
   try{await pool.execute('INSERT INTO trial_attendance(user_id,work_date,check_in_time) VALUES(?,?,UTC_TIMESTAMP(3))',[id,date]);}catch(error){if(error.code==='ER_DUP_ENTRY')return reply(res,409,{error:'Already checked in for this day'});throw error;}
   return reply(res,201,{saved:true});
  }
  if(url.pathname==='/attendance'&&req.method==='GET'){const id=await user(req);const [rows]=await pool.execute('SELECT * FROM trial_attendance WHERE user_id=? ORDER BY work_date DESC LIMIT 100',[id]);return reply(res,200,{records:rows});}
  if(url.pathname==='/logout'&&req.method==='POST'){const match=(req.headers.cookie||'').match(/mysql_trial_session=([a-f0-9]{64})/);if(match)await pool.execute('DELETE FROM trial_sessions WHERE token_hash=?',[hash(match[1])]);res.setHeader('Set-Cookie','mysql_trial_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return reply(res,200,{ok:true});}
  reply(res,404,{error:'Not found'});
 }catch(error){console.error('Trial API error:',error.code||error.message);const status=error.message==='UNAUTHORIZED'?401:error.message==='DEVICE_MISMATCH'?403:error instanceof SyntaxError||error.message==='INVALID_BODY'?400:503;reply(res,status,{error:status===403?'Account bound to another browser':status===401?'Please log in':status===400?'Invalid request':'Trial database unavailable'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`MySQL isolated trial: http://localhost:${port} (200 synthetic accounts)`));
const cleanup=setInterval(()=>{for(const [key,value]of attempts)if(Date.now()-value.start>900000)attempts.delete(key);},60000);cleanup.unref();
async function stop(){server.close();await pool.end();process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);
