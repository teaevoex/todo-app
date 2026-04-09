import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB } from '@/lib/db/todos'
import { tagDB } from '@/lib/db/tags'
import { getSingaporeNow } from '@/lib/timezone'
import { logger } from '@/lib/logger'
import type { ApiResponse, ExportPayload, ExportTodo, ExportSubtask, ExportTag, ExportTodoTag } from '@/lib/types'

export async function GET(): Promise<NextResponse> {
  const session = await getSession()

  if (!session) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const todos = todoDB.findAll(session.userId)
    const tags = tagDB.findAll(session.userId)

    const exportTodos: ExportTodo[] = todos.map((todo) => ({
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
      due_date: todo.due_date,
      priority: todo.priority,
      is_recurring: todo.is_recurring,
      recurrence_pattern: todo.recurrence_pattern,
      reminder_minutes: todo.reminder_minutes,
      created_at: todo.created_at,
    }))

    const exportSubtasks: ExportSubtask[] = todos.flatMap((todo) =>
      todo.subtasks.map((subtask) => ({
        id: subtask.id,
        todo_id: todo.id,
        title: subtask.title,
        completed: subtask.completed,
        position: subtask.position,
      }))
    )

    const exportTags: ExportTag[] = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
    }))

    const exportTodoTags: ExportTodoTag[] = todos.flatMap((todo) =>
      todo.tags.map((tag) => ({
        todo_id: todo.id,
        tag_id: tag.id,
      }))
    )

    const now = getSingaporeNow()
    // Get Singapore date for filename
    const sgDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)

    const payload: ExportPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      todos: exportTodos,
      subtasks: exportSubtasks,
      tags: exportTags,
      todoTags: exportTodoTags,
    }

    const response = NextResponse.json(payload, { status: 200 })
    response.headers.set('Content-Type', 'application/json')
    response.headers.set(
      'Content-Disposition',
      `attachment; filename="todos-export-${sgDateStr}.json"`
    )

    return response
  } catch (error) {
    logger.error('Export failed', 'export', error instanceof Error ? error.message : error)
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Export failed' },
      { status: 500 }
    )
  }
}
