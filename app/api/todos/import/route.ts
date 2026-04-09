import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db/connection'
import { tagDB } from '@/lib/db/tags'
import { validatePayload } from '@/lib/validation/import'
import { logger } from '@/lib/logger'
import type { ApiResponse, ExportPayload, ExportTag } from '@/lib/types'

interface ImportCounts {
  todos: number
  subtasks: number
  tags: number
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  try {
    validatePayload(body)
  } catch (error) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: error instanceof Error ? error.message : 'Invalid payload' },
      { status: 400 }
    )
  }

  const payload = body as ExportPayload
  const todos = payload.todos
  const subtasks = payload.subtasks ?? []
  const tags = payload.tags ?? []
  const todoTags = payload.todoTags ?? []

  // Validate todos have required fields
  for (let i = 0; i < todos.length; i++) {
    const todo = todos[i]
    if (!todo.title || typeof todo.title !== 'string' || todo.title.trim() === '') {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Todo at index ${i}: title must be non-empty` },
        { status: 400 }
      )
    }
    if (typeof todo.id !== 'number') {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Todo at index ${i}: id must be a number` },
        { status: 400 }
      )
    }
  }

  try {
    const counts = runImportTransaction(session.userId, todos, subtasks, tags, todoTags)

    return NextResponse.json<ApiResponse<{ imported: ImportCounts }>>(
      {
        success: true,
        data: {
          imported: {
            todos: counts.todos,
            subtasks: counts.subtasks,
            tags: counts.tags,
          },
        },
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('Import failed', 'import', error instanceof Error ? error.message : error)
    const message = error instanceof Error ? error.message : 'Import failed'
    if (message.startsWith('Subtask references') || message.startsWith('TodoTag references')) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: message },
        { status: 400 }
      )
    }
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Import failed: database transaction rolled back' },
      { status: 500 }
    )
  }
}

function runImportTransaction(
  userId: number,
  todos: ExportPayload['todos'],
  subtasks: ExportPayload['subtasks'],
  tags: ExportTag[],
  todoTags: ExportPayload['todoTags']
): ImportCounts {
  const importFn = db.transaction(() => {
    // Step 1: Process tags — match by name, reuse existing, create new
    const existingTags = tagDB.findAll(userId)
    const existingTagsByName = new Map<string, number>(
      existingTags.map((t) => [t.name.toLowerCase(), t.id])
    )
    const oldTagIdToNewId = new Map<number, number>()
    let newTagCount = 0

    for (const exportTag of tags) {
      const normalizedName = exportTag.name.toLowerCase()
      const existingId = existingTagsByName.get(normalizedName)

      if (existingId !== undefined) {
        // Reuse existing tag
        oldTagIdToNewId.set(exportTag.id, existingId)
      } else {
        // Create new tag
        const newTag = db.prepare(
          'INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)'
        ).run(userId, exportTag.name, exportTag.color)

        const newId = Number(newTag.lastInsertRowid)
        oldTagIdToNewId.set(exportTag.id, newId)
        existingTagsByName.set(normalizedName, newId)
        newTagCount++
      }
    }

    // Step 2: Create todos — capture old ID → new ID mapping
    const oldTodoIdToNewId = new Map<number, number>()

    for (const exportTodo of todos) {
      const now = new Date().toISOString()
      const result = db.prepare(`
        INSERT INTO todos (
          user_id, title, completed, due_date, priority,
          is_recurring, recurrence_pattern, reminder_minutes,
          created_at, updated_at
        ) VALUES (
          @userId, @title, @completed, @due_date, @priority,
          @is_recurring, @recurrence_pattern, @reminder_minutes,
          @created_at, @updated_at
        )
      `).run({
        userId,
        title: exportTodo.title,
        completed: exportTodo.completed ? 1 : 0,
        due_date: exportTodo.due_date ?? null,
        priority: exportTodo.priority ?? 'medium',
        is_recurring: exportTodo.is_recurring ? 1 : 0,
        recurrence_pattern: exportTodo.recurrence_pattern ?? null,
        reminder_minutes: exportTodo.reminder_minutes ?? null,
        created_at: exportTodo.created_at ?? now,
        updated_at: now,
      })

      oldTodoIdToNewId.set(exportTodo.id, Number(result.lastInsertRowid))
    }

    // Step 3: Create subtasks with remapped todo_id
    let subtaskCount = 0
    for (const exportSubtask of subtasks) {
      const newTodoId = oldTodoIdToNewId.get(exportSubtask.todo_id)
      if (newTodoId === undefined) {
        throw new Error(`Subtask references unknown todo_id ${exportSubtask.todo_id}`)
      }

      db.prepare(
        'INSERT INTO subtasks (todo_id, title, completed, position) VALUES (?, ?, ?, ?)'
      ).run(
        newTodoId,
        exportSubtask.title,
        exportSubtask.completed ? 1 : 0,
        exportSubtask.position
      )
      subtaskCount++
    }

    // Step 4: Create todo_tag associations with remapped IDs
    for (const exportTodoTag of todoTags) {
      const newTodoId = oldTodoIdToNewId.get(exportTodoTag.todo_id)
      const newTagId = oldTagIdToNewId.get(exportTodoTag.tag_id)

      if (newTodoId === undefined) {
        throw new Error(`TodoTag references unknown todo_id ${exportTodoTag.todo_id}`)
      }
      if (newTagId === undefined) {
        throw new Error(`TodoTag references unknown tag_id ${exportTodoTag.tag_id}`)
      }

      db.prepare(
        'INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)'
      ).run(newTodoId, newTagId)
    }

    return {
      todos: oldTodoIdToNewId.size,
      subtasks: subtaskCount,
      tags: newTagCount,
    }
  })

  return importFn() as ImportCounts
}
