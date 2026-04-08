import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, todoTagDB } from '@/lib/db'
import { calculateNextDueDate } from '@/lib/timezone'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const todo = todoDB.findById(Number(id), session.userId)

  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  return NextResponse.json(todo)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  if (body.title !== undefined && !body.title.trim()) {
    return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
  }

  if (body.priority && !['high', 'medium', 'low'].includes(body.priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  // Validate recurring fields
  if (body.is_recurring !== undefined && body.is_recurring) {
    const dueDate = body.due_date !== undefined ? body.due_date : (todoDB.findById(Number(id), session.userId)?.due_date ?? null)
    if (!dueDate) {
      return NextResponse.json(
        { error: 'Recurring todos must have a due date' },
        { status: 400 }
      )
    }
    const pattern = body.recurrence_pattern !== undefined ? body.recurrence_pattern : (todoDB.findById(Number(id), session.userId)?.recurrence_pattern ?? null)
    if (!pattern || !['daily', 'weekly', 'monthly', 'yearly'].includes(pattern)) {
      return NextResponse.json(
        { error: 'Invalid recurrence pattern' },
        { status: 400 }
      )
    }
  }

  // Validate reminder fields
  const VALID_REMINDER_MINUTES = [15, 30, 60, 120, 1440, 2880, 10080]
  if (body.reminder_minutes != null && body.reminder_minutes !== '' && body.reminder_minutes !== null) {
    const effectiveDueDate = body.due_date !== undefined ? body.due_date : (todoDB.findById(Number(id), session.userId)?.due_date ?? null)
    if (!effectiveDueDate) {
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

  // Check if this is completing a recurring todo
  const existingTodo = todoDB.findById(Number(id), session.userId)
  if (!existingTodo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  let nextTodo = null
  if (
    body.completed === true &&
    existingTodo.completed === 0 &&
    existingTodo.is_recurring === 1 &&
    existingTodo.recurrence_pattern &&
    existingTodo.due_date
  ) {
    const nextDueDate = calculateNextDueDate(
      existingTodo.due_date,
      existingTodo.recurrence_pattern
    )
    nextTodo = todoDB.create(session.userId, {
      title: existingTodo.title,
      due_date: nextDueDate,
      priority: existingTodo.priority,
      is_recurring: true,
      recurrence_pattern: existingTodo.recurrence_pattern,
      reminder_minutes: existingTodo.reminder_minutes ?? null,
    })

    // Inherit tags from the completed todo
    const existingTags = todoTagDB.findByTodoId(Number(id))
    for (const tag of existingTags) {
      todoTagDB.addTag(nextTodo.id, tag.id)
    }
  }

  const todo = todoDB.update(Number(id), session.userId, body)
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  return NextResponse.json({ completed: todo, next: nextTodo })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const deleted = todoDB.delete(Number(id), session.userId)

  if (!deleted) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
