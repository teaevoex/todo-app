import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, todoTagDB } from '@/lib/db'

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

  const tags = todoTagDB.findByTodoId(todo.id)
  return NextResponse.json(tags)
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
  const todo = todoDB.findById(Number(id), session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  const body = await request.json()

  if (!Array.isArray(body.tagIds)) {
    return NextResponse.json({ error: 'tagIds must be an array' }, { status: 400 })
  }

  todoTagDB.setTags(todo.id, body.tagIds)
  const tags = todoTagDB.findByTodoId(todo.id)

  return NextResponse.json(tags)
}
