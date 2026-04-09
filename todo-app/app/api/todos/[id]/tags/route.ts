import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/api';
import { tagDB, todoDB } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  const todo = todoDB.getById(session.userId, Number(id));
  if (!todo) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  const { tagIds } = (await request.json()) as { tagIds?: number[] };
  const validIds = (tagIds ?? []).filter((tagId) => tagDB.getById(session.userId, tagId));
  todoDB.setTags(todo.id, validIds);
  return NextResponse.json({ todo: todoDB.getById(session.userId, todo.id) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  const todo = todoDB.getById(session.userId, Number(id));
  if (!todo) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  const { tagId } = (await request.json()) as { tagId?: number };
  if (tagId) {
    todoDB.removeTag(todo.id, tagId);
  }
  return NextResponse.json({ todo: todoDB.getById(session.userId, todo.id) });
}
