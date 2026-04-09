import { NextRequest, NextResponse } from 'next/server';
import { badRequest, requireSession } from '@/lib/api';
import { tagDB } from '@/lib/db';

const HEX = /^#[0-9A-Fa-f]{6}$/;

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  const existing = tagDB.getById(session.userId, Number(id));
  if (!existing) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
  const { name, color } = (await request.json()) as { name?: string; color?: string };
  const trimmed = name?.trim();
  if (!trimmed) return badRequest('Tag name is required');
  if (!color || !HEX.test(color)) return badRequest('Tag color must be a hex value');
  const duplicate = tagDB.getByName(session.userId, trimmed);
  if (duplicate && duplicate.id !== existing.id) return badRequest('Tag already exists');
  return NextResponse.json({ tag: tagDB.update(session.userId, existing.id, trimmed, color) });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  tagDB.delete(session.userId, Number(id));
  return NextResponse.json({ ok: true });
}
