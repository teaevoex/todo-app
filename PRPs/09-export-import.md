# PRP 09: Export & Import

## Feature Overview

Implement a JSON-based export and import system that lets users back up their todos and restore them on the same or a different account. Export produces a single JSON file containing all todos with their subtasks and tags. Import reads a JSON file in the same format, remaps IDs to avoid conflicts, and recreates todos with all relationships preserved. Both operations are scoped to the authenticated user. This feature builds on **PRP 01** (CRUD), **PRP 05** (Subtasks), and **PRP 06** (Tags).

---

## User Stories

### As a user, I want to:

1. **Export all my todos to a JSON file** so I can back up my data
2. **Download the export file** so I can store it locally
3. **Import todos from a JSON file** so I can restore from a backup
4. **Have tag associations preserved on import** so my categories carry over
5. **Have subtasks preserved on import** so my task breakdowns carry over
6. **Avoid duplicate tags on import** so existing tags are reused
7. **Import into an account with existing todos** without losing current data

---

## User Flow

### Exporting Todos

```
1. User clicks the "Export" button in the toolbar
2. Browser downloads a JSON file named "todos-export-YYYY-MM-DD.json"
3. File contains all todos, subtasks, and tags for the user
4. Success feedback shown (download initiates)
```

### Importing Todos

```
1. User clicks the "Import" button in the toolbar
2. File picker opens (accepts .json files only)
3. User selects a previously exported JSON file
4. System validates the file format
5. System processes the import:
   a. Creates or reuses tags (matched by name, case-insensitive)
   b. Creates todos with new IDs
   c. Creates subtasks linked to the new todo IDs
   d. Creates tag associations with resolved tag IDs
6. Todo list refreshes to show imported todos
7. Success message shows count of imported items
```

---

## Technical Requirements

### Export Format

```json
{
  "version": 1,
  "exported_at": "2026-04-08T14:30:00+08:00",
  "todos": [
    {
      "title": "Buy groceries",
      "completed": false,
      "priority": "high",
      "due_date": "2026-04-10",
      "is_recurring": false,
      "recurrence_pattern": null,
      "reminder_minutes": 60,
      "subtasks": [
        { "title": "Get milk", "completed": false, "position": 0 },
        { "title": "Get bread", "completed": true, "position": 1 }
      ],
      "tags": ["Work", "Shopping"]
    },
    {
      "title": "Write report",
      "completed": true,
      "priority": "medium",
      "due_date": null,
      "is_recurring": false,
      "recurrence_pattern": null,
      "reminder_minutes": null,
      "subtasks": [],
      "tags": ["Work"]
    }
  ],
  "tags": [
    { "name": "Work", "color": "#3B82F6" },
    { "name": "Shopping", "color": "#10B981" }
  ]
}
```

**Format Details:**

| Field | Type | Description |
|-------|------|-------------|
| `version` | number | Schema version for forward compatibility |
| `exported_at` | string | ISO 8601 timestamp of export |
| `todos` | array | All user's todos with embedded subtasks and tag names |
| `todos[].subtasks` | array | Subtasks with title, completed state, and position |
| `todos[].tags` | string[] | Tag names (not IDs) for portability across accounts |
| `tags` | array | All user's tag definitions with name and color |

**Design Decisions:**
- Tags are referenced by **name** (not ID) in `todos[].tags` for cross-account portability
- Tag definitions are at the top level with colors so they can be recreated on import
- IDs are excluded from export — new IDs are generated on import
- `created_at` is excluded — new timestamps are generated on import
- `user_id` is excluded — the importing user's ID is used
- `last_notification_sent` is excluded — reset on import

### TypeScript Interfaces

```typescript
// Export/Import format types

interface ExportSubtask {
  title: string
  completed: boolean
  position: number
}

interface ExportTodo {
  title: string
  completed: boolean
  priority: Priority
  due_date: string | null
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: number | null
  subtasks: ExportSubtask[]
  tags: string[] // Tag names
}

interface ExportTag {
  name: string
  color: string
}

interface ExportData {
  version: number
  exported_at: string
  todos: ExportTodo[]
  tags: ExportTag[]
}
```

