import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'todos.db')

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (_db) {
    return _db
  }

  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  _db.exec(`
    -- ============================================================
    -- USERS & AUTHENTICATION
    -- ============================================================

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS authenticators (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          INTEGER NOT NULL,
      credential_id    TEXT    NOT NULL UNIQUE,
      credential_public_key TEXT NOT NULL,
      counter          INTEGER NOT NULL DEFAULT 0,
      transports       TEXT,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_authenticators_user_id
      ON authenticators(user_id);
    CREATE INDEX IF NOT EXISTS idx_authenticators_credential_id
      ON authenticators(credential_id);

    -- ============================================================
    -- TODOS
    -- ============================================================

    CREATE TABLE IF NOT EXISTS todos (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id               INTEGER NOT NULL,
      title                 TEXT    NOT NULL,
      completed             INTEGER NOT NULL DEFAULT 0,
      due_date              TEXT,
      priority              TEXT    NOT NULL DEFAULT 'medium'
                              CHECK (priority IN ('high', 'medium', 'low')),
      is_recurring          INTEGER NOT NULL DEFAULT 0,
      recurrence_pattern    TEXT
                              CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly')),
      reminder_minutes      INTEGER,
      last_notification_sent TEXT,
      created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_todos_user_id     ON todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_todos_due_date    ON todos(due_date);
    CREATE INDEX IF NOT EXISTS idx_todos_priority    ON todos(priority);
    CREATE INDEX IF NOT EXISTS idx_todos_completed   ON todos(completed);
    CREATE INDEX IF NOT EXISTS idx_todos_user_completed
      ON todos(user_id, completed);
    CREATE INDEX IF NOT EXISTS idx_todos_user_due_date
      ON todos(user_id, due_date);

    -- ============================================================
    -- SUBTASKS
    -- ============================================================

    CREATE TABLE IF NOT EXISTS subtasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id     INTEGER NOT NULL,
      title       TEXT    NOT NULL,
      completed   INTEGER NOT NULL DEFAULT 0,
      position    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id
      ON subtasks(todo_id);

    -- ============================================================
    -- TAGS
    -- ============================================================

    CREATE TABLE IF NOT EXISTS tags (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      name        TEXT    NOT NULL,
      color       TEXT    NOT NULL DEFAULT '#3B82F6',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

    CREATE TABLE IF NOT EXISTS todo_tags (
      todo_id INTEGER NOT NULL,
      tag_id  INTEGER NOT NULL,
      PRIMARY KEY (todo_id, tag_id),
      FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_todo_tags_todo_id ON todo_tags(todo_id);
    CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id  ON todo_tags(tag_id);

    -- ============================================================
    -- TEMPLATES
    -- ============================================================

    CREATE TABLE IF NOT EXISTS templates (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id             INTEGER NOT NULL,
      name                TEXT    NOT NULL,
      description         TEXT,
      category            TEXT,
      title_template      TEXT    NOT NULL,
      priority            TEXT    NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('high', 'medium', 'low')),
      is_recurring        INTEGER NOT NULL DEFAULT 0,
      recurrence_pattern  TEXT
                            CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly')),
      reminder_minutes    INTEGER,
      subtasks_json       TEXT,
      due_date_offset_days INTEGER,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);

    -- ============================================================
    -- HOLIDAYS
    -- ============================================================

    CREATE TABLE IF NOT EXISTS holidays (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      year        INTEGER NOT NULL,
      UNIQUE(date, name)
    );

    CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
    CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);
  `)

  // Idempotent migrations
  try {
    _db.exec(`ALTER TABLE todos ADD COLUMN reminder_minutes INTEGER`)
  } catch {
    // Column already exists
  }

  try {
    _db.exec(`ALTER TABLE todos ADD COLUMN last_notification_sent TEXT`)
  } catch {
    // Column already exists
  }

  return _db
}

export const db = getDb()
