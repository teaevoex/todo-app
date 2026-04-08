import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { templateDB } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const templates = templateDB.findAll(session.userId)
  return NextResponse.json(templates)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: 'Template title is required' }, { status: 400 })
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

  const template = templateDB.create(session.userId, {
    title: body.title,
    priority: body.priority,
    category: body.category,
    due_date_offset: body.due_date_offset ?? undefined,
    subtasks: body.subtasks,
  })

  return NextResponse.json(template, { status: 201 })
}