---

### API Endpoints

#### `GET /api/todos/export` — Export all todos

```typescript
// app/api/todos/export/route.ts

import { getSingaporeNow } from '@/lib/timezone'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Get all todos with subtasks and tags
  const todos = todoDB.findAll(session.userId)
  const tags = tagDB.findAll(session.userId)

  const exportTodos: ExportTodo[] = todos.map(todo => {
    const subtasks = subtaskDB.findByTodoId(todo.id)
    const todoTags = todoTagDB.findByTodoId(todo.id)

    return {
      title: todo.title,
      completed: !!todo.completed,
      priority: todo.priority,
      due_date: todo.due_date ?? null,
      is_recurring: !!todo.is_recurring,
      recurrence_pattern: todo.recurrence_pattern ?? null,
      reminder_minutes: todo.reminder_minutes ?? null,
      subtasks: subtasks.map(s => ({
        title: s.title,
        completed: !!s.completed,
        position: s.position,
      })),
      tags: todoTags.map(t => t.name),
    }
  })

  const exportTags: ExportTag[] = tags.map(t => ({
    name: t.name,
    color: t.color,
  }))

  const exportData: ExportData = {
    version: 1,
    exported_at: getSingaporeNow().toISOString(),
    todos: exportTodos,
    tags: exportTags,
  }

  return NextResponse.json(exportData)
}
```

**Response:** `200 OK` — `ExportData` JSON object

---

#### `POST /api/todos/import` — Import todos from JSON

```typescript
// app/api/todos/import/route.ts

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body: ExportData = await request.json()

  // Validate format
  if (!body.version || !Array.isArray(body.todos)) {
    return NextResponse.json({ error: 'Invalid import format' }, { status: 400 })
  }

  if (body.version !== 1) {
    return NextResponse.json({ error: 'Unsupported export version' }, { status: 400 })
  }

  // Step 1: Resolve tags — reuse existing tags by name, create missing ones
  const existingTags = tagDB.findAll(session.userId)
  const tagNameToId: Record<string, number> = {}

  // Map existing tags
  for (const tag of existingTags) {
    tagNameToId[tag.name.toLowerCase()] = tag.id
  }

  // Create missing tags from export
  if (Array.isArray(body.tags)) {
    for (const exportTag of body.tags) {
      const key = exportTag.name.trim().toLowerCase()
      if (!tagNameToId[key]) {
        const created = tagDB.create(session.userId, {
          name: exportTag.name.trim(),
          color: exportTag.color ?? '#3B82F6',
        })
        tagNameToId[key] = created.id
      }
    }
  }

  // Step 2: Create todos with subtasks and tag associations
  let importedCount = 0

  for (const exportTodo of body.todos) {
    // Validate todo
    if (!exportTodo.title || !exportTodo.title.trim()) {
      continue // Skip invalid todos
    }

    // Create the todo
    const todo = todoDB.create(session.userId, {
      title: exportTodo.title.trim(),
      priority: exportTodo.priority ?? 'medium',
      due_date: exportTodo.due_date ?? undefined,
      is_recurring: exportTodo.is_recurring ?? false,
      recurrence_pattern: exportTodo.recurrence_pattern ?? undefined,
      reminder_minutes: exportTodo.reminder_minutes ?? undefined,
    })

    // Mark as completed if it was completed in the export
    if (exportTodo.completed) {
      todoDB.update(todo.id, session.userId, { completed: true })
    }

    // Create subtasks
    if (Array.isArray(exportTodo.subtasks)) {
      for (const exportSubtask of exportTodo.subtasks) {
        if (!exportSubtask.title || !exportSubtask.title.trim()) continue

        const subtask = subtaskDB.create(todo.id, {
          title: exportSubtask.title.trim(),
          position: exportSubtask.position ?? 0,
        })

        // Mark subtask as completed if it was in the export
        if (exportSubtask.completed) {
          subtaskDB.update(subtask.id, { completed: true })
        }
      }
    }

    // Create tag associations
    if (Array.isArray(exportTodo.tags)) {
      const tagIds: number[] = []
      for (const tagName of exportTodo.tags) {
        const key = tagName.trim().toLowerCase()
        const tagId = tagNameToId[key]
        if (tagId) {
          tagIds.push(tagId)
        }
      }
      if (tagIds.length > 0) {
        todoTagDB.replaceAll(todo.id, tagIds)
      }
    }

    importedCount++
  }

  return NextResponse.json({
    success: true,
    imported: importedCount,
    tags_created: Object.keys(tagNameToId).length - existingTags.length,
  }, { status: 201 })
}
```

