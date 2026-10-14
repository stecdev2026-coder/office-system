import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { checkOrigin, database, failure } from '@/lib/auth/server';
import { tokenHash } from '@/lib/auth/crypto';
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const token = (await cookies()).get('office_session')?.value;
    if (token) {
      const { error } = await database().from('office_sessions').delete().eq('token_hash', tokenHash(token));
      if (error) throw error;
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set('office_session', '', { path: '/', maxAge: 0 });
    return response;
  } catch (error) { return failure(error); }
}
