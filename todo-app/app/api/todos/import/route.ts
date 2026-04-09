import { NextRequest, NextResponse } from 'next/server';
import { badRequest, requireSession } from '@/lib/api';
import { importUserData } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest('Invalid JSON');
  }
  if (!Array.isArray(body.todos) || !Array.isArray(body.subtasks) || !Array.isArray(body.tags) || !Array.isArray(body.todo_tags)) {
    return badRequest('Invalid import payload');
  }
  const result = importUserData(session.userId, body as never);
  return NextResponse.json({ ok: true, result });
}
