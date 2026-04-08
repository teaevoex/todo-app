import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { templateDB, todoDB, subtaskDB } from '@/lib/db'
import type { TemplateSubtask } from '@/lib/db'
import { getSingaporeNow, toSingaporeISOString } from '@/lib/timezone'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const template = templateDB.findById(Number(id), session.userId)

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  // Calculate due date from offset
  let dueDate: string | null = null
  if (template.due_date_offset !== null) {
    const now = getSingaporeNow()
    now.setDate(now.getDate() + template.due_date_offset)
    dueDate = toSingaporeISOString(now)
  }

  // Create the todo
  const todo = todoDB.create(session.userId, {
    title: template.title,
    priority: template.priority,
    due_date: dueDate,
  })

  // Create subtasks from template
  const subtasks: TemplateSubtask[] = JSON.parse(template.subtasks)
  for (const subtask of subtasks) {
    subtaskDB.create(todo.id, {
      title: subtask.title,
      position: subtask.position,
    })
  }

  // Return todo with subtasks
  const createdSubtasks = subtaskDB.findByTodoId(todo.id)
  return NextResponse.json(
    { ...todo, subtasks: createdSubtasks },
    { status: 201 }
  )
}
