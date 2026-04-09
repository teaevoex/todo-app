import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// --- Database Connection (lazy initialization) ---

const dbPath = path.join(process.cwd(), 'todos.db')

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (_db) return _db

  try {
    const instance = new Database(dbPath)
    // Test that the database is not corrupt
    instance.pragma('integrity_check')
    instance.pragma('journal_mode = WAL')
    instance.pragma('foreign_keys = ON')
    _db = instance
  } catch (err) {
    // If database is corrupt, delete it and create a fresh one
    console.warn('Database corrupt or unreadable, recreating:', err)
    try { fs.unlinkSync(dbPath) } catch { /* file may not exist */ }
    try { fs.unlinkSync(dbPath + '-wal') } catch { /* ignore */ }
    try { fs.unlinkSync(dbPath + '-shm') } catch { /* ignore */ }
    const instance = new Database(dbPath)
    instance.pragma('journal_mode = WAL')
    instance.pragma('foreign_keys = ON')
    _db = instance
  }

  initSchema(_db!)
  return _db!
}

// Use a Proxy so all existing `db.xxx()` calls work without changes
const db: Database.Database = new Proxy({} as Database.Database, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

function initSchema(instance: Database.Database): void {
  instance.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS authenticators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    credential_id TEXT NOT NULL UNIQUE,
    credential_public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_pattern TEXT,
    reminder_minutes INTEGER,
    last_notification_sent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
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
    color TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, name COLLATE NOCASE)
  );

  CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (todo_id, tag_id),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date_offset INTEGER,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_pattern TEXT,
    reminder_minutes INTEGER,
    subtasks TEXT DEFAULT '[]',
    category TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
  CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
  CREATE INDEX IF NOT EXISTS idx_todos_user_completed ON todos(user_id, completed);
  CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
  CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
  CREATE INDEX IF NOT EXISTS idx_todo_tags_todo_id ON todo_tags(todo_id);
  CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);
  CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
  CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);
  CREATE INDEX IF NOT EXISTS idx_authenticators_credential_id ON authenticators(credential_id);
  CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
