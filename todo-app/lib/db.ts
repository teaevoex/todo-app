import Database from 'better-sqlite3';
import path from 'path';

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface AuthenticatorRecord {
  id: number;
  user_id: number;
  credential_id: string;
  public_key: string;
  counter: number;
  device_type: string | null;
  backed_up: number | null;
  transports: string | null;
  created_at: string;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: number;
  position: number;
  created_at: string;
}

export interface Template {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  category: string | null;
  title_template: string;
  priority: Priority;
  is_recurring: number;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  due_date_offset_minutes: number | null;
  subtasks_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: number;
  priority: Priority;
  due_date: string | null;
  is_recurring: number;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  subtasks?: Subtask[];
}

const dbPath = path.join(process.cwd(), 'todos.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS authenticators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_type TEXT,
  backed_up INTEGER,
  transports TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT,
  reminder_minutes INTEGER,
  last_notification_sent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name)
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
  description TEXT,
  category TEXT,
  title_template TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT,
  reminder_minutes INTEGER,
  due_date_offset_minutes INTEGER,
  subtasks_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);
`);

function attachTodoRelations(todos: Todo[]) {
  if (todos.length === 0) return [];
  const ids = todos.map((todo) => todo.id);
  const placeholders = ids.map(() => '?').join(', ');
  const subtasks = db
    .prepare(`SELECT * FROM subtasks WHERE todo_id IN (${placeholders}) ORDER BY position ASC, id ASC`)
    .all(...ids) as Subtask[];
  const tags = db
    .prepare(
      `SELECT tt.todo_id, t.* FROM todo_tags tt
       JOIN tags t ON t.id = tt.tag_id
       WHERE tt.todo_id IN (${placeholders})
       ORDER BY t.name ASC`,
    )
    .all(...ids) as Array<Tag & { todo_id: number }>;

  return todos.map((todo) => ({
    ...todo,
    subtasks: subtasks.filter((subtask) => subtask.todo_id === todo.id),
    tags: tags.filter((tag) => tag.todo_id === todo.id).map(({ todo_id: _todoId, ...tag }) => tag),
  }));
}

export const userDB = {
  getByUsername(username: string) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  },
  getById(id: number) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  },
  create(username: string) {
    const info = db.prepare('INSERT INTO users (username) VALUES (?)').run(username);
    return this.getById(Number(info.lastInsertRowid));
  },
  delete(id: number) {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },
};

export const authenticatorDB = {
  create(record: Omit<AuthenticatorRecord, 'id' | 'created_at'>) {
    db.prepare(
      `INSERT INTO authenticators
       (user_id, credential_id, public_key, counter, device_type, backed_up, transports)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      record.user_id,
      record.credential_id,
      record.public_key,
      record.counter ?? 0,
      record.device_type ?? null,
      record.backed_up ?? null,
      record.transports ?? null,
    );
  },
  getByCredentialId(credentialId: string) {
    return db
      .prepare('SELECT * FROM authenticators WHERE credential_id = ?')
      .get(credentialId) as AuthenticatorRecord | undefined;
  },
  getForUser(userId: number) {
    return db
      .prepare('SELECT * FROM authenticators WHERE user_id = ? ORDER BY id ASC')
      .all(userId) as AuthenticatorRecord[];
  },
  updateCounter(id: number, counter: number) {
    db.prepare('UPDATE authenticators SET counter = ? WHERE id = ?').run(counter, id);
  },
};

