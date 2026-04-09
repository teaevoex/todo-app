import { db } from './connection'
import type {
  Tag,
  CreateTagDto,
  UpdateTagDto,
} from '@/lib/types'

interface TagRow {
  id: number
  user_id: number
  name: string
  color: string
  created_at: string
}

function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    color: row.color,
    created_at: row.created_at,
  }
}

export const tagDB = {
  create(userId: number, dto: CreateTagDto): Tag {
    try {
      const stmt = db.prepare(`
        INSERT INTO tags (user_id, name, color)
        VALUES (@userId, @name, @color)
      `)
      const info = stmt.run({
        userId,
        name: dto.name,
        color: dto.color,
      })
      const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(info.lastInsertRowid) as TagRow
      return rowToTag(row)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('UNIQUE constraint failed: tags.user_id, tags.name')
      ) {
        throw new Error('Tag name already exists')
      }
      throw error
    }
  },

  findAll(userId: number): Tag[] {
    const rows = db
      .prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC')
      .all(userId) as TagRow[]
    return rows.map(rowToTag)
  },

  findById(id: number, userId: number): Tag | null {
    const row = db
      .prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?')
      .get(id, userId) as TagRow | undefined
    return row ? rowToTag(row) : null
  },

  update(id: number, userId: number, dto: UpdateTagDto): Tag {
    const existing = db
      .prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?')
      .get(id, userId) as TagRow | undefined

    if (!existing) {
      throw new Error('Tag not found')
    }

    const fields: string[] = []
    const values: Record<string, unknown> = { id, userId }

    if (dto.name !== undefined) {
      fields.push('name = @name')
      values.name = dto.name
    }
    if (dto.color !== undefined) {
      fields.push('color = @color')
      values.color = dto.color
    }

    if (fields.length === 0) {
      return rowToTag(existing)
    }

    try {
      db.prepare(
        `UPDATE tags SET ${fields.join(', ')} WHERE id = @id AND user_id = @userId`
      ).run(values)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('UNIQUE constraint failed: tags.user_id, tags.name')
      ) {
        throw new Error('Tag name already exists')
      }
      throw error
    }

    const updated = db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as TagRow
    return rowToTag(updated)
  },

  delete(id: number, userId: number): void {
    const existing = db
      .prepare('SELECT id FROM tags WHERE id = ? AND user_id = ?')
      .get(id, userId)

    if (!existing) {
      throw new Error('Tag not found')
    }

    db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, userId)
  },

  getTagsForTodo(todoId: number): Tag[] {
    const rows = db
      .prepare(
        `SELECT t.* FROM tags t
         JOIN todo_tags tt ON t.id = tt.tag_id
         WHERE tt.todo_id = ?`
      )
      .all(todoId) as TagRow[]
    return rows.map(rowToTag)
  },

  assignTag(todoId: number, tagId: number): void {
    db.prepare(
      'INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)'
    ).run(todoId, tagId)
  },

  removeTag(todoId: number, tagId: number): void {
    db.prepare(
      'DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?'
    ).run(todoId, tagId)
  },
}
