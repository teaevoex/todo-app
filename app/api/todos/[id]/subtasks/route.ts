import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, subtaskDB } from '@/lib/db'

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

  const subtasks = subtaskDB.findByTodoId(Number(id))
  return NextResponse.json(subtasks)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const todo = todoDB.findById(Number(id), session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: 'Subtask title is required' }, { status: 400 })
  }

  const subtask = subtaskDB.create(Number(id), { title: body.title })
  return NextResponse.json(subtask, { status: 201 })
}