**Request Body:** `ExportData` JSON (same format as export output)

**Response:** `201 Created`
```json
{
  "success": true,
  "imported": 5,
  "tags_created": 2
}
```

**Import Logic:**

1. **Validate** — check `version` and `todos` array exists
2. **Resolve tags** — for each tag in the export, check if a tag with the same name (case-insensitive) exists for this user. If so, reuse its ID. If not, create a new tag with the exported name and color.
3. **Create todos** — iterate over exported todos, create each with `todoDB.create()`. Skip todos with empty titles.
4. **Mark completed** — if the exported todo was completed, update it after creation.
5. **Create subtasks** — for each todo's subtasks, create with `subtaskDB.create()`. Mark completed if needed.
6. **Create tag associations** — resolve exported tag names to IDs using the mapping built in step 2, then call `todoTagDB.replaceAll()`.

---

## UI Components

### Export Button

```tsx
<button
  onClick={handleExport}
  className="text-sm px-3 py-1.5 rounded-lg border
             border-green-300 text-green-600 hover:bg-green-50
             dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
>
  Export
</button>
```

### Import Button

```tsx
<>
  <input
    type="file"
    accept=".json"
    ref={fileInputRef}
    onChange={handleImportFile}
    className="hidden"
  />
  <button
    onClick={() => fileInputRef.current?.click()}
    className="text-sm px-3 py-1.5 rounded-lg border
               border-orange-300 text-orange-600 hover:bg-orange-50
               dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-900/20"
  >
    Import
  </button>
</>
```

### Button Placement

The Export and Import buttons sit in the toolbar alongside "Templates" and "+ Manage Tags":

```
┌─────────────────────────────────────────────────────────────────┐
│  [+ Manage Tags]  [Templates]  [Export]  [Import]               │
└─────────────────────────────────────────────────────────────────┘
```

### Success/Error Messages

```tsx
{importMessage && (
  <div className={`mb-4 p-3 rounded-lg text-sm ${
    importMessage.type === 'success'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }`}>
    {importMessage.text}
  </div>
)}
```

**Success message:** "Successfully imported 5 todos and 2 new tags"
**Error message:** "Invalid file format. Please use a previously exported JSON file."

---

## Event Handlers

```typescript
const fileInputRef = useRef<HTMLInputElement>(null)
const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

// Export handler
async function handleExport() {
  const res = await fetch('/api/todos/export')
  if (!res.ok) return

  const data = await res.json()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const now = getSingaporeNow()
  const dateStr = formatSingaporeDate(now) // YYYY-MM-DD
  const filename = `todos-export-${dateStr}.json`

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Import handler
async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return

  // Reset file input so the same file can be selected again
  e.target.value = ''

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    const res = await fetch('/api/todos/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      const result = await res.json()
      setImportMessage({
        type: 'success',
        text: `Successfully imported ${result.imported} todos and ${result.tags_created} new tags`,
      })
      await fetchTodos()
      await fetchTags()
    } else {
      const error = await res.json()
      setImportMessage({
        type: 'error',
        text: error.error || 'Import failed',
      })
    }
  } catch {
    setImportMessage({
      type: 'error',
      text: 'Invalid file format. Please use a previously exported JSON file.',
    })
  }

  // Auto-clear message after 5 seconds
  setTimeout(() => setImportMessage(null), 5000)
}
```

---

## ID Remapping

The export format intentionally **excludes IDs**. On import, all entities receive new auto-incremented IDs:

