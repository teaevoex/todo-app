import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    return { session: null, response: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }
  return { session, response: null };
}

export function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
