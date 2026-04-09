import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api';
import { exportUserData } from '@/lib/db';

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response!;
  return NextResponse.json(exportUserData(session.userId));
}
