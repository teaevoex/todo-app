import { db } from './connection'
import type {
  Subtask,
  CreateSubtaskDto,
  UpdateSubtaskDto,
} from '@/lib/types'

interface SubtaskRow {
  id: number
  todo_id: number
  title: string
  completed: number
  position: number
  created_at: string
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

export const subtaskDB = {
  create(todoId: number, dto: CreateSubtaskDto): Subtask {
    const createWithPosition = db.transaction(() => {
      const posRow = db
        .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM subtasks WHERE todo_id = ?')
        .get(todoId) as { next_pos: number }

      const position = posRow.next_pos

      const info = db
        .prepare(
          'INSERT INTO subtasks (todo_id, title, completed, position) VALUES (?, ?, 0, ?)'
        )
        .run(todoId, dto.title, position)

      return db
        .prepare('SELECT * FROM subtasks WHERE id = ?')
        .get(info.lastInsertRowid) as SubtaskRow
    })

    const row = createWithPosition()
    return rowToSubtask(row)
  },

  findByTodoId(todoId: number): Subtask[] {
    const rows = db
      .prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC')
      .all(todoId) as SubtaskRow[]

    return rows.map(rowToSubtask)
  },

  update(id: number, dto: UpdateSubtaskDto): Subtask {
    const fields: string[] = []
    const values: Record<string, unknown> = { id }

    if (dto.title !== undefined) {
      fields.push('title = @title')
      values.title = dto.title
    }
    if (dto.completed !== undefined) {
      fields.push('completed = @completed')
      values.completed = dto.completed ? 1 : 0
    }

    if (fields.length > 0) {
      db.prepare(
        `UPDATE subtasks SET ${fields.join(', ')} WHERE id = @id`
      ).run(values)
    }

    const row = db
      .prepare('SELECT * FROM subtasks WHERE id = ?')
      .get(id) as SubtaskRow | undefined

    if (!row) {
      throw new Error('Subtask not found')
    }

    return rowToSubtask(row)
  },

  delete(id: number): void {
    db.prepare('DELETE FROM subtasks WHERE id = ?').run(id)
  },
}