`)

  // Seed default user for development
  const defaultUser = instance.prepare('SELECT id FROM users WHERE username = ?').get('default')
  if (!defaultUser) {
    instance.prepare('INSERT INTO users (username) VALUES (?)').run('default')
  }
}

// --- Type Definitions ---

export type Priority = 'high' | 'medium' | 'low'
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface User {
  id: number
  username: string
  created_at: string
}

export interface Authenticator {
  id: number
  user_id: number
  credential_id: string
  credential_public_key: string
  counter: number
  transports: string | null
  created_at: string
}

export interface Todo {
  id: number
  user_id: number
  title: string
  completed: number
  due_date: string | null
  priority: Priority
  is_recurring: number
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: number | null
  last_notification_sent: string | null
  created_at: string
}

export interface Subtask {
  id: number
  todo_id: number
  title: string
  completed: number
  position: number
  created_at: string
}

export interface Tag {
  id: number
  user_id: number
  name: string
  color: string
  created_at: string
}

export interface Template {
  id: number
  user_id: number
  name: string
  title: string
  priority: Priority
  due_date_offset: number | null
  is_recurring: number
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: number | null
  subtasks: string
  category: string | null
  created_at: string
}

export interface Holiday {
  id: number
  name: string
  date: string
  created_at: string
}

export interface CreateTodoInput {
  title: string
  due_date?: string | null
  priority?: Priority
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
  reminder_minutes?: number | null
}

export interface UpdateTodoInput {
  title?: string
  completed?: boolean
  due_date?: string | null
  priority?: Priority
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
  reminder_minutes?: number | null
}

export interface CreateSubtaskInput {
  title: string
  position?: number
}

export interface UpdateSubtaskInput {
  title?: string
  completed?: boolean
  position?: number
}

export interface CreateTagInput {
  name: string
  color?: string
}

export interface UpdateTagInput {
  name?: string
  color?: string
}

export interface TemplateSubtask {
  title: string
  position: number
}

export interface CreateTemplateInput {
  title: string
  priority?: Priority
  category?: string
  due_date_offset?: number
  subtasks?: TemplateSubtask[]
}

export interface UpdateTemplateInput {
  title?: string
  priority?: Priority
  category?: string | null
  due_date_offset?: number | null
  subtasks?: TemplateSubtask[]
}

// --- User CRUD ---

export const userDB = {
  findByUsername(username: string): User | undefined {
    return db.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).get(username) as User | undefined
  },

  findById(id: number): User | undefined {
    return db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).get(id) as User | undefined
  },

  create(username: string): User {
    const result = db.prepare(
      'INSERT INTO users (username) VALUES (?)'
    ).run(username.trim())
    return userDB.findById(result.lastInsertRowid as number)!
  },
}

// --- Todo CRUD ---

export const todoDB = {
  findAll(userId: number): Todo[] {
    return db.prepare(
      'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as Todo[]
  },

  findById(id: number, userId: number): Todo | undefined {
    return db.prepare(
      'SELECT * FROM todos WHERE id = ? AND user_id = ?'
    ).get(id, userId) as Todo | undefined
  },

  create(userId: number, input: CreateTodoInput): Todo {
    const result = db.prepare(`
      INSERT INTO todos (user_id, title, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      input.title.trim(),
      input.due_date ?? null,
      input.priority ?? 'medium',
      input.is_recurring ? 1 : 0,
      input.recurrence_pattern ?? null,
      input.reminder_minutes ?? null
    )
    return todoDB.findById(result.lastInsertRowid as number, userId)!
  },

  update(id: number, userId: number, input: UpdateTodoInput): Todo | undefined {
    const todo = todoDB.findById(id, userId)
    if (!todo) return undefined

    const title = input.title !== undefined ? input.title.trim() : todo.title
    const completed = input.completed !== undefined ? (input.completed ? 1 : 0) : todo.completed
    const due_date = input.due_date !== undefined ? input.due_date : todo.due_date
    const priority = input.priority ?? todo.priority
    const is_recurring = input.is_recurring !== undefined ? (input.is_recurring ? 1 : 0) : todo.is_recurring
    const recurrence_pattern = input.recurrence_pattern !== undefined ? input.recurrence_pattern : todo.recurrence_pattern
    const reminder_minutes = input.reminder_minutes !== undefined ? input.reminder_minutes : todo.reminder_minutes

    db.prepare(`
      UPDATE todos SET title = ?, completed = ?, due_date = ?, priority = ?,
        is_recurring = ?, recurrence_pattern = ?, reminder_minutes = ?
      WHERE id = ? AND user_id = ?
    `).run(
      title,
      completed,
      due_date ?? null,
      priority,
      is_recurring,
      recurrence_pattern ?? null,
      reminder_minutes ?? null,
      id,
      userId
    )
    return todoDB.findById(id, userId)
  },

  delete(id: number, userId: number): boolean {
    const result = db.prepare(
      'DELETE FROM todos WHERE id = ? AND user_id = ?'
    ).run(id, userId)
    return result.changes > 0
  },

  findDueForNotification(userId: number, nowISO: string): Todo[] {
    return db.prepare(`
      SELECT * FROM todos
      WHERE user_id = ?
        AND reminder_minutes IS NOT NULL
        AND due_date IS NOT NULL
        AND completed = 0
        AND last_notification_sent IS NULL
        AND datetime(due_date, '-' || reminder_minutes || ' minutes') <= datetime(?)
    `).all(userId, nowISO) as Todo[]
  },

  markNotificationSent(ids: number[], userId: number, nowISO: string): void {
    const stmt = db.prepare(
      'UPDATE todos SET last_notification_sent = ? WHERE id = ? AND user_id = ?'
    )
    for (const id of ids) {
      stmt.run(nowISO, id, userId)
    }
  },
}

// --- Subtask CRUD ---

