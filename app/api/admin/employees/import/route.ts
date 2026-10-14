import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {AuthError,checkOrigin,database,failure} from '@/lib/auth/server';
import {requirePermission} from '@/lib/permissions/server';
import {allRows} from '@/lib/groups/database';
import {employeeColumns,HEADER_ROW,MAX_IMPORT_ROWS,validateImportRow} from '@/lib/import/employees';
import ExcelJS from 'exceljs';
export async function POST(request:NextRequest){try{
 checkOrigin(request);const auth=await requirePermission('users.import');const form=await request.formData(),file=form.get('file'),mode=form.get('mode');if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx')||file.size>3*1024*1024)throw new AuthError('เลือกไฟล์ .xlsx ไม่เกิน 3 MB');if(!['preview','commit'].includes(String(mode)))throw new AuthError('คำขอไม่ถูกต้อง');
 const book=new ExcelJS.Workbook();try{await book.xlsx.load(new Uint8Array(await file.arrayBuffer()) as any);}catch{throw new AuthError('อ่านไฟล์ Excel ไม่ได้ กรุณาใช้ Template');}const sheet=book.getWorksheet('พนักงาน');if(!sheet)throw new AuthError('ไม่พบชีต พนักงาน กรุณาใช้ Template');
 for(let c=0;c<employeeColumns.length;c++)if(String(sheet.getCell(HEADER_ROW,c+1).value||'')!==employeeColumns[c][1])throw new AuthError(`หัวคอลัมน์ ${c+1} ต้องเป็น ${employeeColumns[c][1]}`);
 if(sheet.rowCount>HEADER_ROW+MAX_IMPORT_ROWS)throw new AuthError('รองรับสูงสุด 1,000 แถวต่อไฟล์');
 const [groups,roles,employees]=await Promise.all([allRows('work_groups'),allRows('permission_roles'),allRows('employees','id,employee_code')]);const ref={groups,roles,employees,permissions:auth.permissions,isSuperAdmin:auth.isSuperAdmin};const errors:{row:number;message:string}[]=[],rows:any[]=[],seen=new Set<string>();let total=0;
 for(let row=HEADER_ROW+1;row<=sheet.rowCount;row++){const input:Record<string,unknown>={};let content=false,unsupported=false;for(let c=0;c<employeeColumns.length;c++){const cell=sheet.getCell(row,c+1);const value=cell.value;if(value!==null&&value!==undefined&&value!=='')content=true;if(value&&typeof value==='object'&&!(value instanceof Date)){unsupported=true;}input[employeeColumns[c][0]]=value??'';}if(!content)continue;total++;if(unsupported){errors.push({row,message:'เซลล์ต้องเป็นข้อความ ตัวเลข หรือวันที่ ไม่รับสูตร/ลิงก์'});continue;}const result=validateImportRow(input,ref);const key=result.record.employee_code.toLowerCase();if(seen.has(key))result.errors.push('รหัสพนักงานซ้ำในไฟล์');seen.add(key);if(result.errors.length)errors.push({row,message:result.errors.join(' · ')});else rows.push(result.record);}
 if(total===0)throw new AuthError('ไม่มีข้อมูลพนักงานในไฟล์');if(mode==='preview')return NextResponse.json({total,valid:rows.length,errors,rows:rows.slice(0,100)},{headers:{'Cache-Control':'no-store'}});if(errors.length)throw new AuthError('พบข้อมูลผิดพลาด กรุณาตรวจและแก้ไฟล์ก่อนนำเข้า');
 const r=await database().rpc('office_import_employees',{p_actor_id:auth.employee.id,p_rows:rows.map(row=>({...row,id:randomUUID()}))});if(r.error)throw new AuthError('นำเข้าไม่สำเร็จ ข้อมูลหรือสิทธิ์อาจเปลี่ยน กรุณาตรวจใหม่ ไม่มีการนำเข้าบางส่วน',409);
 return NextResponse.json({imported:r.data},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}