export const todoDB = {
  listByUser(userId: number) {
    const todos = db
      .prepare(
        `SELECT * FROM todos WHERE user_id = ?
         ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                  CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
                  due_date ASC,
                  created_at DESC`,
      )
      .all(userId) as Todo[];
    return attachTodoRelations(todos);
  },
  getById(userId: number, id: number) {
    const todo = db.prepare('SELECT * FROM todos WHERE user_id = ? AND id = ?').get(userId, id) as Todo | undefined;
    if (!todo) return undefined;
    return attachTodoRelations([todo])[0];
  },
  create(
    payload: Omit<Todo, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_notification_sent' | 'tags' | 'subtasks'> & {
      user_id: number;
      last_notification_sent?: string | null;
    },
  ) {
    const info = db
      .prepare(
        `INSERT INTO todos
        (user_id, title, completed, priority, due_date, is_recurring, recurrence_pattern, reminder_minutes, last_notification_sent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        payload.user_id,
        payload.title,
        payload.completed,
        payload.priority,
        payload.due_date ?? null,
        payload.is_recurring,
        payload.recurrence_pattern ?? null,
        payload.reminder_minutes ?? null,
        payload.last_notification_sent ?? null,
      );
    return this.getById(payload.user_id, Number(info.lastInsertRowid));
  },
  update(userId: number, id: number, updates: Partial<Todo>) {
    const current = db.prepare('SELECT * FROM todos WHERE user_id = ? AND id = ?').get(userId, id) as Todo | undefined;
    if (!current) return undefined;
    db.prepare(
      `UPDATE todos SET
      title = ?, completed = ?, priority = ?, due_date = ?, is_recurring = ?,
      recurrence_pattern = ?, reminder_minutes = ?, last_notification_sent = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND id = ?`,
    ).run(
      updates.title ?? current.title,
      updates.completed ?? current.completed,
      updates.priority ?? current.priority,
      updates.due_date ?? current.due_date,
      updates.is_recurring ?? current.is_recurring,
      updates.recurrence_pattern ?? current.recurrence_pattern,
      updates.reminder_minutes ?? current.reminder_minutes,
      updates.last_notification_sent ?? current.last_notification_sent,
      userId,
      id,
    );
    return this.getById(userId, id);
  },
  delete(userId: number, id: number) {
    return db.prepare('DELETE FROM todos WHERE user_id = ? AND id = ?').run(userId, id);
  },
  setTags(todoId: number, tagIds: number[]) {
    const deleteStmt = db.prepare('DELETE FROM todo_tags WHERE todo_id = ?');
    const insertStmt = db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
    const transaction = db.transaction((incomingTagIds: number[]) => {
      deleteStmt.run(todoId);
      incomingTagIds.forEach((tagId) => insertStmt.run(todoId, tagId));
    });
    transaction(tagIds);
  },
  addTag(todoId: number, tagId: number) {
    db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
  },
  removeTag(todoId: number, tagId: number) {
    db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?').run(todoId, tagId);
  },
  pendingNotifications(userId: number, nowIso: string) {
    return db
      .prepare(
        `SELECT * FROM todos
         WHERE user_id = ? AND completed = 0 AND due_date IS NOT NULL AND reminder_minutes IS NOT NULL
         AND datetime(due_date, printf('-%d minutes', reminder_minutes)) <= datetime(?)
         AND (last_notification_sent IS NULL OR datetime(last_notification_sent) < datetime(due_date, printf('-%d minutes', reminder_minutes)))`,
      )
      .all(userId, nowIso) as Todo[];
  },
};

export const subtaskDB = {
  create(todoId: number, title: string) {
    const maxPosition = db.prepare('SELECT COALESCE(MAX(position), -1) as value FROM subtasks WHERE todo_id = ?').get(todoId) as {
      value: number;
    };
    const info = db.prepare('INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)').run(todoId, title, maxPosition.value + 1);
    return db.prepare('SELECT * FROM subtasks WHERE id = ?').get(Number(info.lastInsertRowid)) as Subtask;
  },
  update(id: number, title: string | null, completed: number | null) {
    const current = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as Subtask | undefined;
    if (!current) return undefined;
    db.prepare('UPDATE subtasks SET title = ?, completed = ? WHERE id = ?').run(title ?? current.title, completed ?? current.completed, id);
    return db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as Subtask;
  },
  delete(id: number) {
    return db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
  },
};

export const tagDB = {
  listByUser(userId: number) {
    return db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC').all(userId) as Tag[];
  },
  getById(userId: number, id: number) {
    return db.prepare('SELECT * FROM tags WHERE user_id = ? AND id = ?').get(userId, id) as Tag | undefined;
  },
  getByName(userId: number, name: string) {
    return db.prepare('SELECT * FROM tags WHERE user_id = ? AND name = ?').get(userId, name) as Tag | undefined;
  },
  create(userId: number, name: string, color: string) {
    const info = db.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)').run(userId, name, color);
    return this.getById(userId, Number(info.lastInsertRowid));
  },
  update(userId: number, id: number, name: string, color: string) {
    db.prepare('UPDATE tags SET name = ?, color = ? WHERE user_id = ? AND id = ?').run(name, color, userId, id);
    return this.getById(userId, id);
  },
  delete(userId: number, id: number) {
    return db.prepare('DELETE FROM tags WHERE user_id = ? AND id = ?').run(userId, id);
  },
};

export const templateDB = {
  listByUser(userId: number) {
    return db.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY name ASC').all(userId) as Template[];
  },
  getById(userId: number, id: number) {
    return db.prepare('SELECT * FROM templates WHERE user_id = ? AND id = ?').get(userId, id) as Template | undefined;
  },
  create(payload: Omit<Template, 'id' | 'created_at' | 'updated_at'>) {
    const info = db
      .prepare(
        `INSERT INTO templates
        (user_id, name, description, category, title_template, priority, is_recurring, recurrence_pattern, reminder_minutes, due_date_offset_minutes, subtasks_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        payload.user_id,
        payload.name,
        payload.description ?? null,
        payload.category ?? null,
        payload.title_template,
        payload.priority,
        payload.is_recurring,
        payload.recurrence_pattern ?? null,
        payload.reminder_minutes ?? null,
        payload.due_date_offset_minutes ?? null,
        payload.subtasks_json ?? null,
      );
    return this.getById(payload.user_id, Number(info.lastInsertRowid));
  },
  update(userId: number, id: number, updates: Partial<Template>) {
    const current = this.getById(userId, id);
    if (!current) return undefined;
    db.prepare(
      `UPDATE templates SET
      name = ?, description = ?, category = ?, title_template = ?, priority = ?, is_recurring = ?,
      recurrence_pattern = ?, reminder_minutes = ?, due_date_offset_minutes = ?, subtasks_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND id = ?`,
    ).run(
      updates.name ?? current.name,
      updates.description ?? current.description,
      updates.category ?? current.category,
      updates.title_template ?? current.title_template,
      updates.priority ?? current.priority,
      updates.is_recurring ?? current.is_recurring,
      updates.recurrence_pattern ?? current.recurrence_pattern,
      updates.reminder_minutes ?? current.reminder_minutes,
      updates.due_date_offset_minutes ?? current.due_date_offset_minutes,
      updates.subtasks_json ?? current.subtasks_json,
      userId,
      id,
    );
    return this.getById(userId, id);
  },
  delete(userId: number, id: number) {
    return db.prepare('DELETE FROM templates WHERE user_id = ? AND id = ?').run(userId, id);
  },
};

