import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/api';
import { subtaskDB, templateDB, todoDB } from '@/lib/db';
import { getSingaporeNow } from '@/lib/timezone';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  const template = templateDB.getById(session.userId, Number(id));
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const dueDate =
    template.due_date_offset_minutes == null
      ? null
      : new Date(getSingaporeNow().getTime() + template.due_date_offset_minutes * 60000).toISOString();

  const todo = todoDB.create({
    user_id: session.userId,
    title: template.title_template,
    completed: 0,
    priority: template.priority,
    due_date: dueDate,
    is_recurring: template.is_recurring,
    recurrence_pattern: template.recurrence_pattern,
    reminder_minutes: template.reminder_minutes,
  });

  if (todo && template.subtasks_json) {
    const subtasks = JSON.parse(template.subtasks_json) as Array<{ title: string }>;
    subtasks.forEach((subtask) => subtaskDB.create(todo.id, subtask.title));
  }

  return NextResponse.json({ todo }, { status: 201 });
}
