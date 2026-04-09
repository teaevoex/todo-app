import { NextRequest, NextResponse } from 'next/server';
import { badRequest, requireSession } from '@/lib/api';
import { subtaskDB } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  const body = (await request.json()) as { title?: string; completed?: boolean };
  const title = body.title === undefined ? null : body.title.trim();
  if (body.title !== undefined && !title) return badRequest('Subtask title is required');
  const subtask = subtaskDB.update(Number(id), title, body.completed === undefined ? null : body.completed ? 1 : 0);
  if (!subtask) return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
  return NextResponse.json({ subtask });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  subtaskDB.delete(Number(id));
  return NextResponse.json({ ok: true });
}
