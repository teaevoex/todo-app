import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, subtaskDB, tagDB, todoTagDB } from '@/lib/db'
import { getSingaporeNow } from '@/lib/timezone'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const todos = todoDB.findAll(session.userId)
  const tags = tagDB.findAll(session.userId)

  const exportTodos = todos.map(todo => {
    const subtasks = subtaskDB.findByTodoId(todo.id)
    const todoTags = todoTagDB.findByTodoId(todo.id)

    return {
      title: todo.title,
      completed: !!todo.completed,
      priority: todo.priority,
      due_date: todo.due_date ?? null,
      is_recurring: !!todo.is_recurring,
      recurrence_pattern: todo.recurrence_pattern ?? null,
      reminder_minutes: todo.reminder_minutes ?? null,
      subtasks: subtasks.map(s => ({
        title: s.title,
        completed: !!s.completed,
        position: s.position,
      })),
      tags: todoTags.map(t => t.name),
    }
  })

  const exportTags = tags.map(t => ({
    name: t.name,
    color: t.color,
  }))

  const exportData = {
    version: 1,
    exported_at: getSingaporeNow().toISOString(),
    todos: exportTodos,
    tags: exportTags,
  }

  return NextResponse.json(exportData)
}
