import Database from 'better-sqlite3';
import { SignJWT } from 'jose';
import { expect, Page } from '@playwright/test';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'todos.db'));

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'local-dev-secret-change-me-2026-04-08');

export async function sessionToken(userId: number, username: string) {
  return new SignJWT({ userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export function resetDatabase() {
  db.exec(`
    DELETE FROM authenticators;
    DELETE FROM todo_tags;
    DELETE FROM subtasks;
    DELETE FROM todos;
    DELETE FROM tags;
    DELETE FROM templates;
    DELETE FROM users;
    DELETE FROM holidays;
  `);
}

export function seedHoliday(date: string, name: string) {
  db.prepare('INSERT INTO holidays (date, name) VALUES (?, ?)').run(date, name);
}

export function createUser(username: string) {
  const info = db.prepare('INSERT INTO users (username) VALUES (?)').run(username);
  return Number(info.lastInsertRowid);
}

export async function loginAs(page: Page, username = 'tester') {
  const userId = createUser(username);
  const token = await sessionToken(userId, username);
  await page.context().addCookies([
    {
      name: 'todo-app-session',
      value: token,
      url: 'http://127.0.0.1:3000',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  return { userId, username };
}

export function insertTodo(
  userId: number,
  values: Partial<{
    title: string;
    completed: number;
    priority: 'high' | 'medium' | 'low';
    due_date: string | null;
    is_recurring: number;
    recurrence_pattern: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
    reminder_minutes: number | null;
  }> = {},
) {
  const info = db
    .prepare(
      `INSERT INTO todos (user_id, title, completed, priority, due_date, is_recurring, recurrence_pattern, reminder_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      values.title ?? 'Sample Todo',
      values.completed ?? 0,
      values.priority ?? 'medium',
      values.due_date ?? null,
      values.is_recurring ?? 0,
      values.recurrence_pattern ?? null,
      values.reminder_minutes ?? null,
    );
  return Number(info.lastInsertRowid);
}

export function insertSubtask(todoId: number, title: string, completed = 0) {
  return db.prepare('INSERT INTO subtasks (todo_id, title, completed, position) VALUES (?, ?, ?, ?)').run(todoId, title, completed, 0);
}

export function insertTag(userId: number, name: string, color = '#3B82F6') {
  const info = db.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)').run(userId, name, color);
  return Number(info.lastInsertRowid);
}

export function attachTag(todoId: number, tagId: number) {
  db.prepare('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
}

export function insertTemplate(userId: number, name: string, titleTemplate: string) {
  const info = db
    .prepare(
      `INSERT INTO templates (user_id, name, title_template, priority, is_recurring, subtasks_json)
       VALUES (?, ?, ?, 'medium', 0, '[]')`,
    )
    .run(userId, name, titleTemplate);
  return Number(info.lastInsertRowid);
}

export async function gotoApp(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => document.body.dataset.todoAppLoaded === 'true');
  await expect(page.getByText('Create Todo')).toBeVisible();
}
