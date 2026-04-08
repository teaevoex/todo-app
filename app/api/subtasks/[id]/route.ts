import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, subtaskDB } from '@/lib/db'

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

  const subtask = subtaskDB.findById(Number(id))
  if (!subtask) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
  }

  const todo = todoDB.findById(subtask.todo_id, session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  if (body.title !== undefined && !body.title.trim()) {
    return NextResponse.json({ error: 'Subtask title cannot be empty' }, { status: 400 })
  }

  const updated = subtaskDB.update(Number(id), body)
  return NextResponse.json(updated)
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

  const subtask = subtaskDB.findById(Number(id))
  if (!subtask) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
  }

  const todo = todoDB.findById(subtask.todo_id, session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  subtaskDB.delete(Number(id))
  return NextResponse.json({ success: true })
}
