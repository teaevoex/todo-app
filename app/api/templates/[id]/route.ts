import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { templateDB } from '@/lib/db'

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
    return NextResponse.json({ error: 'Template title cannot be empty' }, { status: 400 })
  }

  if (body.priority && !['high', 'medium', 'low'].includes(body.priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  if (body.due_date_offset !== undefined && body.due_date_offset !== null) {
    if (!Number.isInteger(body.due_date_offset) || body.due_date_offset < 0) {
      return NextResponse.json(
        { error: 'Due date offset must be a non-negative integer' },
        { status: 400 }
      )
    }
  }

  if (body.subtasks) {
    if (!Array.isArray(body.subtasks)) {
      return NextResponse.json({ error: 'Subtasks must be an array' }, { status: 400 })
    }
    for (const s of body.subtasks) {
      if (!s.title || !s.title.trim()) {
        return NextResponse.json({ error: 'Subtask title is required' }, { status: 400 })
      }
    }
  }

  const template = templateDB.update(Number(id), session.userId, body)
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  return NextResponse.json(template)
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
  const deleted = templateDB.delete(Number(id), session.userId)

  if (!deleted) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
