import { db } from './connection'
import { getSingaporeNow } from '@/lib/timezone'
import { calculateNextDueDate } from '@/lib/recurrence'
import type {
  Todo,
  TodoWithRelations,
  CreateTodoDto,
  UpdateTodoDto,
  TodoReminder,
  Subtask,
  Tag,
} from '@/lib/types'

interface TodoRow {
  id: number
  user_id: number
  title: string
  completed: number
  due_date: string | null
  priority: string
  is_recurring: number
  recurrence_pattern: string | null
  reminder_minutes: number | null
  last_notification_sent: string | null
  created_at: string
  updated_at: string
}

interface SubtaskRow {
  id: number
  todo_id: number
  title: string
  completed: number
  position: number
  created_at: string
}

interface TagRow {
  id: number
  user_id: number
  name: string
  color: string
  created_at: string
}

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    completed: row.completed === 1,
    due_date: row.due_date,
    priority: row.priority as Todo['priority'],
    is_recurring: row.is_recurring === 1,
    recurrence_pattern: row.recurrence_pattern as Todo['recurrence_pattern'],
    reminder_minutes: row.reminder_minutes as Todo['reminder_minutes'],
    last_notification_sent: row.last_notification_sent,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function rowToSubtask(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    todo_id: row.todo_id,
    title: row.title,
    completed: row.completed === 1,
    position: row.position,
    created_at: row.created_at,
  }
}