export const subtaskDB = {
  findByTodoId(todoId: number): Subtask[] {
    return db.prepare(
      'SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC, id ASC'
    ).all(todoId) as Subtask[]
  },

  findById(id: number): Subtask | undefined {
    return db.prepare(
      'SELECT * FROM subtasks WHERE id = ?'
    ).get(id) as Subtask | undefined
  },

  create(todoId: number, input: CreateSubtaskInput): Subtask {
    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) as maxPos FROM subtasks WHERE todo_id = ?'
    ).get(todoId) as { maxPos: number }

    const position = input.position ?? (maxPos.maxPos + 1)

    const result = db.prepare(`
      INSERT INTO subtasks (todo_id, title, position)
      VALUES (?, ?, ?)
    `).run(todoId, input.title.trim(), position)

    return subtaskDB.findById(result.lastInsertRowid as number)!
  },

  update(id: number, input: UpdateSubtaskInput): Subtask | undefined {
    const subtask = subtaskDB.findById(id)
    if (!subtask) return undefined

    const title = input.title !== undefined ? input.title.trim() : subtask.title
    const completed = input.completed !== undefined ? (input.completed ? 1 : 0) : subtask.completed
    const position = input.position !== undefined ? input.position : subtask.position

    db.prepare(`
      UPDATE subtasks SET title = ?, completed = ?, position = ?
      WHERE id = ?
    `).run(title, completed, position, id)

    return subtaskDB.findById(id)
  },

  delete(id: number): boolean {
    const result = db.prepare('DELETE FROM subtasks WHERE id = ?').run(id)
    return result.changes > 0
  },
}

// --- Tag CRUD ---

export const tagDB = {
  findAll(userId: number): Tag[] {
    return db.prepare(
      'SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC'
    ).all(userId) as Tag[]
  },

  findById(id: number, userId: number): Tag | undefined {
    return db.prepare(
      'SELECT * FROM tags WHERE id = ? AND user_id = ?'
    ).get(id, userId) as Tag | undefined
  },

  findByName(name: string, userId: number): Tag | undefined {
    return db.prepare(
      'SELECT * FROM tags WHERE name = ? AND user_id = ?'
    ).get(name, userId) as Tag | undefined
  },

  create(userId: number, input: CreateTagInput): Tag {
    const color = input.color ?? '#6B7280'
    const result = db.prepare(`
      INSERT INTO tags (user_id, name, color)
      VALUES (?, ?, ?)
    `).run(userId, input.name.trim(), color)

    return db.prepare('SELECT * FROM tags WHERE id = ?')
      .get(result.lastInsertRowid) as Tag
  },

  update(id: number, userId: number, input: UpdateTagInput): Tag | undefined {
    const tag = tagDB.findById(id, userId)
    if (!tag) return undefined

    const name = input.name !== undefined ? input.name.trim() : tag.name
    const color = input.color !== undefined ? input.color : tag.color

    db.prepare(`
      UPDATE tags SET name = ?, color = ?
      WHERE id = ? AND user_id = ?
    `).run(name, color, id, userId)

    return tagDB.findById(id, userId)
  },

  delete(id: number, userId: number): boolean {
    const result = db.prepare(
      'DELETE FROM tags WHERE id = ? AND user_id = ?'
    ).run(id, userId)
    return result.changes > 0
  },
}

// --- TodoTag CRUD ---

export const todoTagDB = {
  findByTodoId(todoId: number): Tag[] {
    return db.prepare(`
      SELECT t.* FROM tags t
      JOIN todo_tags tt ON tt.tag_id = t.id
      WHERE tt.todo_id = ?
      ORDER BY t.name ASC
    `).all(todoId) as Tag[]
  },

  setTags(todoId: number, tagIds: number[]): void {
    db.prepare('DELETE FROM todo_tags WHERE todo_id = ?').run(todoId)
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)'
    )
    for (const tagId of tagIds) {
      stmt.run(todoId, tagId)
    }
  },

  addTag(todoId: number, tagId: number): void {
    db.prepare(
      'INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)'
    ).run(todoId, tagId)
  },

  removeTag(todoId: number, tagId: number): boolean {
    const result = db.prepare(
      'DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?'
    ).run(todoId, tagId)
    return result.changes > 0
  },
}

