import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB } from '@/lib/db/todos'
import { tagDB } from '@/lib/db/tags'
import type { ApiResponse } from '@/lib/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ assigned: true }>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id: idStr } = await params
  const todoId = parseInt(idStr, 10)

  if (isNaN(todoId)) {
    return NextResponse.json({ success: false, error: 'Invalid todo ID' }, { status: 400 })
  }

  // Verify todo belongs to this user
  const todo = todoDB.findById(todoId, session.userId)
  if (!todo) {
    return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 })
  }

  let body: { tagIds?: number[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const tagIds = body.tagIds
  if (!Array.isArray(tagIds)) {
    return NextResponse.json({ success: false, error: 'tagIds must be an array' }, { status: 400 })
  }

  try {
    for (const tagId of tagIds) {
      tagDB.assignTag(todoId, tagId)
    }
    return NextResponse.json({ success: true, data: { assigned: true } })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to assign tags' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ removed: true }>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id: idStr } = await params
  const todoId = parseInt(idStr, 10)

  if (isNaN(todoId)) {
    return NextResponse.json({ success: false, error: 'Invalid todo ID' }, { status: 400 })
  }

  // Verify todo belongs to this user
  const todo = todoDB.findById(todoId, session.userId)
  if (!todo) {
    return NextResponse.json({ success: false, error: 'Todo not found' }, { status: 404 })
  }

  let body: { tagIds?: number[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const tagIds = body.tagIds
  if (!Array.isArray(tagIds)) {
    return NextResponse.json({ success: false, error: 'tagIds must be an array' }, { status: 400 })
  }

  try {
    for (const tagId of tagIds) {
      tagDB.removeTag(todoId, tagId)
    }
    return NextResponse.json({ success: true, data: { removed: true } })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to remove tags' },
      { status: 500 }
    )
  }
}