export const todoDB = {
  create(userId: number, dto: CreateTodoDto): Todo {
    const now = getSingaporeNow().toISOString()
    const stmt = db.prepare(`
      INSERT INTO todos (
        user_id, title, completed, due_date, priority,
        is_recurring, recurrence_pattern, reminder_minutes,
        created_at, updated_at
      ) VALUES (
        @userId, @title, 0, @due_date, @priority,
        @is_recurring, @recurrence_pattern, @reminder_minutes,
        @created_at, @updated_at
      )
    `)

    const info = stmt.run({
      userId,
      title: dto.title,
      due_date: dto.due_date ?? null,
      priority: dto.priority ?? 'medium',
      is_recurring: dto.is_recurring ? 1 : 0,
      recurrence_pattern: dto.recurrence_pattern ?? null,
      reminder_minutes: dto.reminder_minutes ?? null,
      created_at: now,
      updated_at: now,
    })

    const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(info.lastInsertRowid) as TodoRow
    return rowToTodo(row)
  },

  findAll(userId: number): TodoWithRelations[] {
    const todoRows = db
      .prepare('SELECT * FROM todos WHERE user_id = ?')
      .all(userId) as TodoRow[]

    if (todoRows.length === 0) {
      return []
    }

    const todoIds = todoRows.map((t) => t.id)
    const placeholders = todoIds.map(() => '?').join(',')

    const subtaskRows = db
      .prepare(`SELECT * FROM subtasks WHERE todo_id IN (${placeholders}) ORDER BY position ASC`)
      .all(...todoIds) as SubtaskRow[]

    const tagRows = db
      .prepare(
        `SELECT t.*, tt.todo_id FROM tags t
         JOIN todo_tags tt ON t.id = tt.tag_id
         WHERE tt.todo_id IN (${placeholders})`
      )
      .all(...todoIds) as (TagRow & { todo_id: number })[]

    const subtasksByTodoId = new Map<number, Subtask[]>()
    for (const row of subtaskRows) {
      const existing = subtasksByTodoId.get(row.todo_id) ?? []
      subtasksByTodoId.set(row.todo_id, [...existing, rowToSubtask(row)])
    }

    const tagsByTodoId = new Map<number, Tag[]>()
    for (const row of tagRows) {
      const existing = tagsByTodoId.get(row.todo_id) ?? []
      tagsByTodoId.set(row.todo_id, [
        ...existing,
        {
          id: row.id,
          user_id: row.user_id,
          name: row.name,
          color: row.color,
          created_at: row.created_at,
        },
      ])
    }

    const todos = todoRows.map((row) => ({
      ...rowToTodo(row),
      subtasks: subtasksByTodoId.get(row.id) ?? [],
      tags: tagsByTodoId.get(row.id) ?? [],
    }))

    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }

    return todos.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1
      }
      const pa = priorityOrder[a.priority] ?? 1
      const pb = priorityOrder[b.priority] ?? 1
      if (pa !== pb) return pa - pb
      if (a.due_date === null && b.due_date === null) return 0
      if (a.due_date === null) return 1
      if (b.due_date === null) return -1
      return a.due_date.localeCompare(b.due_date)
    })
  },

  findById(id: number, userId: number): TodoWithRelations | null {
    const row = db
      .prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?')
      .get(id, userId) as TodoRow | undefined

    if (!row) return null

    const subtaskRows = db
      .prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC')
      .all(id) as SubtaskRow[]

    const tagRows = db
      .prepare(
        `SELECT t.* FROM tags t
         JOIN todo_tags tt ON t.id = tt.tag_id
         WHERE tt.todo_id = ?`
      )
      .all(id) as TagRow[]

    return {
      ...rowToTodo(row),
      subtasks: subtaskRows.map(rowToSubtask),
      tags: tagRows,
    }
  },

  update(id: number, userId: number, dto: UpdateTodoDto): Todo {
    const existing = db
      .prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?')
      .get(id, userId) as TodoRow | undefined

    if (!existing) {
      throw new Error('Todo not found')
    }

    const now = getSingaporeNow().toISOString()
    const fields: string[] = []
    const values: Record<string, unknown> = { id, userId, updated_at: now }

    if (dto.title !== undefined) {
      fields.push('title = @title')
      values.title = dto.title
    }
    if (dto.completed !== undefined) {
      fields.push('completed = @completed')
      values.completed = dto.completed ? 1 : 0
    }
    if (dto.due_date !== undefined) {
      fields.push('due_date = @due_date')
      values.due_date = dto.due_date
    }
    if (dto.priority !== undefined) {
      fields.push('priority = @priority')
      values.priority = dto.priority
    }
    if (dto.is_recurring !== undefined) {
      fields.push('is_recurring = @is_recurring')
      values.is_recurring = dto.is_recurring ? 1 : 0
    }
    if (dto.recurrence_pattern !== undefined) {
      fields.push('recurrence_pattern = @recurrence_pattern')
      values.recurrence_pattern = dto.recurrence_pattern
    }
    if (dto.reminder_minutes !== undefined) {
      fields.push('reminder_minutes = @reminder_minutes')
      values.reminder_minutes = dto.reminder_minutes
    }
    if (dto.last_notification_sent !== undefined) {
      fields.push('last_notification_sent = @last_notification_sent')
      values.last_notification_sent = dto.last_notification_sent
    }

    fields.push('updated_at = @updated_at')

    if (fields.length > 1) {
      db.prepare(
        `UPDATE todos SET ${fields.join(', ')} WHERE id = @id AND user_id = @userId`
      ).run(values)
    }

    const updated = db
      .prepare('SELECT * FROM todos WHERE id = ?')
      .get(id) as TodoRow

    const updatedTodo = rowToTodo(updated)

    // Handle recurring todo completion: create next instance
    if (
      dto.completed === true &&
      updatedTodo.is_recurring &&
      updatedTodo.recurrence_pattern &&
      updatedTodo.due_date
    ) {
      const nextDueDate = calculateNextDueDate(updatedTodo.due_date, updatedTodo.recurrence_pattern)
      const createNow = getSingaporeNow().toISOString()
      db.prepare(`
        INSERT INTO todos (
          user_id, title, completed, due_date, priority,
          is_recurring, recurrence_pattern, reminder_minutes,
          created_at, updated_at
        ) VALUES (
          @userId, @title, 0, @due_date, @priority,
          @is_recurring, @recurrence_pattern, @reminder_minutes,
          @created_at, @updated_at
        )
      `).run({
        userId: updatedTodo.user_id,
        title: updatedTodo.title,
        due_date: nextDueDate,
        priority: updatedTodo.priority,
        is_recurring: 1,
        recurrence_pattern: updatedTodo.recurrence_pattern,
        reminder_minutes: updatedTodo.reminder_minutes,
        created_at: createNow,
        updated_at: createNow,
      })
    }

    return updatedTodo
  },

  delete(id: number, userId: number): void {
    const existing = db
      .prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?')
      .get(id, userId)

    if (!existing) {
      throw new Error('Todo not found')
    }

    db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(id, userId)
  },

  findDueReminders(userId: number): TodoReminder[] {
    const rows = db.prepare(`
      SELECT id, title, due_date, reminder_minutes
      FROM todos
      WHERE
        user_id = ?
        AND completed = 0
        AND reminder_minutes IS NOT NULL
        AND due_date IS NOT NULL
        AND last_notification_sent IS NULL
        AND (
          CAST(strftime('%s', due_date) AS INTEGER) - (reminder_minutes * 60)
            <= CAST(strftime('%s', 'now') AS INTEGER)
        )
    `).all(userId) as Array<{
      id: number
      title: string
      due_date: string
      reminder_minutes: number
    }>

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      due_date: row.due_date,
      reminder_minutes: row.reminder_minutes,
    }))
  },

  updateLastNotificationSent(id: number, timestamp: string): void {
    db.prepare(
      'UPDATE todos SET last_notification_sent = ? WHERE id = ?'
    ).run(timestamp, id)
  },
}

