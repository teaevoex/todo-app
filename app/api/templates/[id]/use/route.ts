import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { templateDB } from '@/lib/db/templates'
import { todoDB } from '@/lib/db/todos'
import { subtaskDB } from '@/lib/db/subtasks'
import { tagDB } from '@/lib/db/tags'
import { getSingaporeNow, toSingaporeISO } from '@/lib/timezone'
import type { ApiResponse, Todo } from '@/lib/types'

interface UseTemplateBody {
  title_override?: string
  due_date_override?: string
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Todo>>> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)

  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: 'Invalid template ID' }, { status: 400 })
  }

  let body: UseTemplateBody = {}
  try {
    body = await req.json()
  } catch {
    // Body is optional — default to empty
  }

  if (body.title_override && body.title_override.length > 200) {
    return NextResponse.json(
      { success: false, error: 'Title must be \u2264 200 characters' },
      { status: 400 }
    )
  }

  if (body.due_date_override) {
    const parsed = new Date(body.due_date_override)
    if (isNaN(parsed.getTime())) {
      return NextResponse.json(
        { success: false, error: 'due_date_override must be a valid ISO 8601 date' },
        { status: 400 }
      )
    }
  }

  const template = templateDB.findById(id, session.userId)
  if (!template) {
    return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
  }

  // Calculate due date
  let dueDate: string | null = null
  if (body.due_date_override) {
    dueDate = body.due_date_override
  } else if (template.due_date_offset_days !== null) {
    const now = getSingaporeNow()
    const offsetMs = template.due_date_offset_days * 24 * 60 * 60 * 1000
    const dueDateObj = new Date(now.getTime() + offsetMs)
    dueDate = toSingaporeISO(dueDateObj)
  }

  try {
    // Create the todo
    const todo = todoDB.create(session.userId, {
      title: body.title_override ?? template.title_template,
      priority: template.priority,
      is_recurring: template.is_recurring,
      recurrence_pattern: template.recurrence_pattern,
      reminder_minutes: template.reminder_minutes,
      due_date: dueDate,
    })

    // Create subtasks from template
    const subtasks = templateDB.parseSubtasks(template)
    for (const subtask of subtasks) {
      subtaskDB.create(todo.id, { title: subtask.title })
    }

    // Assign tags from template (silently skip stale IDs)
    const tagIds = templateDB.parseTagIds(template)
    for (const tagId of tagIds) {
      try {
        tagDB.assignTag(todo.id, tagId)
      } catch {
        // Silently skip stale tag IDs
      }
    }

    return NextResponse.json({ success: true, data: todo }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create todo from template' },
      { status: 500 }
    )
  }
}