// --- Template CRUD ---

export const templateDB = {
  findAll(userId: number): Template[] {
    return db.prepare(
      'SELECT * FROM templates WHERE user_id = ? ORDER BY category ASC, title ASC'
    ).all(userId) as Template[]
  },

  findById(id: number, userId: number): Template | undefined {
    return db.prepare(
      'SELECT * FROM templates WHERE id = ? AND user_id = ?'
    ).get(id, userId) as Template | undefined
  },

  create(userId: number, input: CreateTemplateInput): Template {
    const subtasksJson = JSON.stringify(input.subtasks ?? [])
    const result = db.prepare(`
      INSERT INTO templates (user_id, name, title, priority, category, due_date_offset, subtasks)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      input.title.trim(),
      input.title.trim(),
      input.priority ?? 'medium',
      input.category?.trim() || null,
      input.due_date_offset ?? null,
      subtasksJson
    )

    return templateDB.findById(result.lastInsertRowid as number, userId)!
  },

  update(id: number, userId: number, input: UpdateTemplateInput): Template | undefined {
    const template = templateDB.findById(id, userId)
    if (!template) return undefined

    const title = input.title !== undefined ? input.title.trim() : template.title
    const priority = input.priority !== undefined ? input.priority : template.priority
    const category = input.category !== undefined
      ? (input.category?.trim() || null)
      : template.category
    const dueOffset = input.due_date_offset !== undefined
      ? input.due_date_offset
      : template.due_date_offset
    const subtasksJson = input.subtasks !== undefined
      ? JSON.stringify(input.subtasks)
      : template.subtasks

    db.prepare(`
      UPDATE templates SET name = ?, title = ?, priority = ?, category = ?, due_date_offset = ?, subtasks = ?
      WHERE id = ? AND user_id = ?
    `).run(title, title, priority, category, dueOffset, subtasksJson, id, userId)

    return templateDB.findById(id, userId)
  },

  delete(id: number, userId: number): boolean {
    const result = db.prepare(
      'DELETE FROM templates WHERE id = ? AND user_id = ?'
    ).run(id, userId)
    return result.changes > 0
  },
}

// --- Holiday CRUD ---

export const holidayDB = {
  findByMonth(year: number, month: number): Holiday[] {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`
    return db.prepare(
      'SELECT * FROM holidays WHERE date >= ? AND date <= ? ORDER BY date ASC'
    ).all(startDate, endDate) as Holiday[]
  },

  findByDate(date: string): Holiday | undefined {
    return db.prepare(
      'SELECT * FROM holidays WHERE date = ?'
    ).get(date) as Holiday | undefined
  },
}

// --- Authenticator CRUD (stub for PRP 11) ---

export const authenticatorDB = {
  findByCredentialId(credentialId: string): Authenticator | undefined {
    return db.prepare(
      'SELECT * FROM authenticators WHERE credential_id = ?'
    ).get(credentialId) as Authenticator | undefined
  },

  findByUserId(userId: number): Authenticator[] {
    return db.prepare(
      'SELECT * FROM authenticators WHERE user_id = ?'
    ).all(userId) as Authenticator[]
  },

  create(userId: number, data: {
    credentialId: string
    credentialPublicKey: string
    counter: number
    transports?: string
  }): Authenticator {
    const result = db.prepare(`
      INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter, transports)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userId,
      data.credentialId,
      data.credentialPublicKey,
      data.counter ?? 0,
      data.transports ?? null
    )
    return db.prepare('SELECT * FROM authenticators WHERE id = ?')
      .get(result.lastInsertRowid) as Authenticator
  },

  updateCounter(credentialId: string, counter: number): void {
    db.prepare(
      'UPDATE authenticators SET counter = ? WHERE credential_id = ?'
    ).run(counter, credentialId)
  },
}

export default db
