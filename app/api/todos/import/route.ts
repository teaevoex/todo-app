import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, subtaskDB, tagDB, todoTagDB } from '@/lib/db'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()

  if (!body.version || !Array.isArray(body.todos)) {
    return NextResponse.json({ error: 'Invalid import format' }, { status: 400 })
  }

  if (body.version !== 1) {
    return NextResponse.json({ error: 'Unsupported export version' }, { status: 400 })
  }

  // Step 1: Resolve tags — reuse existing tags by name, create missing ones
  const existingTags = tagDB.findAll(session.userId)
  const tagNameToId: Record<string, number> = {}

  for (const tag of existingTags) {
    tagNameToId[tag.name.toLowerCase()] = tag.id
  }

  if (Array.isArray(body.tags)) {
    for (const exportTag of body.tags) {
      if (!exportTag.name || typeof exportTag.name !== 'string') continue
      const key = exportTag.name.trim().toLowerCase()
      if (!tagNameToId[key]) {
        const created = tagDB.create(session.userId, {
          name: exportTag.name.trim(),
          color: exportTag.color ?? '#3B82F6',
        })
        tagNameToId[key] = created.id
      }
    }
  }

  const tagsCreated = Object.keys(tagNameToId).length - existingTags.length

  // Step 2: Create todos with subtasks and tag associations
  let importedCount = 0

  for (const exportTodo of body.todos) {
    if (!exportTodo.title || typeof exportTodo.title !== 'string' || !exportTodo.title.trim()) {
      continue
    }

    const validPriorities = ['high', 'medium', 'low']
    const priority = validPriorities.includes(exportTodo.priority)
      ? exportTodo.priority
      : 'medium'

    const todo = todoDB.create(session.userId, {
      title: exportTodo.title.trim(),
      priority,
      due_date: exportTodo.due_date ?? undefined,
      is_recurring: exportTodo.is_recurring ?? false,
      recurrence_pattern: exportTodo.recurrence_pattern ?? undefined,
      reminder_minutes: exportTodo.reminder_minutes ?? undefined,
    })

    if (exportTodo.completed) {
      todoDB.update(todo.id, session.userId, { completed: true })
    }

    if (Array.isArray(exportTodo.subtasks)) {
      for (const exportSubtask of exportTodo.subtasks) {
        if (!exportSubtask.title || typeof exportSubtask.title !== 'string' || !exportSubtask.title.trim()) continue

        const subtask = subtaskDB.create(todo.id, {
          title: exportSubtask.title.trim(),
          position: exportSubtask.position ?? 0,
        })

        if (exportSubtask.completed) {
          subtaskDB.update(subtask.id, { completed: true })
        }
      }
    }

    if (Array.isArray(exportTodo.tags)) {
      const tagIds: number[] = []
      for (const tagName of exportTodo.tags) {
        if (typeof tagName !== 'string') continue
        const key = tagName.trim().toLowerCase()
        const tagId = tagNameToId[key]
        if (tagId) {
          tagIds.push(tagId)
        }
      }
      if (tagIds.length > 0) {
        todoTagDB.setTags(todo.id, tagIds)
      }
    }

    importedCount++
  }

  return NextResponse.json({
    success: true,
    imported: importedCount,
    tags_created: tagsCreated,
  }, { status: 201 })
}
