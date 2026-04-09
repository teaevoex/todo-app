import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB } from '@/lib/db/todos'
import { tagDB } from '@/lib/db/tags'
import { getSingaporeNow } from '@/lib/timezone'
import type { ApiResponse, TodoWithRelations, Todo, CreateTodoDto } from '@/lib/types'

export async function GET(): Promise<NextResponse<ApiResponse<TodoWithRelations[]>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const todos = todoDB.findAll(session.userId)
    return NextResponse.json({ success: true, data: todos })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch todos' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<Todo>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateTodoDto
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json(
      { success: false, error: 'Title is required' },
      { status: 400 }
    )
  }

  if (body.priority !== undefined && !['high', 'medium', 'low'].includes(body.priority)) {
    return NextResponse.json(
      { success: false, error: 'Priority must be high, medium, or low', field: 'priority' },
      { status: 400 }
    )
  }

  if (body.due_date) {
    const dueDate = new Date(body.due_date)
    const nowPlus60 = new Date(getSingaporeNow().getTime() + 60_000)
    if (isNaN(dueDate.getTime()) || dueDate < nowPlus60) {
      return NextResponse.json(
        { success: false, error: 'Due date must be at least 1 minute in the future' },
        { status: 400 }
      )
    }
  }

  if (body.is_recurring && !body.due_date) {
    return NextResponse.json(
      { success: false, error: 'A due date is required for recurring todos', field: 'due_date' },
      { status: 400 }
    )
  }
  if (body.is_recurring && !body.recurrence_pattern) {
    return NextResponse.json(
      { success: false, error: 'A recurrence pattern is required', field: 'recurrence_pattern' },
      { status: 400 }
    )
  }

  try {
    const dto: CreateTodoDto = {
      ...body,
      title,
    }
    const todo = todoDB.create(session.userId, dto)

    if (body.tagIds && body.tagIds.length > 0) {
      for (const tagId of body.tagIds) {
        try {
          tagDB.assignTag(todo.id, tagId)
        } catch {
          // Tag assignment failure is non-fatal
        }
      }
    }

    return NextResponse.json({ success: true, data: todo }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create todo' },
      { status: 500 }
    )
  }
}
