import { NextRequest, NextResponse } from 'next/server';
import { badRequest, requireSession } from '@/lib/api';
import { templateDB } from '@/lib/db';

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response!;
  return NextResponse.json({ templates: templateDB.listByUser(session.userId) });
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    category?: string | null;
    title_template?: string;
    priority?: 'high' | 'medium' | 'low';
    is_recurring?: boolean;
    recurrence_pattern?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
    reminder_minutes?: number | null;
    due_date_offset_minutes?: number | null;
    subtasks_json?: string | null;
  };
  if (!body.name?.trim()) return badRequest('Template name is required');
  if (!body.title_template?.trim()) return badRequest('Template title is required');
  const template = templateDB.create({
    user_id: session.userId,
    name: body.name.trim(),
    description: body.description ?? null,
    category: body.category ?? null,
    title_template: body.title_template.trim(),
    priority: body.priority ?? 'medium',
    is_recurring: body.is_recurring ? 1 : 0,
    recurrence_pattern: body.recurrence_pattern ?? null,
    reminder_minutes: body.reminder_minutes ?? null,
    due_date_offset_minutes: body.due_date_offset_minutes ?? null,
    subtasks_json: body.subtasks_json ?? null,
  });
  return NextResponse.json({ template }, { status: 201 });
}