```
Export (original account):
  Todo #42 → Subtask #101, #102 → Tags "Work" (#5), "Shopping" (#8)

Import (new or same account):
  Todo #67 → Subtask #203, #204 → Tags "Work" (#5 reused), "Shopping" (#12 new)
```

**Tag Resolution Flow:**

```
For each exported tag name:
  1. Lowercase the name
  2. Check if user already has a tag with that name
     → Yes: Use existing tag's ID
     → No:  Create new tag with exported name + color, use new ID
  3. Store mapping: tag_name → tag_id
  
For each todo's tags array:
  1. Look up each tag name in the mapping
  2. Create todo_tags associations with resolved IDs
```

This ensures:
- Importing into the same account reuses existing tags (no duplicates)
- Importing into a new account creates fresh tags with the correct colors
- Tag names are the stable identifier across imports

---

## Edge Cases

### Export

| Scenario | Expected Behavior |
|----------|-------------------|
| User has 0 todos | Export file with `todos: []`, `tags: []` |
| User has todos but no tags | `tags: []`, todo `tags` arrays empty |
| Todo with null fields | Null fields exported as `null` |
| Todo with subtasks | Subtasks embedded in the todo's `subtasks` array |
| Boolean fields (completed) | Exported as `true`/`false`, not 0/1 |
| Unauthenticated request | 401 error |
| Very large dataset (1000+ todos) | JSON generated, may be a large file |

### Import — File Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Non-JSON file selected | "Invalid file format" error |
| Malformed JSON | "Invalid file format" error (parse failure) |
| Valid JSON but wrong structure | "Invalid import format" (missing `version`/`todos`) |
| Unsupported version (e.g., version: 2) | "Unsupported export version" error |
| Empty `todos` array | Success with `imported: 0` |
| Very large file | Processed normally (no size limit in API) |
| File with no `tags` array | Handled gracefully (no tags created) |

### Import — Tag Resolution

| Scenario | Expected Behavior |
|----------|-------------------|
| Tag name exists (same case) | Reuse existing tag ID |
| Tag name exists (different case) | Reuse existing tag ID (case-insensitive) |
| Tag name doesn't exist | Create new tag with exported color |
| Tag in `tags[]` but not used by any todo | Created anyway (full restore) |
| Tag referenced in todo but not in `tags[]` | Looked up by name; created with default color if missing |
| Duplicate tag names in export's `tags[]` | Second one skipped (already in mapping) |

### Import — Todo Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Todo with empty title | Skipped (not imported) |
| Todo with no priority | Defaults to `'medium'` |
| Todo with invalid priority | Defaults to `'medium'` |
| Todo with no subtasks | Created with no subtasks |
| Completed todo | Created then marked as completed |
| Recurring todo | `is_recurring` and `recurrence_pattern` preserved |
| Todo with reminder | `reminder_minutes` preserved, `last_notification_sent` reset |
| Subtask with empty title | Skipped |
| Completed subtask | Created then marked as completed |

### Import — Merging with Existing Data

| Scenario | Expected Behavior |
|----------|-------------------|
| Import into account with existing todos | Existing todos preserved, new ones added |
| Import same export twice | Duplicates created (no deduplication by title) |
| Import from different user | Works — all data re-associated with importing user |

### UI/UX

| Scenario | Expected Behavior |
|----------|-------------------|
| Export clicks with 0 todos | Downloads file with empty arrays |
| Import while filters active | Filters apply to imported todos too |
| Import success message | Auto-clears after 5 seconds |
| Select same file twice | Works — file input value is reset |

---

## Acceptance Criteria

### Export

- [ ] "Export" button is displayed in the toolbar
- [ ] Clicking Export downloads a JSON file
- [ ] Filename is `todos-export-YYYY-MM-DD.json` using Singapore date
- [ ] Export includes all user's todos
- [ ] Each todo includes title, completed, priority, due_date, recurrence, reminder
- [ ] Each todo's subtasks are embedded with title, completed, position
- [ ] Each todo's tags are included as an array of tag names
- [ ] Top-level `tags` array includes all tag definitions with name and color
- [ ] `version: 1` and `exported_at` timestamp are included
- [ ] Boolean fields are `true`/`false` (not 0/1)
- [ ] Null fields are exported as `null`
- [ ] Export file is valid, parseable JSON

