import { NextRequest, NextResponse } from 'next/server';
import { badRequest, requireSession } from '@/lib/api';
import { todoDB } from '@/lib/db';
import { isAtLeastOneMinuteInFuture } from '@/lib/timezone';

function validatePriority(priority?: string) {
  return priority === 'high' || priority === 'medium' || priority === 'low';
}

function validateRecurrence(pattern?: string | null) {
  return !pattern || pattern === 'daily' || pattern === 'weekly' || pattern === 'monthly' || pattern === 'yearly';
}

export async function GET() {
  const { session, response } = await requireSession();
  if (!session) return response!;
  const todos = todoDB.listByUser(session.userId);
  return NextResponse.json({ todos });
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response!;

  const body = (await request.json()) as {
    title?: string;
    priority?: string;
    due_date?: string | null;
    is_recurring?: boolean;
    recurrence_pattern?: string | null;
    reminder_minutes?: number | null;
  };

  const title = body.title?.trim();
  if (!title) return badRequest('Title is required');
  if (body.priority && !validatePriority(body.priority)) return badRequest('Invalid priority');
  if (!validateRecurrence(body.recurrence_pattern)) return badRequest('Invalid recurrence pattern');
  if (body.due_date && !isAtLeastOneMinuteInFuture(body.due_date)) {
    return badRequest('Due date must be at least 1 minute in the future');
  }
  if (body.is_recurring && !body.due_date) {
    return badRequest('Recurring todos require a due date');
  }
  if (body.reminder_minutes && !body.due_date) {
    return badRequest('Reminders require a due date');
  }

  const todo = todoDB.create({
    user_id: session.userId,
    title,
    completed: 0,
    priority: (body.priority as 'high' | 'medium' | 'low') ?? 'medium',
    due_date: body.due_date ?? null,
    is_recurring: body.is_recurring ? 1 : 0,
    recurrence_pattern: (body.recurrence_pattern as 'daily' | 'weekly' | 'monthly' | 'yearly' | null) ?? null,
    reminder_minutes: body.reminder_minutes ?? null,
  });

  return NextResponse.json({ todo }, { status: 201 });
}
