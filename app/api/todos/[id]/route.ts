import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB } from '@/lib/db/todos'
import { tagDB } from '@/lib/db/tags'
import type { ApiResponse, TodoWithRelations, Todo, UpdateTodoDto } from '@/lib/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<TodoWithRelations>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)

  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Invalid todo ID' }, { status: 400 })
  }

  try {
    const todo = todoDB.findById(id, session.userId)

    if (!todo) {
      return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: todo })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch todo' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Todo>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)

  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Invalid todo ID' }, { status: 400 })
  }

  let body: UpdateTodoDto
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (body.title !== undefined) {
    const trimmed = body.title.trim()
    if (!trimmed) {
      return NextResponse.json(
        { success: false, error: 'Title cannot be empty' },
        { status: 400 }
      )
    }
    body = { ...body, title: trimmed }
  }

  if (body.priority !== undefined && !['high', 'medium', 'low'].includes(body.priority)) {
    return NextResponse.json(
      { success: false, error: 'Priority must be high, medium, or low', field: 'priority' },
      { status: 400 }
    )
  }

  const VALID_REMINDER_MINUTES = [15, 30, 60, 120, 1440, 2880, 10080]

  if (body.reminder_minutes !== undefined && body.reminder_minutes !== null) {
    if (!VALID_REMINDER_MINUTES.includes(body.reminder_minutes)) {
      return NextResponse.json(
        { success: false, error: 'Invalid reminder time', field: 'reminder_minutes' },
        { status: 400 }
      )
    }
  }

  // Fetch existing todo once for all checks that need it
  const existing = todoDB.findById(id, session.userId)

  if (body.reminder_minutes !== undefined && body.reminder_minutes !== null) {
    const effectiveDueDate = body.due_date !== undefined ? body.due_date : existing?.due_date
    if (!effectiveDueDate) {
      return NextResponse.json(
        { success: false, error: 'A due date is required to set a reminder', field: 'due_date' },
        { status: 400 }
      )
    }
  }

  // If due_date is being cleared, also clear reminder_minutes
  if (body.due_date === null && existing?.reminder_minutes) {
    body = { ...body, reminder_minutes: null }
  }

  if (body.is_recurring && !body.due_date) {
    if (!existing || !existing.due_date) {
      return NextResponse.json(
        { success: false, error: 'A due date is required for recurring todos', field: 'due_date' },
        { status: 400 }
      )
    }
  }
  if (body.is_recurring && !body.recurrence_pattern) {
    if (!existing || !existing.recurrence_pattern) {
      return NextResponse.json(
        { success: false, error: 'A recurrence pattern is required', field: 'recurrence_pattern' },
        { status: 400 }
      )
    }
  }

  try {
    const todo = todoDB.update(id, session.userId, body)

    // Handle tag assignment if tagIds provided
    if (body.tagIds !== undefined) {
      // Get current tags and compute the diff
      const currentTags = tagDB.getTagsForTodo(id)
      const currentIds = new Set(currentTags.map((t) => t.id))
      const newIds = new Set(body.tagIds)

      // Remove tags no longer assigned
      for (const tagId of currentIds) {
        if (!newIds.has(tagId)) {
          tagDB.removeTag(id, tagId)
        }
      }

      // Add newly assigned tags
      for (const tagId of newIds) {
        if (!currentIds.has(tagId)) {
          try {
            tagDB.assignTag(id, tagId)
          } catch {
            // Non-fatal: tag may not belong to user
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: todo })
  } catch (error) {
    if (error instanceof Error && error.message === 'Todo not found') {
      return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 })
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update todo' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ deleted: true }>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)

  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Invalid todo ID' }, { status: 400 })
  }

  try {
    todoDB.delete(id, session.userId)
    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    if (error instanceof Error && error.message === 'Todo not found') {
      return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 })
    }
    return NextResponse.json(
      { success: false, error: 'Failed to delete todo' },
      { status: 500 }
    )
  }
}