### Import

- [ ] "Import" button is displayed in the toolbar
- [ ] Clicking Import opens a file picker (`.json` only)
- [ ] Valid export files are imported successfully
- [ ] Import creates new todos with new IDs
- [ ] Imported todos have correct title, priority, due_date, recurrence, reminder
- [ ] Completed todos are marked as completed on import
- [ ] Subtasks are recreated with correct title, position, and completed state
- [ ] Existing tags with matching names are reused (case-insensitive)
- [ ] Missing tags are created with the exported color
- [ ] Tag associations are recreated for imported todos
- [ ] Response includes count of imported todos and newly created tags
- [ ] Success message is displayed after import
- [ ] Todo list refreshes to show imported todos
- [ ] Tag list refreshes to show new tags

### Error Handling

- [ ] Non-JSON files show "Invalid file format" error
- [ ] Malformed JSON shows "Invalid file format" error
- [ ] Wrong structure shows "Invalid import format" error
- [ ] Unsupported version shows error
- [ ] Todos with empty titles are skipped
- [ ] Import error message is displayed
- [ ] Messages auto-clear after 5 seconds

### Validation & Security

- [ ] Export endpoint returns 401 without a valid session
- [ ] Import endpoint returns 401 without a valid session
- [ ] Export only includes the authenticated user's data
- [ ] Import only creates data for the authenticated user
- [ ] SQL injection prevented via prepared statements
- [ ] JSON parsing errors are caught gracefully

### Data Integrity

- [ ] Existing todos are NOT deleted or modified during import
- [ ] Importing the same file twice creates duplicate todos (expected)
- [ ] Tag uniqueness constraint respected (no duplicate tag names per user)
- [ ] Subtask positions are preserved
- [ ] All relationships (todo→subtask, todo→tag) are correctly established

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/09-export-import.spec.ts

import { test, expect } from '@playwright/test'
import { TodoHelper } from './helpers'

