import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/api';
import { todoDB } from '@/lib/db';
import { getSingaporeNow } from '@/lib/timezone';

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const todos = todoDB.pendingNotifications(session.userId, getSingaporeNow().toISOString());
  todos.forEach((todo) => {
    todoDB.update(session.userId, todo.id, { last_notification_sent: getSingaporeNow().toISOString() });
  });
  return NextResponse.json({ todos });
}
