import { NextRequest, NextResponse } from 'next/server';
import { badRequest, requireSession } from '@/lib/api';
import { tagDB } from '@/lib/db';

const HEX = /^#[0-9A-Fa-f]{6}$/;

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response!;
  return NextResponse.json({ tags: tagDB.listByUser(session.userId) });
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { name, color } = (await request.json()) as { name?: string; color?: string };
  const trimmed = name?.trim();
  if (!trimmed) return badRequest('Tag name is required');
  if (!color || !HEX.test(color)) return badRequest('Tag color must be a hex value');
  if (tagDB.getByName(session.userId, trimmed)) return badRequest('Tag already exists');
  const tag = tagDB.create(session.userId, trimmed, color);
  return NextResponse.json({ tag }, { status: 201 });
}
