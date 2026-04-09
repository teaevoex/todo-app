import { NextRequest, NextResponse } from 'next/server';
import { addRecurrence, isAtLeastOneMinuteInFuture } from '@/lib/timezone';
import { badRequest, requireSession } from '@/lib/api';
import { todoDB } from '@/lib/db';

function validPriority(value?: string) {
  return !value || value === 'high' || value === 'medium' || value === 'low';
}

function validRecurrence(value?: string | null) {
  return !value || value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly';
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  const todo = todoDB.getById(session.userId, Number(id));
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }
  return NextResponse.json({ todo });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  const todoId = Number(id);
  const existing = todoDB.getById(session.userId, todoId);
  if (!existing) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  const body = (await request.json()) as {
    title?: string;
    completed?: boolean;
    priority?: string;
    due_date?: string | null;
    is_recurring?: boolean;
    recurrence_pattern?: string | null;
    reminder_minutes?: number | null;
  };

  const title = body.title?.trim();
  if (body.title !== undefined && !title) return badRequest('Title is required');
  if (!validPriority(body.priority)) return badRequest('Invalid priority');
  if (!validRecurrence(body.recurrence_pattern)) return badRequest('Invalid recurrence pattern');
  if (body.due_date && !isAtLeastOneMinuteInFuture(body.due_date) && !body.completed) {
    return badRequest('Due date must be at least 1 minute in the future');
  }
  if ((body.is_recurring ?? existing.is_recurring === 1) && !(body.due_date ?? existing.due_date)) {
    return badRequest('Recurring todos require a due date');
  }

  const updated = todoDB.update(session.userId, todoId, {
    title: title ?? existing.title,
    completed: body.completed === undefined ? existing.completed : body.completed ? 1 : 0,
    priority: (body.priority as 'high' | 'medium' | 'low' | undefined) ?? existing.priority,
    due_date: body.due_date === undefined ? existing.due_date : body.due_date,
    is_recurring: body.is_recurring === undefined ? existing.is_recurring : body.is_recurring ? 1 : 0,
    recurrence_pattern:
      body.recurrence_pattern === undefined ? existing.recurrence_pattern : (body.recurrence_pattern as typeof existing.recurrence_pattern),
    reminder_minutes: body.reminder_minutes === undefined ? existing.reminder_minutes : body.reminder_minutes,
    last_notification_sent: body.due_date !== undefined || body.reminder_minutes !== undefined ? null : existing.last_notification_sent,
  });

  if (
    existing.completed === 0 &&
    body.completed === true &&
    existing.is_recurring === 1 &&
    existing.recurrence_pattern &&
    existing.due_date
  ) {
    const next = todoDB.create({
      user_id: session.userId,
      title: existing.title,
      completed: 0,
      priority: existing.priority,
      due_date: addRecurrence(existing.due_date, existing.recurrence_pattern),
      is_recurring: 1,
      recurrence_pattern: existing.recurrence_pattern,
      reminder_minutes: existing.reminder_minutes,
    });
    if (next && existing.tags) {
      todoDB.setTags(
        next.id,
        existing.tags.map((tag) => tag.id),
      );
    }
  }

  return NextResponse.json({ todo: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const { id } = await params;
  todoDB.delete(session.userId, Number(id));
  return NextResponse.json({ ok: true });
}
