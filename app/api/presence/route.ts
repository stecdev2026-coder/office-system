import {NextRequest,NextResponse} from 'next/server';
import {checkOrigin,currentSession,database,failure} from '@/lib/auth/server';
export async function POST(request:NextRequest){try{checkOrigin(request);const {employee}=await currentSession();const {error}=await database().from('office_presence').upsert({employee_id:employee.id,last_seen_at:new Date().toISOString()});if(error)throw error;return NextResponse.json({ok:true});}catch(e){return failure(e);}}
