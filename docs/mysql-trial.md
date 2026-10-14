# MySQL ทดลองแยกจากระบบหลัก

เปิด MySQL 8.4 บน Docker ที่ localhost:3307 และ API/หน้าทดลองที่ **http://localhost:4001** แอปหลักที่ localhost:3000 ยังใช้ Supabase เดิม ไม่มีการคัดลอกข้อมูลจริงหรือสลับฐานข้อมูล

## ลองใช้งาน

- บัญชีสาธิต: `demo001` ถึง `demo200`
- รหัสผ่านสาธิต: `TrialOnly-2026!`
- ลงชื่อเข้าใช้ บันทึกเวลา แล้วกดดูข้อมูลของฉัน บัญชีหนึ่งผูกกับ browser profile แรกที่ลงชื่อ
- บัญชีและข้อมูลนี้ใช้ทดลองเท่านั้น API เปิดเฉพาะ localhost ไม่ใช่ระบบ production และยังไม่ได้แทนทุกหน้าในแอปหลัก

## เปิด/หยุด

รหัสผ่านฐานข้อมูลสองค่าที่สุ่มไว้เก็บใน `.env.mysql.local` ซึ่ง Git ไม่เก็บ ไม่ต้องส่งรหัสผ่านผ่านแชต

```powershell
npm run mysql:trial:up
npm run mysql:trial:start
```

หน้าต่างรัน API ต้องคงไว้ขณะทดสอบ หยุด API ด้วย Ctrl+C แล้วหยุด MySQL โดยเก็บข้อมูลไว้:

```powershell
npm run mysql:trial:stop
```

ข้อมูลอยู่ใน volume `office-system-mysql-trial_mysql_trial_data` อย่าใช้ `down -v` เมื่อต้องการเก็บข้อมูลไว้ ไม่ต้องแก้ `.env.local` ของแอปหลักสำหรับ API ทดลองนี้

## API ทดลอง

- `GET /health`: ตรวจฐานทดลอง
- `POST /login`: username, password, deviceToken; บันทึก device hash และออก HttpOnly session cookie
- `GET /attendance`: อ่านเฉพาะรายการของผู้ที่ลงชื่อ
- `POST /attendance`: บันทึกเวลา วันปัจจุบันตามประเทศไทย หรือ workDate สำหรับข้อมูลสาธิต
- `POST /logout`: ยกเลิก session

ใช้ InnoDB, connection pool สูงสุด 10, prepared statements, transaction ที่ล็อกแถวบัญชีเมื่อผูกเครื่อง และลองใหม่แบบจำกัดเมื่อ deadlock/lock timeout ตารางลงเวลามี unique(user_id,work_date) ป้องกันรายการซ้ำ หน้า/API นี้แยกจาก `/api/mysql/health` ในแอปหลักซึ่งยังต้องใช้ session แอดมิน Supabase

## ผลทดสอบ

รัน `npm run mysql:trial:test` เพื่อจำลอง 200 บัญชีลงชื่อและบันทึกพร้อมกัน ดูผลใน `docs/mysql-trial-result.json`:

- ลงชื่อสำเร็จ 200 บัญชี
- บันทึกครบ 200 รายการ
- ปฏิเสธการบันทึกซ้ำ 200 คำขอ
- ปฏิเสธผู้ไม่ลงชื่อ รหัสผิด การข้าม origin และเครื่องที่สอง

บัญชี load001–load200 แยกจาก demo001–demo200 ใช้วันที่สาธิต 2000-01-01 การทดสอบซ้ำลบเฉพาะรายการของบัญชี load ในวันสาธิตนั้น แล้วบันทึกใหม่ ไม่แก้ข้อมูล demo หรือ Supabase ผลเป็น local synthetic burst ไม่ใช่การรับประกันรองรับ 200 คนของระบบจริงทั้งระบบ

## สำรองและกลับไปใช้ระบบเดิม

```powershell
npm run mysql:trial:backup
```

สร้าง SQL snapshot ด้วย mysqldump --single-transaction ใน `backups/mysql-trial/` (Git ไม่เก็บ) สำรองเฉพาะฐานทดลอง ไม่ใช่สำเนาของ Supabase ตรวจการกู้คืนในฐานแยกก่อนใช้ snapshot เพื่อกู้ข้อมูล

ช่วงทดลองนี้กลับไปใช้ระบบเดิมโดยเปิด localhost:3000 ได้ทันที เพราะแอปหลักไม่เคยสลับฐาน จึงไม่มีข้อมูลจริงต้องย้ายกลับ

ก่อนนำ MySQL มาใช้จริง ต้องทำ API และ adapters ของระบบทั้งหมด รวมทั้งบัญชี การผูกเครื่อง การเก็บรูปและ email OTP ให้ครบ ทดสอบทุกหน้า จากนั้นสำรอง Supabase หยุดการเขียน ย้ายข้อมูล ตรวจความสัมพันธ์ แล้วค่อย cutover

หากบันทึกงานจริงบน MySQL แล้ว ข้อมูลใหม่จะไม่เข้า Supabase เอง ต้องย้ายข้อมูลที่เกิดหลัง cutover กลับก่อนสลับฐาน หรือออกแบบ outbox/งานซิงก์และตรวจความล่าช้า ไม่มี automatic failover ระหว่างสองฐานในขั้นนี้
