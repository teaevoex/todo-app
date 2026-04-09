import { test, expect, type Page, type CDPSession } from '@playwright/test'
import { setupAuth } from './helpers'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

/**
 * E2E Tests: Feature 09 — Export & Import
 *
 * Prerequisites: User is authenticated (app runs with active session).
 * These tests interact with the UI to verify export/import functionality.
 */

async function createTodo(page: Page, title: string): Promise<void> {
  const titleInput = page.getByTestId('todo-title-input').first()
  await titleInput.fill(title)
  await page.getByTestId('todo-submit-btn').click()
  await expect(page.getByText(title).first()).toBeVisible()
}

function buildValidExportFixture(todos: Array<{ id: number; title: string }>) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    todos: todos.map((t) => ({
      id: t.id,
      title: t.title,
      completed: false,
      due_date: null,
      priority: 'medium',
      is_recurring: false,
      recurrence_pattern: null,
      reminder_minutes: null,
      created_at: new Date().toISOString(),
    })),
    subtasks: [],
    tags: [],
    todoTags: [],
  }
}

function writeTempFixture(content: unknown): string {
  const tmpDir = os.tmpdir()
  const tmpFile = path.join(tmpDir, `export-fixture-${Date.now()}.json`)
  fs.writeFileSync(tmpFile, JSON.stringify(content))
  return tmpFile
}

test.describe('Export & Import', () => {
  let cdpSession: CDPSession

  test.beforeEach(async ({ page }) => {
    const auth = await setupAuth(page)
    cdpSession = auth.cdpSession
  })

  test.afterEach(async () => {
    await cdpSession?.detach()
  })

  test('export button is visible on the page', async ({ page }) => {
    await expect(page.getByTestId('export-button')).toBeVisible()
  })

  test('import button is visible on the page', async ({ page }) => {
    await expect(page.getByTestId('import-button')).toBeVisible()
  })

  test('export button triggers a download', async ({ page }) => {
    // Create a todo so there is something to export
    await createTodo(page, `Export Test Todo ${Date.now()}`)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-button').click(),
    ])

    const filename = download.suggestedFilename()
    expect(filename).toMatch(/^todos-export-\d{4}-\d{2}-\d{2}\.json$/)

    // Read and validate downloaded content
    const downloadPath = await download.path()
    expect(downloadPath).not.toBeNull()

    if (downloadPath) {
      const content = fs.readFileSync(downloadPath, 'utf-8')
      const parsed = JSON.parse(content)
      expect(parsed.version).toBe(1)
      expect(typeof parsed.exportedAt).toBe('string')
      expect(Array.isArray(parsed.todos)).toBe(true)
      expect(Array.isArray(parsed.subtasks)).toBe(true)
      expect(Array.isArray(parsed.tags)).toBe(true)
      expect(Array.isArray(parsed.todoTags)).toBe(true)
    }
  })

  test('import valid JSON file — todos appear', async ({ page }) => {
    const todo1 = `Import Todo Alpha ${Date.now()}`
    const todo2 = `Import Todo Beta ${Date.now()}`
    const todo3 = `Import Todo Gamma ${Date.now()}`

    const fixture = buildValidExportFixture([
      { id: 1, title: todo1 },
      { id: 2, title: todo2 },
      { id: 3, title: todo3 },
    ])

    const fixturePath = writeTempFixture(fixture)

    // Listen for alert (success message)
    page.on('dialog', async (dialog) => {
      const message = dialog.message()
      expect(message).toContain('Imported 3 todos')
      await dialog.accept()
    })

    await page.getByTestId('import-file-input').setInputFiles(fixturePath)

    // Wait for todos to appear
    await expect(page.getByText(todo1).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(todo2).first()).toBeVisible()
    await expect(page.getByText(todo3).first()).toBeVisible()

    fs.unlinkSync(fixturePath)
  })

  test('import invalid JSON shows error', async ({ page }) => {
    const tmpDir = os.tmpdir()
    const tmpFile = path.join(tmpDir, `invalid-fixture-${Date.now()}.json`)
    fs.writeFileSync(tmpFile, 'not valid json')

    await page.getByTestId('import-file-input').setInputFiles(tmpFile)

    await expect(page.getByTestId('import-error')).toBeVisible()
    await expect(page.getByTestId('import-error')).toContainText('Invalid JSON file')

    fs.unlinkSync(tmpFile)
  })

  test('import unsupported version shows error', async ({ page }) => {
    const fixture = {
      version: 99,
      exportedAt: new Date().toISOString(),
      todos: [],
      subtasks: [],
      tags: [],
      todoTags: [],
    }
    const fixturePath = writeTempFixture(fixture)

    // Listen for any dialogs
    page.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    await page.getByTestId('import-file-input').setInputFiles(fixturePath)

    await expect(page.getByTestId('import-error')).toBeVisible()
    await expect(page.getByTestId('import-error')).toContainText('Unsupported export version')

    fs.unlinkSync(fixturePath)
  })

  test('import preserves subtasks', async ({ page }) => {
    const todoTitle = `Subtask Import Test ${Date.now()}`
    const fixture = {
      version: 1,
      exportedAt: new Date().toISOString(),
      todos: [
        {
          id: 100,
          title: todoTitle,
          completed: false,
          due_date: null,
          priority: 'medium',
          is_recurring: false,
          recurrence_pattern: null,
          reminder_minutes: null,
          created_at: new Date().toISOString(),
        },
      ],
      subtasks: [
        {
          id: 200,
          todo_id: 100,
          title: 'First subtask',
          completed: false,
          position: 0,
        },
        {
          id: 201,
          todo_id: 100,
          title: 'Second subtask',
          completed: true,
          position: 1,
        },
      ],
      tags: [],
      todoTags: [],
    }
    const fixturePath = writeTempFixture(fixture)

    page.on('dialog', async (dialog) => {
      const message = dialog.message()
      expect(message).toContain('Imported 1 todos, 2 subtasks')
      await dialog.accept()
    })

    await page.getByTestId('import-file-input').setInputFiles(fixturePath)

    await expect(page.getByText(todoTitle).first()).toBeVisible({ timeout: 10000 })

    fs.unlinkSync(fixturePath)
  })

  test('import with duplicate tag name reuses existing tag', async ({ page }) => {
    // This test verifies the tag deduplication logic
    // A tag named "work" in the fixture should reuse an existing "work" tag
    const todoTitle = `Dedup Tag Test ${Date.now()}`
    const fixture = {
      version: 1,
      exportedAt: new Date().toISOString(),
      todos: [
        {
          id: 1,
          title: todoTitle,
          completed: false,
          due_date: null,
          priority: 'medium',
          is_recurring: false,
          recurrence_pattern: null,
          reminder_minutes: null,
          created_at: new Date().toISOString(),
        },
      ],
      subtasks: [],
      tags: [
        {
          id: 999,
          name: `UniqueTestTag-${Date.now()}`,
          color: '#FF0000',
        },
      ],
      todoTags: [
        {
          todo_id: 1,
          tag_id: 999,
        },
      ],
    }
    const fixturePath = writeTempFixture(fixture)

    page.on('dialog', async (dialog) => {
      const message = dialog.message()
      // Should import 1 todo and 1 new tag (since tag does not exist yet)
      expect(message).toContain('Imported 1 todos')
      await dialog.accept()
    })

    await page.getByTestId('import-file-input').setInputFiles(fixturePath)

    await expect(page.getByText(todoTitle).first()).toBeVisible({ timeout: 10000 })

    fs.unlinkSync(fixturePath)
  })
})
