import { test, expect } from '@playwright/test'
import { registerUser, createTodo, uniqueUsername } from './helpers'

test.describe('Feature 09: Export & Import', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, uniqueUsername())
  })

  test('should have export button visible', async ({ page }) => {
    await expect(page.locator('button:has-text("Export")')).toBeVisible()
  })

  test('should have import button visible', async ({ page }) => {
    await expect(page.locator('button:has-text("Import")')).toBeVisible()
  })

  test('should export todos as JSON', async ({ page }) => {
    await createTodo(page, 'Export test todo')

    // Listen for the download event
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export")'),
    ])

    // Verify download filename
    expect(download.suggestedFilename()).toMatch(/todos-export-.*\.json/)

    // Save and verify content
    const path = await download.path()
    if (path) {
      const fs = await import('fs')
      const content = JSON.parse(fs.readFileSync(path, 'utf-8'))
      expect(content.version).toBe(1)
      expect(content.todos).toBeDefined()
      expect(Array.isArray(content.todos)).toBe(true)
      expect(content.todos.length).toBeGreaterThanOrEqual(1)
    }
  })

  test('should import valid JSON file', async ({ page }) => {
    const importData = JSON.stringify({
      version: 1,
      exported_at: new Date().toISOString(),
      todos: [
        {
          title: 'Imported todo',
          completed: false,
          priority: 'high',
          due_date: null,
          is_recurring: false,
          recurrence_pattern: null,
          reminder_minutes: null,
          subtasks: [],
          tags: [],
        },
      ],
      tags: [],
    })

    // Create a temporary file for import
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(importData),
    })

    await page.waitForTimeout(1000)

    // Should show success message
    await expect(page.locator('text=/Successfully imported/i')).toBeVisible()
    // The imported todo should be visible
    await expect(page.locator('[data-testid="todo-title"]', { hasText: 'Imported todo' })).toBeVisible()
  })

  test('should show error for invalid import format', async ({ page }) => {
    const invalidData = JSON.stringify({ invalid: true })

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from(invalidData),
    })

    await page.waitForTimeout(1000)

    // Should show error
    await expect(page.locator('text=/Invalid|error|failed/i')).toBeVisible()
  })
})
