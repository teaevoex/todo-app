import { NextRequest, NextResponse } from 'next/server';
import { badRequest, requireSession } from '@/lib/api';
import { subtaskDB, todoDB } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  const todo = todoDB.getById(session.userId, Number(id));
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }
  const { title } = (await request.json()) as { title?: string };
  const trimmed = title?.trim();
  if (!trimmed) return badRequest('Subtask title is required');
  const subtask = subtaskDB.create(todo.id, trimmed);
  return NextResponse.json({ subtask }, { status: 201 });
}
