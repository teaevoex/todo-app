import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, subtaskDB, todoTagDB } from '@/lib/db'
import { getSingaporeNow } from '@/lib/timezone'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const todos = todoDB.findAll(session.userId)

  const enriched = todos.map(todo => {
    const subtasks = subtaskDB.findByTodoId(todo.id)
    const tags = todoTagDB.findByTodoId(todo.id)
    return {
      ...todo,
      subtasks,
      subtask_count: subtasks.length,
      subtask_completed: subtasks.filter(s => s.completed).length,
      tags,
    }
  })

  return NextResponse.json(enriched)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  if (body.priority && !['high', 'medium', 'low'].includes(body.priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  if (body.due_date) {
    const dueDate = new Date(body.due_date)
    if (isNaN(dueDate.getTime())) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 })
    }
    const now = getSingaporeNow()
    if (dueDate <= now) {
      return NextResponse.json(
        { error: 'Due date must be in the future' },
        { status: 400 }
      )
    }
  }

  // Validate recurring fields
  if (body.is_recurring) {
    if (!body.due_date) {
      return NextResponse.json(
        { error: 'Recurring todos must have a due date' },
        { status: 400 }
      )
    }
    if (!body.recurrence_pattern || !['daily', 'weekly', 'monthly', 'yearly'].includes(body.recurrence_pattern)) {
      return NextResponse.json(
        { error: 'Invalid recurrence pattern' },
        { status: 400 }
      )
    }
  }

  // Validate reminder fields
  const VALID_REMINDER_MINUTES = [15, 30, 60, 120, 1440, 2880, 10080]
  if (body.reminder_minutes != null && body.reminder_minutes !== '') {
    if (!body.due_date) {
      return NextResponse.json(
        { error: 'Reminder requires a due date' },
        { status: 400 }
      )
    }
    if (!VALID_REMINDER_MINUTES.includes(Number(body.reminder_minutes))) {
      return NextResponse.json(
        { error: 'Invalid reminder timing' },
        { status: 400 }
      )
    }
  }

  const todo = todoDB.create(session.userId, {
    title: body.title,
    due_date: body.due_date ?? null,
    priority: body.priority ?? 'medium',
    is_recurring: body.is_recurring ?? false,
    recurrence_pattern: body.recurrence_pattern ?? null,
    reminder_minutes: body.reminder_minutes ? Number(body.reminder_minutes) : null,
  })

  return NextResponse.json(todo, { status: 201 })
}