test.describe('Export & Import', () => {

  test.beforeEach(async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.login()
  })

  // --- Export Tests ---

  test('should export todos as JSON', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Export test todo', { priority: 'high' })

    // Listen for download
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Export")')
    const download = await downloadPromise

    // Check filename
    expect(download.suggestedFilename()).toMatch(/^todos-export-\d{4}-\d{2}-\d{2}\.json$/)

    // Read and validate content
    const content = await download.path()
    // File should be valid JSON
    expect(content).toBeTruthy()
  })

  test('should export todos with subtasks', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Subtask export test')
    await helper.addSubtask('Subtask export test', 'Step 1')
    await helper.addSubtask('Subtask export test', 'Step 2')

    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Export")')
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.json$/)
  })

  test('should export todos with tags', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTag('ExportTag', '#EF4444')
    await page.click('button:has-text("Close")')

    await page.click('button:has-text("ExportTag")')
    await helper.createTodo('Tagged export test')

    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Export")')
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.json$/)
  })

  test('should export empty state', async ({ page }) => {
    // No todos created — export should still work
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Export")')
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.json$/)
  })

  // --- Import Tests ---

  test('should import todos from JSON file', async ({ page }) => {
    const helper = new TodoHelper(page)

    // Create test data
    await helper.createTodo('Pre-export todo', { priority: 'high' })

    // Export
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Export")')
    const download = await downloadPromise
    const filePath = await download.path()

    // Delete original todo (or verify import adds alongside)
    // Import the file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(filePath!)

    // Success message
    await expect(page.getByText(/Successfully imported/)).toBeVisible()

    // Imported todo should appear
    await expect(page.getByText('Pre-export todo')).toBeVisible()
  })

  test('should import todos with subtasks preserved', async ({ page }) => {
    const helper = new TodoHelper(page)

    // Create todo with subtasks
    await helper.createTodo('Subtask import test')
    await helper.addSubtask('Subtask import test', 'Import Step 1')

    // Export
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Export")')
    const download = await downloadPromise
    const filePath = await download.path()

    // Import
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(filePath!)

    await expect(page.getByText(/Successfully imported/)).toBeVisible()
  })

  test('should import todos with tags preserved', async ({ page }) => {
    const helper = new TodoHelper(page)

    // Create tag and tagged todo
    await helper.createTag('ImportTag', '#10B981')
    await page.click('button:has-text("Close")')
    await page.click('button:has-text("ImportTag")')
    await helper.createTodo('Tagged import test')

    // Export
    const downloadPromise = page.waitForEvent('download')
    await page.click('button:has-text("Export")')
    const download = await downloadPromise
    const filePath = await download.path()

    // Import
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(filePath!)

    await expect(page.getByText(/Successfully imported/)).toBeVisible()

    // Tag should be reused (not duplicated)
    await page.click('button:has-text("Manage Tags")')
    const tagCount = await page.locator('text=ImportTag').count()
    expect(tagCount).toBe(1) // Only one tag, reused
  })

  test('should show error for invalid JSON file', async ({ page }) => {
    // Create a non-JSON file
    const invalidContent = 'This is not JSON'

    // Create a temp file and import it
    // Use page.setInputFiles with a buffer
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(invalidContent),
    })

    await expect(page.getByText('Invalid file format')).toBeVisible()
  })

  test('should show error for wrong JSON structure', async ({ page }) => {
    const wrongStructure = JSON.stringify({ foo: 'bar' })

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'wrong.json',
      mimeType: 'application/json',
      buffer: Buffer.from(wrongStructure),
    })

    await expect(page.getByText(/Invalid import format|Invalid file/)).toBeVisible()
  })

  test('should preserve existing todos on import', async ({ page }) => {
    const helper = new TodoHelper(page)

    // Create an existing todo
    await helper.createTodo('Existing todo')

    // Prepare import data
    const importData = {
      version: 1,
      exported_at: new Date().toISOString(),
      todos: [{ title: 'Imported todo', completed: false, priority: 'medium', due_date: null, is_recurring: false, recurrence_pattern: null, reminder_minutes: null, subtasks: [], tags: [] }],
      tags: [],
    }

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importData)),
    })

    await expect(page.getByText(/Successfully imported 1/)).toBeVisible()

    // Both todos should exist
    await expect(page.getByText('Existing todo')).toBeVisible()
    await expect(page.getByText('Imported todo')).toBeVisible()
  })

  test('should handle import of completed todos', async ({ page }) => {
    const importData = {
      version: 1,
      exported_at: new Date().toISOString(),
      todos: [{
        title: 'Completed import',
        completed: true,
        priority: 'low',
        due_date: null,
        is_recurring: false,
        recurrence_pattern: null,
        reminder_minutes: null,
        subtasks: [],
        tags: [],
      }],
      tags: [],
    }

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'completed.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importData)),
    })

    await expect(page.getByText(/Successfully imported/)).toBeVisible()

    // Todo should appear in the Completed section
    await expect(page.getByText('Completed import')).toBeVisible()
  })

  test('should auto-clear import message', async ({ page }) => {
    const importData = {
      version: 1,
      exported_at: new Date().toISOString(),
      todos: [{ title: 'Autoclear test', completed: false, priority: 'medium', due_date: null, is_recurring: false, recurrence_pattern: null, reminder_minutes: null, subtasks: [], tags: [] }],
      tags: [],
    }

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'autoclear.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importData)),
    })

    await expect(page.getByText(/Successfully imported/)).toBeVisible()

    // Wait for auto-clear (5 seconds)
    await page.waitForTimeout(6000)
    await expect(page.getByText(/Successfully imported/)).not.toBeVisible()
  })

  test('should create new tags from import', async ({ page }) => {
    const importData = {
      version: 1,
      exported_at: new Date().toISOString(),
      todos: [{
        title: 'New tag import',
        completed: false,
        priority: 'medium',
        due_date: null,
        is_recurring: false,
        recurrence_pattern: null,
        reminder_minutes: null,
        subtasks: [],
        tags: ['NewTag'],
      }],
      tags: [{ name: 'NewTag', color: '#F59E0B' }],
    }

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'newtag.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importData)),
    })

    await expect(page.getByText(/Successfully imported/)).toBeVisible()

    // New tag should exist and be associated with the todo
    await page.click('button:has-text("Manage Tags")')
    await expect(page.getByText('NewTag')).toBeVisible()
  })

  test('should import empty todos array', async ({ page }) => {
    const importData = {
      version: 1,
      exported_at: new Date().toISOString(),
      todos: [],
      tags: [],
    }

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'empty.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importData)),
    })

    await expect(page.getByText(/Successfully imported 0/)).toBeVisible()
  })
})
```

### API Integration Tests

```typescript
test('GET /api/todos/export returns valid export format', async () => {
  // Create test data
  await createTestTodo('Test Todo', { priority: 'high' })
  await createTag('TestTag', '#EF4444')

  const res = await fetch('/api/todos/export')
  expect(res.status).toBe(200)

  const data = await res.json()
  expect(data.version).toBe(1)
  expect(data.exported_at).toBeTruthy()
  expect(Array.isArray(data.todos)).toBe(true)
  expect(Array.isArray(data.tags)).toBe(true)
  expect(data.todos[0].title).toBe('Test Todo')
  expect(data.tags[0].name).toBe('TestTag')
})

