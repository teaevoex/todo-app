import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB } from '@/lib/db/todos'
import { subtaskDB } from '@/lib/db/subtasks'
import type { ApiResponse, Subtask, CreateSubtaskDto } from '@/lib/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Subtask>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id: idStr } = await params
  const todoId = parseInt(idStr, 10)

  if (isNaN(todoId)) {
    return NextResponse.json({ success: false, error: 'Invalid todo ID' }, { status: 400 })
  }

  // Verify the todo belongs to the authenticated user
  const todo = todoDB.findById(todoId, session.userId)
  if (!todo) {
    return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 })
  }

  let body: CreateSubtaskDto
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const title = body.title?.trim()
  if (!title) {
    return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
  }
  if (title.length > 200) {
    return NextResponse.json(
      { success: false, error: 'Title must be \u2264 200 characters' },
      { status: 400 }
    )
  }

  try {
    const subtask = subtaskDB.create(todoId, { title })
    return NextResponse.json({ success: true, data: subtask }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create subtask' },
      { status: 500 }
    )
  }
}
