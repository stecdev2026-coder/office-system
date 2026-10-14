import mysql from 'mysql2/promise';
import { randomBytes,scrypt,createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=await mysql.createConnection({host:'127.0.0.1',port:3307,user:'office_app',password:process.env.MYSQL_PASSWORD,database:'office_trial'});
const base='http://localhost:4001',date='2000-01-01';
try{
 const salt=randomBytes(16).toString('hex'),key=await promisify(scrypt)('TrialOnly-2026!',salt,64);
 for(let i=1;i<=200;i++)await db.execute('INSERT IGNORE INTO trial_users(id,username,password_hash) VALUES(?,?,?)',[1000+i,`load${String(i).padStart(3,'0')}`,`${salt}:${key.toString('hex')}`]);
 await db.execute('DELETE FROM trial_attendance WHERE user_id BETWEEN 1001 AND 1200 AND work_date=?',[date]);
 const unauthorized=await fetch(base+'/attendance');assert.equal(unauthorized.status,401);
 const crossOrigin=await fetch(base+'/login',{method:'POST',headers:{Origin:'https://external.example','Content-Type':'application/json'},body:'{}'});assert.equal(crossOrigin.status,403);
 const wrong=await fetch(base+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'demo200',password:'incorrect',deviceToken:'a'.repeat(64)})});assert.equal(wrong.status,401);
 const started=performance.now();
 const results=await Promise.all(Array.from({length:200},async(_,index)=>{
  const username=`load${String(index+1).padStart(3,'0')}`,start=performance.now();
  const deviceToken=createHash('sha256').update('local-load-test:'+username).digest('hex');
  const login=await fetch(base+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'TrialOnly-2026!',deviceToken})});
  assert.equal(login.status,200,username+' login');const cookie=login.headers.get('set-cookie').split(';')[0];const loginMs=performance.now()-start;
  const save=await fetch(base+'/attendance',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({workDate:date})});assert.equal(save.status,201,username+' save');
  const duplicate=await fetch(base+'/attendance',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({workDate:date})});assert.equal(duplicate.status,409,username+' duplicate guard');
  const rows=await(await fetch(base+'/attendance',{headers:{Cookie:cookie}})).json();assert.equal(rows.records.filter(r=>r.work_date===date).length,1);
  if(index===0){const other=await fetch(base+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'TrialOnly-2026!',deviceToken:'b'.repeat(64)})});assert.equal(other.status,403,'second-device rejection');}
  return {loginMs,totalMs:performance.now()-start};
 }));
 const [rows]=await db.execute('SELECT COUNT(*) AS count FROM trial_attendance WHERE user_id BETWEEN 1001 AND 1200 AND work_date=?',[date]);assert.equal(rows[0].count,200);
 const times=results.map(r=>r.loginMs).sort((a,b)=>a-b);
 const report={testedAt:new Date().toISOString(),environment:'Local Docker MySQL 8.4; host Node API; pool 10; isolated synthetic data',concurrentUsers:200,successfulLogins:200,savedRecords:rows[0].count,duplicateRequestsRejected:200,unauthenticatedReadRejected:true,crossOriginRejected:true,wrongPasswordRejected:true,secondDeviceRejected:true,elapsedSeconds:Number(((performance.now()-started)/1000).toFixed(2)),loginP50Ms:Math.round(times[99]),loginP95Ms:Math.round(times[189]),loginMaxMs:Math.round(times[199]),limitation:'One local synthetic burst; not a production capacity guarantee'};
 await writeFile('docs/mysql-trial-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await db.end();}
