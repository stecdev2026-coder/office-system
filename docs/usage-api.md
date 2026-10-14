# การเชื่อม Usage API

เพิ่มค่าใน `.env.local` (เซิร์ฟเวอร์เท่านั้น) แล้วรีสตาร์ตแอป หาก deploy บน Vercel ให้เพิ่มใน Environment Variables แล้ว deploy ใหม่

```env
SUPABASE_ACCESS_TOKEN=
VERCEL_ACCESS_TOKEN=
VERCEL_TEAM_ID=
# Optional: ไม่ใส่จะใช้ ref จาก NEXT_PUBLIC_SUPABASE_URL
SUPABASE_PROJECT_REF=ikkgncneoenaktlwotmp
# Optional: ไม่ใส่จะรายงานทั้งทีม Vercel
VERCEL_PROJECT_ID=
```

- Supabase token: https://supabase.com/dashboard/account/tokens ต้องอ่านโปรเจกต์ได้ ถ้าเป็น fine-grained token ใช้ analytics_usage_read และ infra_disk_config_read
- Vercel token: https://vercel.com/account/tokens ต้องมีสิทธิ์ทีมและ Billing API
- Team ID / Project ID: ดู Settings ของทีมและโปรเจกต์ Vercel ไม่ใช่ชื่อทีม/ชื่อโปรเจกต์
- ไม่ใช้ NEXT_PUBLIC_ กับ access token และไม่เก็บคีย์ในตาราง company_settings

หน้า `/admin/usage` และ `/api/admin/usage` จำกัดสิทธิ์ผู้ดูแลที่เชื่อถือได้ เซิร์ฟเวอร์อ่าน provider API เท่านั้น เก็บผลแคช 5 นาที (error 30 วินาที) ไม่ส่ง token หรือ raw error ของผู้ให้บริการไปเบราว์เซอร์ ยังไม่ตั้งค่าจะแสดงรอตั้งค่าและไม่เรียก provider API

Supabase: ข้อมูลหลักอ่านจาก office_resource_usage ผ่าน API ฝั่งเซิร์ฟเวอร์ ใช้ SUPABASE_SECRET_KEY เดิม ไม่ต้องมี Access Token เพิ่ม วัด pg_database_size ขนาดไฟล์จาก metadata ของ storage.objects จำนวนไฟล์ จำนวนพนักงาน บัญชี username/password วันลงเวลา เช็คอิน และคำขอลา ฟังก์ชันเป็น security invoker และ grant execute เฉพาะ service_role หลัง API ตรวจ requireAdmin ขนาดไฟล์ไม่รวมไฟล์ที่ไม่มี metadata.size และแสดงจำนวนที่ขาด

หากมี SUPABASE_ACCESS_TOKEN จะอ่าน API requests ย้อนหลัง 1 วัน แยก Auth / REST / Storage / Realtime และการใช้ดิสก์เพิ่มเติม ยังไม่แสดงยอด billing/โควต้ารายเดือนให้ดูจาก Dashboard

Vercel: FOCUS billing charges จากวันที่ 1 ของเดือน UTC ถึงเวลาที่ดึงข้อมูล ไม่ใช่ billing cycle ของทีมโดยอัตโนมัติ รวม BilledCost แยกสกุลเงิน และ ConsumedQuantity แยกบริการ/หน่วย ไม่รวมหน่วยหรือสกุลเงินที่แตกต่างกัน หากระบุ Project ID จะกรอง Tags.ProjectId บางค่าระดับทีมอาจไม่มี project tag ยอดอาจล่าช้าและไม่ใช่ใบแจ้งหนี้สุดท้าย

API docs:
- https://supabase.com/docs/reference/api/v1-get-project-usage-api-count
- https://supabase.com/docs/reference/api/v1-get-disk-utilization
- https://vercel.com/docs/rest-api/billing/list-focus-billing-charges

ทดสอบ `node scripts/test-usage.mjs`: payload จำลองตามเอกสาร รวมยอด/หน่วย/สกุลเงิน กรองโปรเจกต์ ไม่มีคีย์ สิทธิ์ไม่พอ แคช และไม่ส่งคีย์ในผลลัพธ์
ยังไม่ได้ทดสอบเชื่อมบัญชีจริง เพราะผู้ใช้จะใส่คีย์ภายหลัง

อ้างอิงวิธีวัดจาก E:/Codex_Jobs/home-love/src/app/UsagePage.tsx และ migration 20261011000000_notification_center_usage.sql โดยดึงข้อมูลของ office-system เท่านั้น ไม่ใช้คีย์หรือข้อมูลของ home-love
Migration ใหม่: supabase/migrations/202610120003_resource_usage.sql รันบนโปรเจกต์ ikkgncneoenaktlwotmp แล้ว และทดสอบค่าจริงเทียบจำนวนแถวพร้อมตรวจ anonymous RPC ถูกปฏิเสธ

## Local development

ใช้ `npm run dev -- --port 3000` ระหว่างปรับโค้ด เพื่อให้ Fast Refresh อัปเดตหน้าเว็บเมื่อบันทึกไฟล์
`npm run start` ใช้ไฟล์ที่ build แล้ว จึงไม่อัปเดตจากการแก้ source โดยอัตโนมัติ
โหมดพัฒนาจะยกเลิกเฉพาะ service worker `/sw.js` ของแอปนี้ และล้างเฉพาะแคชชื่อ `office-shell-*` เพื่อไม่ให้แคช production ขวางการอัปเดต โดยไม่ลบ cookie หรือบัญชีที่ลงชื่ออยู่
