import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/api';
import { templateDB } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  const updates = await request.json();
  const template = templateDB.update(session.userId, Number(id), updates);
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  return NextResponse.json({ template });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  templateDB.delete(session.userId, Number(id));
  return NextResponse.json({ ok: true });
}
