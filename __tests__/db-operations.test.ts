import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const TEST_DB_PATH = path.join(process.cwd(), 'test-eval.db')

let db: Database.Database

function setupTestDb(): Database.Database {
  const testDb = new Database(TEST_DB_PATH)
  testDb.pragma('journal_mode = WAL')
  testDb.pragma('foreign_keys = ON')

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_pattern TEXT CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly')),
      reminder_minutes INTEGER,
      last_notification_sent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6b7280',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS todo_tags (
      todo_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (todo_id, tag_id),
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
  `)

  return testDb
}

beforeAll(() => {
  db = setupTestDb()
  db.prepare('INSERT INTO users (username) VALUES (?)').run('testuser')
})

afterAll(() => {
  db.close()
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH)
  const walPath = TEST_DB_PATH + '-wal'
  const shmPath = TEST_DB_PATH + '-shm'
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
})

describe('Database CRUD operations', () => {
  describe('Todos', () => {
    it('creates a todo with required fields', () => {
      const result = db.prepare(
        'INSERT INTO todos (user_id, title) VALUES (?, ?)'
      ).run(1, 'Test todo')
      expect(result.lastInsertRowid).toBeGreaterThan(0)
    })

    it('creates a todo with all fields', () => {
      const result = db.prepare(`
        INSERT INTO todos (user_id, title, priority, due_date, is_recurring, recurrence_pattern, reminder_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'Full todo', 'high', '2026-04-15T02:00:00.000Z', 1, 'daily', 15)
      expect(result.lastInsertRowid).toBeGreaterThan(0)
    })

    it('reads todos by user_id', () => {
      const rows = db.prepare('SELECT * FROM todos WHERE user_id = ?').all(1)
      expect(rows.length).toBeGreaterThanOrEqual(2)
    })

    it('updates a todo', () => {
      db.prepare('UPDATE todos SET title = ?, completed = 1 WHERE id = 1').run('Updated todo')
      const row = db.prepare('SELECT * FROM todos WHERE id = 1').get() as { title: string; completed: number }
      expect(row.title).toBe('Updated todo')
      expect(row.completed).toBe(1)
    })

    it('enforces priority CHECK constraint', () => {
      expect(() => {
        db.prepare('INSERT INTO todos (user_id, title, priority) VALUES (?, ?, ?)').run(1, 'Bad', 'critical')
      }).toThrow()
    })

    it('enforces recurrence_pattern CHECK constraint', () => {
      expect(() => {
        db.prepare(
          'INSERT INTO todos (user_id, title, is_recurring, recurrence_pattern) VALUES (?, ?, ?, ?)'
        ).run(1, 'Bad', 1, 'biweekly')
      }).toThrow()
    })

    it('defaults priority to medium', () => {
      const result = db.prepare('INSERT INTO todos (user_id, title) VALUES (?, ?)').run(1, 'Default priority')
      const row = db.prepare('SELECT priority FROM todos WHERE id = ?').get(result.lastInsertRowid) as { priority: string }
      expect(row.priority).toBe('medium')
    })

    it('deletes a todo', () => {
      const ins = db.prepare('INSERT INTO todos (user_id, title) VALUES (?, ?)').run(1, 'To delete')
      const id = ins.lastInsertRowid
      db.prepare('DELETE FROM todos WHERE id = ?').run(id)
      const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id)
      expect(row).toBeUndefined()
    })
  })

  describe('Subtasks', () => {
    let todoId: number

    beforeAll(() => {
      const result = db.prepare('INSERT INTO todos (user_id, title) VALUES (?, ?)').run(1, 'Parent todo')
      todoId = Number(result.lastInsertRowid)
    })

    it('creates subtasks for a todo', () => {
      const r1 = db.prepare('INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)').run(todoId, 'Sub 1', 0)
      const r2 = db.prepare('INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)').run(todoId, 'Sub 2', 1)
      expect(r1.lastInsertRowid).toBeGreaterThan(0)
      expect(r2.lastInsertRowid).toBeGreaterThan(0)
    })

    it('reads subtasks by todo_id', () => {
      const rows = db.prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position').all(todoId)
      expect(rows).toHaveLength(2)
    })

    it('toggles subtask completion', () => {
      db.prepare('UPDATE subtasks SET completed = 1 WHERE todo_id = ? AND position = 0').run(todoId)
      const row = db.prepare('SELECT completed FROM subtasks WHERE todo_id = ? AND position = 0').get(todoId) as { completed: number }
      expect(row.completed).toBe(1)
    })

    it('cascades delete when parent todo is deleted', () => {
      const subtasksBefore = db.prepare('SELECT * FROM subtasks WHERE todo_id = ?').all(todoId)
      expect(subtasksBefore.length).toBeGreaterThan(0)

      db.prepare('DELETE FROM todos WHERE id = ?').run(todoId)

      const subtasksAfter = db.prepare('SELECT * FROM subtasks WHERE todo_id = ?').all(todoId)
      expect(subtasksAfter).toHaveLength(0)
    })
  })

  describe('Tags', () => {
    it('creates a tag', () => {
      const result = db.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)').run(1, 'Work', '#ff0000')
      expect(result.lastInsertRowid).toBeGreaterThan(0)
    })

    it('enforces unique tag name per user', () => {
      expect(() => {
        db.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)').run(1, 'Work', '#00ff00')
      }).toThrow(/UNIQUE constraint/)
    })

    it('reads tags by user_id', () => {
      db.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)').run(1, 'Personal', '#0000ff')
      const rows = db.prepare('SELECT * FROM tags WHERE user_id = ?').all(1)
      expect(rows.length).toBeGreaterThanOrEqual(2)
    })

    it('updates a tag', () => {
      db.prepare('UPDATE tags SET name = ?, color = ? WHERE user_id = ? AND name = ?').run('Office', '#ff5500', 1, 'Work')
      const row = db.prepare("SELECT * FROM tags WHERE user_id = 1 AND name = 'Office'").get() as { name: string; color: string }
      expect(row.name).toBe('Office')
      expect(row.color).toBe('#ff5500')
    })
  })

  describe('Todo-Tag associations', () => {
    let todoId: number
    let tagId: number

    beforeAll(() => {
      const todoResult = db.prepare('INSERT INTO todos (user_id, title) VALUES (?, ?)').run(1, 'Tagged todo')
      todoId = Number(todoResult.lastInsertRowid)
      const tagRow = db.prepare("SELECT id FROM tags WHERE user_id = 1 AND name = 'Office'").get() as { id: number }
      tagId = tagRow.id
    })

    it('assigns a tag to a todo', () => {
      db.prepare('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId)
      const rows = db.prepare('SELECT * FROM todo_tags WHERE todo_id = ?').all(todoId)
      expect(rows).toHaveLength(1)
    })

    it('removes tag association when tag is deleted', () => {
      db.prepare('DELETE FROM tags WHERE id = ?').run(tagId)
      const rows = db.prepare('SELECT * FROM todo_tags WHERE todo_id = ?').all(todoId)
      expect(rows).toHaveLength(0)
    })
  })

  describe('Prepared statements and parameterization', () => {
    it('uses parameterized queries (no SQL injection)', () => {
      const maliciousTitle = "'; DROP TABLE todos; --"
      db.prepare('INSERT INTO todos (user_id, title) VALUES (?, ?)').run(1, maliciousTitle)
      const row = db.prepare('SELECT * FROM todos WHERE title = ?').get(maliciousTitle) as { title: string }
      expect(row.title).toBe(maliciousTitle)

      const count = db.prepare('SELECT COUNT(*) as c FROM todos').get() as { c: number }
      expect(count.c).toBeGreaterThan(0)
    })
  })
})