export const holidayDB = {
  list() {
    return db.prepare('SELECT * FROM holidays ORDER BY date ASC').all() as Holiday[];
  },
  replaceAll(items: Array<{ date: string; name: string }>) {
    const clearStmt = db.prepare('DELETE FROM holidays');
    const insertStmt = db.prepare('INSERT INTO holidays (date, name) VALUES (?, ?)');
    const transaction = db.transaction((rows: Array<{ date: string; name: string }>) => {
      clearStmt.run();
      rows.forEach((row) => insertStmt.run(row.date, row.name));
    });
    transaction(items);
  },
};

export function exportUserData(userId: number) {
  const todos = db.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY id ASC').all(userId) as Todo[];
  const tags = db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY id ASC').all(userId) as Tag[];
  const todoIds = todos.map((todo) => todo.id);
  const tagIds = tags.map((tag) => tag.id);

  const subtasks =
    todoIds.length > 0
      ? (db
          .prepare(`SELECT * FROM subtasks WHERE todo_id IN (${todoIds.map(() => '?').join(', ')}) ORDER BY id ASC`)
          .all(...todoIds) as Subtask[])
      : [];
  const todo_tags =
    todoIds.length > 0 && tagIds.length > 0
      ? db
          .prepare(`SELECT * FROM todo_tags WHERE todo_id IN (${todoIds.map(() => '?').join(', ')}) ORDER BY todo_id ASC, tag_id ASC`)
          .all(...todoIds)
      : [];

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    todos,
    subtasks,
    tags,
    todo_tags,
  };
}

export function importUserData(
  userId: number,
  payload: {
    todos: Todo[];
    subtasks: Subtask[];
    tags: Tag[];
    todo_tags: Array<{ todo_id: number; tag_id: number }>;
  },
) {
  const todoIdMap = new Map<number, number>();
  const tagIdMap = new Map<number, number>();

  const transaction = db.transaction(() => {
    for (const tag of payload.tags) {
      const existing = tagDB.getByName(userId, tag.name);
      const resolved = existing ?? tagDB.create(userId, tag.name, tag.color);
      if (resolved) tagIdMap.set(tag.id, resolved.id);
    }

    for (const todo of payload.todos) {
      const created = todoDB.create({
        user_id: userId,
        title: todo.title,
        completed: todo.completed ?? 0,
        priority: todo.priority,
        due_date: todo.due_date ?? null,
        is_recurring: todo.is_recurring ?? 0,
        recurrence_pattern: todo.recurrence_pattern ?? null,
        reminder_minutes: todo.reminder_minutes ?? null,
        last_notification_sent: null,
      });
      if (created) todoIdMap.set(todo.id, created.id);
    }

    for (const subtask of payload.subtasks) {
      const newTodoId = todoIdMap.get(subtask.todo_id);
      if (!newTodoId) continue;
      const created = subtaskDB.create(newTodoId, subtask.title);
      if (subtask.completed) {
        subtaskDB.update(created.id, created.title, 1);
      }
    }

    for (const rel of payload.todo_tags) {
      const todoId = todoIdMap.get(rel.todo_id);
      const tagId = tagIdMap.get(rel.tag_id);
      if (todoId && tagId) {
        todoDB.addTag(todoId, tagId);
      }
    }
  });

  transaction();

  return {
    todosImported: todoIdMap.size,
    tagsReusedOrImported: tagIdMap.size,
  };
}

export default db;
