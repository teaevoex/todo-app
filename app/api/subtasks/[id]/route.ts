import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { subtaskDB } from '@/lib/db/subtasks'
import type { ApiResponse, Subtask, UpdateSubtaskDto } from '@/lib/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Subtask>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)

  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Invalid subtask ID' }, { status: 400 })
  }

  let body: UpdateSubtaskDto
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (body.title !== undefined) {
    const trimmed = body.title.trim()
    if (!trimmed) {
      return NextResponse.json({ success: false, error: 'Title cannot be empty' }, { status: 400 })
    }
    if (trimmed.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Title must be \u2264 200 characters' },
        { status: 400 }
      )
    }
    body = { ...body, title: trimmed }
  }

  try {
    const subtask = subtaskDB.update(id, body)
    return NextResponse.json({ success: true, data: subtask })
  } catch (error) {
    if (error instanceof Error && error.message === 'Subtask not found') {
      return NextResponse.json({ success: false, error: 'Subtask not found' }, { status: 404 })
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update subtask' },
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
    return NextResponse.json({ success: false, error: 'Invalid subtask ID' }, { status: 400 })
  }

  try {
    subtaskDB.delete(id)
    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete subtask' },
      { status: 500 }
    )
  }
}
