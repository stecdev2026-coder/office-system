import {spawn} from 'node:child_process';import {createReadStream}from'node:fs';import {pipeline}from'node:stream/promises';
const file=process.argv[2];if(!file)throw Error('Provide a trial snapshot path');
const name='office_trial_restore_'+Date.now();if(!/^office_trial_restore_\d+$/.test(name))throw Error('Invalid test database');
const args=['compose','--env-file','.env.mysql.local','-f','compose.mysql.yml','exec','-T','mysql','sh','-c'];
async function run(command,input){const child=spawn('docker',[...args,command],{stdio:['pipe','pipe','pipe']});let output='',error='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>error+=c);const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve(output):reject(Error(error)));});if(input)await pipeline(createReadStream(input),child.stdin);else child.stdin.end();return done;}
await run(`MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -e 'CREATE DATABASE ${name}'`);
await run(`MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root ${name}`,file);
const count=await run(`MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -N ${name} -e 'SELECT COUNT(*) FROM trial_attendance'`);
if(Number(count.trim())!==200)throw Error('Restored row count did not match expected 200');console.log('Snapshot restore verified: 200 attendance records in '+name);