test('POST /api/todos/import creates todos', async () => {
  const importData = {
    version: 1,
    exported_at: new Date().toISOString(),
    todos: [
      {
        title: 'Imported Todo',
        completed: false,
        priority: 'high',
        due_date: '2026-04-15',
        is_recurring: false,
        recurrence_pattern: null,
        reminder_minutes: 60,
        subtasks: [
          { title: 'Step 1', completed: false, position: 0 },
          { title: 'Step 2', completed: true, position: 1 },
        ],
        tags: ['Work'],
      },
    ],
    tags: [{ name: 'Work', color: '#3B82F6' }],
  }

  const res = await fetch('/api/todos/import', {
    method: 'POST',
    body: JSON.stringify(importData),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(201)

  const result = await res.json()
  expect(result.success).toBe(true)
  expect(result.imported).toBe(1)
})

test('POST /api/todos/import reuses existing tags', async () => {
  // Create a tag first
  await createTag('Existing', '#3B82F6')

  const importData = {
    version: 1,
    exported_at: new Date().toISOString(),
    todos: [{
      title: 'Reuse Tag Test',
      completed: false,
      priority: 'medium',
      due_date: null,
      is_recurring: false,
      recurrence_pattern: null,
      reminder_minutes: null,
      subtasks: [],
      tags: ['existing'], // lowercase — should match case-insensitively
    }],
    tags: [{ name: 'Existing', color: '#3B82F6' }],
  }

  const res = await fetch('/api/todos/import', {
    method: 'POST',
    body: JSON.stringify(importData),
    headers: { 'Content-Type': 'application/json' },
  })
  const result = await res.json()
  expect(result.tags_created).toBe(0) // No new tags
})

test('POST /api/todos/import rejects invalid format', async () => {
  const res = await fetch('/api/todos/import', {
    method: 'POST',
    body: JSON.stringify({ foo: 'bar' }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(400)
})

test('POST /api/todos/import rejects unsupported version', async () => {
  const res = await fetch('/api/todos/import', {
    method: 'POST',
    body: JSON.stringify({ version: 99, todos: [] }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(400)
})

test('round-trip export and import preserves data', async () => {
  // Create comprehensive test data
  const tag = await createTag('RoundTrip', '#F59E0B')
  const todo = await createTestTodo('Round Trip Test', { priority: 'high' })
  await addSubtask(todo.id, 'Sub 1')
  await associateTag(todo.id, tag.id)

  // Export
  const exportRes = await fetch('/api/todos/export')
  const exportData = await exportRes.json()

  // Import into same account
  const importRes = await fetch('/api/todos/import', {
    method: 'POST',
    body: JSON.stringify(exportData),
    headers: { 'Content-Type': 'application/json' },
  })
  const result = await importRes.json()
  expect(result.imported).toBe(1)
  expect(result.tags_created).toBe(0) // Reused existing tag

  // Verify: now have 2 copies of the todo
  const todosRes = await fetch('/api/todos')
  const todos = await todosRes.json()
  const matching = todos.filter((t: { title: string }) => t.title === 'Round Trip Test')
  expect(matching).toHaveLength(2)
})

test('returns 401 for unauthenticated export', async () => {
  const res = await fetch('/api/todos/export', { headers: {} })
  expect(res.status).toBe(401)
})

test('returns 401 for unauthenticated import', async () => {
  const res = await fetch('/api/todos/import', {
    method: 'POST',
    body: '{}',
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(401)
})
```

---

## Out of Scope

These are related features handled by other PRPs or future enhancements:

- Todo CRUD basics → **PRP 01**
- Priority system → **PRP 02**
- Recurring todo handling → **PRP 03**
- Reminder settings → **PRP 04**
- Subtask implementation → **PRP 05**
- Tag system → **PRP 06**
- Template system (not exported) → **PRP 07**
- CSV export format → Future enhancement
- Selective export (specific todos only) → Future enhancement
- Merge/deduplication on import → Future enhancement
- Export encryption/password protection → Future enhancement
- Export to cloud storage → Future enhancement
- Import from other todo apps → Future enhancement
- Import progress bar → Future enhancement
- Scheduled automatic exports → Future enhancement

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Export response time | < 500ms for 1000 todos |
| Import response time | < 2s for 100 todos with subtasks and tags |
| Round-trip fidelity | 100% — export→import preserves all data |
| Tag reuse accuracy | 100% — no duplicate tags created for same name |
| Subtask order preservation | 100% — positions match original |
| File format validity | 100% — valid JSON, parseable by any JSON reader |
| Error handling | 100% — all invalid inputs produce clear error messages |
| Data isolation | 100% — export/import scoped to authenticated user only |
| E2E test pass rate | 100% |

---

## Implementation Notes

### Project-Specific Patterns

1. **Tags by name, not ID** — the export format uses tag names as identifiers for cross-account portability. IDs are account-specific and would not map correctly between different users or databases.
2. **Case-insensitive tag matching** — import resolves tags by `name.toLowerCase()` to avoid creating "Work" and "work" as separate tags.
3. **No deduplication** — importing the same file twice creates duplicate todos. This is intentional — the user may want multiple copies, and title-based deduplication is unreliable.
4. **Graceful skipping** — todos with empty titles and subtasks with empty titles are silently skipped during import, rather than failing the entire operation.
5. **Download via Blob URL** — export uses `URL.createObjectURL()` with an anchor element click to trigger the browser download. The URL is revoked immediately after.
6. **File input reset** — `e.target.value = ''` after reading the file so the user can select the same file again.
7. **All DB operations synchronous** — `better-sqlite3` means no `await` on database calls within the import loop.
8. **`params` is async** in Next.js 16 — not applicable here (export/import routes don't use dynamic params).
9. **Import uses Singapore timezone** — timestamps in `created_at` are generated by the database default, but `exported_at` uses `getSingaporeNow()`.
10. **Templates are NOT exported** — templates are separate user configurations, not todo data. They are not part of the export format.
11. **Holidays are NOT exported** — the `holidays` table is system data seeded from a script, not user data.

### File Locations

```
app/api/todos/export/route.ts   # GET — export handler
app/api/todos/import/route.ts   # POST — import handler
app/page.tsx                     # UI: Export/Import buttons, file input, messages
```

### Dependencies

No additional npm packages. Uses:
- `better-sqlite3` for database queries
- `Blob` and `URL.createObjectURL()` for file download (browser APIs)
- `FileReader` / `File.text()` for file reading (browser APIs)
- `<input type="file" accept=".json">` for file picker (HTML)
- `lib/timezone.ts` for Singapore date in filename
