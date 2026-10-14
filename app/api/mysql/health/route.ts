import {requirePermission} from '@/lib/permissions/server';
import { NextResponse } from 'next/server';
import { failure } from '@/lib/auth/server';
import { mysqlPool } from '@/lib/database/mysql';
export const runtime = 'nodejs';
export async function GET() {
  try {
    await requirePermission('usage.view');
    await mysqlPool().execute('SELECT 1');
    return NextResponse.json({ ready: true, mode: 'isolated-trial', applicationDatabase: 'supabase' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'MYSQL_NOT_CONFIGURED') return NextResponse.json({ ready: false, error: 'ยังไม่ได้ตั้งค่า MySQL สำหรับทดลอง' }, { status: 503 });
    return failure(error);
  }
}
