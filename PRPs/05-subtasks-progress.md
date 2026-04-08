# PRP 05: Subtasks & Progress Tracking

## Feature Overview

Implement subtasks (checklists) within todos, with real-time visual progress tracking. Each todo can have unlimited subtasks that are individually toggled, added, and deleted. A progress bar and text indicator (`X/Y subtasks`) show completion percentage. Subtasks are cascade-deleted when the parent todo is removed. Subtask titles are included in the search index. This feature builds on **PRP 01** (CRUD) and interacts with **PRP 03** (Recurring — subtasks are NOT inherited) and **PRP 07** (Templates — subtasks serialized as JSON).

---

## User Stories

### As a user, I want to:

1. **Add subtasks to any todo** so I can break down complex work into smaller steps
2. **Toggle subtask completion** independently so I can check off items as I go
3. **See a progress bar** on todos with subtasks so I know how far along I am
4. **See a text indicator** (`X/Y subtasks`) so I know the exact completion count
5. **Delete individual subtasks** so I can remove items that are no longer needed
6. **Expand and collapse subtasks** so my todo list stays clean when I'm not working on details
7. **Have subtasks cascade-deleted** when the parent todo is deleted so there's no orphaned data
8. **Search subtask titles** from the main search bar so I can find todos by their subtask content

---

## User Flow

### Adding Subtasks

```
1. User locates a todo in any section (Overdue, Pending, or Completed)
2. User clicks "▶ Subtasks" button on the right side of the todo
3. Subtask section expands below the todo, showing:
   a. List of existing subtasks (if any)
   b. Text input field for adding a new subtask
   c. "Add" button
4. User types a subtask title in the input field
5. User presses Enter or clicks "Add"
6. Subtask appears in the list with an unchecked checkbox
7. Progress bar appears/updates on the parent todo
```

### Toggling Subtask Completion

```
1. User expands subtasks on a todo
2. User clicks the checkbox next to a subtask
3. Checkbox toggles (checked/unchecked)
4. Progress bar updates immediately
5. Text indicator updates (e.g., "2/5 subtasks" → "3/5 subtasks")
```

### Deleting a Subtask

```
1. User expands subtasks on a todo
2. User clicks the "✕" button on the right side of a subtask
3. Subtask is immediately removed
4. Progress bar and text indicator update
5. If no subtasks remain, progress bar disappears
```

### Expanding/Collapsing Subtasks

```
1. Collapsed state (default):
   - Button shows "▶ Subtasks"
   - Subtask list is hidden
   - Progress bar is visible (if subtasks exist)
   - Progress text ("X/Y subtasks") is visible

2. Expanded state:
   - Button shows "▼ Subtasks"
   - Subtask list is visible with checkboxes
   - Add subtask input field is visible
   - Progress bar still visible
```

---

## Technical Requirements

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
);
```

**Field Details:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INTEGER | Auto | Auto-increment | Primary key |
| `todo_id` | INTEGER | Yes | — | Foreign key to `todos` table (CASCADE delete) |
| `title` | TEXT | Yes | — | Subtask title (non-empty, trimmed) |
| `completed` | INTEGER | Yes | `0` | Boolean: 0 = incomplete, 1 = complete |
| `position` | INTEGER | Yes | `0` | Sort order within the parent todo |
| `created_at` | TEXT | Yes | `datetime('now')` | Creation timestamp |

**Key Constraint:** `ON DELETE CASCADE` ensures all subtasks are automatically removed when the parent todo is deleted.

### TypeScript Interfaces

```typescript
// lib/db.ts

export interface Subtask {
  id: number
  todo_id: number
  title: string
  completed: boolean
  position: number
  created_at: string
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
```

### Database CRUD Operations

```typescript
// lib/db.ts — subtaskDB object

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
    // Calculate next position
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

    const updated = {
      title: input.title !== undefined ? input.title.trim() : subtask.title,
      completed: input.completed !== undefined ? input.completed : subtask.completed,
      position: input.position !== undefined ? input.position : subtask.position,
    }

    db.prepare(`
      UPDATE subtasks SET title = ?, completed = ?, position = ?
      WHERE id = ?
    `).run(
      updated.title,
      updated.completed ? 1 : 0,
      updated.position,
      id
    )

    return subtaskDB.findById(id)
  },

  delete(id: number): boolean {
    const result = db.prepare('DELETE FROM subtasks WHERE id = ?').run(id)
    return result.changes > 0
  },

  deleteByTodoId(todoId: number): void {
    db.prepare('DELETE FROM subtasks WHERE todo_id = ?').run(todoId)
  },
}
```

---

### API Endpoints

#### `GET /api/todos/[id]/subtasks` — List subtasks for a todo

```typescript
// app/api/todos/[id]/subtasks/route.ts

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  // Verify the todo belongs to the user
  const todo = todoDB.findById(Number(id), session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  const subtasks = subtaskDB.findByTodoId(Number(id))
  return NextResponse.json(subtasks)
}
```

**Response:** `200 OK` — Array of `Subtask` objects, ordered by `position`

---

#### `POST /api/todos/[id]/subtasks` — Create a subtask

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  // Verify the todo belongs to the user
  const todo = todoDB.findById(Number(id), session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  // Validate title
  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: 'Subtask title is required' }, { status: 400 })
  }

  const subtask = subtaskDB.create(Number(id), { title: body.title })
  return NextResponse.json(subtask, { status: 201 })
}
```

**Request Body:**
```json
{ "title": "Research options" }
```

**Response:** `201 Created` — Created `Subtask` object

---

#### `PUT /api/subtasks/[id]` — Update a subtask

```typescript
// app/api/subtasks/[id]/route.ts

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  // Verify the subtask's parent todo belongs to the user
  const subtask = subtaskDB.findById(Number(id))
  if (!subtask) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
  }

  const todo = todoDB.findById(subtask.todo_id, session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Validate title if provided
  if (body.title !== undefined && !body.title.trim()) {
    return NextResponse.json({ error: 'Subtask title cannot be empty' }, { status: 400 })
  }

  const updated = subtaskDB.update(Number(id), body)
  return NextResponse.json(updated)
}
```

**Request Body (toggle completion):**
```json
{ "completed": true }
```

**Response:** `200 OK` — Updated `Subtask` object

---

#### `DELETE /api/subtasks/[id]` — Delete a subtask

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  // Verify the subtask's parent todo belongs to the user
  const subtask = subtaskDB.findById(Number(id))
  if (!subtask) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
  }

  const todo = todoDB.findById(subtask.todo_id, session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  subtaskDB.delete(Number(id))
  return NextResponse.json({ success: true })
}
```

**Response:** `200 OK` — `{ success: true }`

---

### Fetching Todos with Subtasks

The main todo list endpoint can include subtask counts for progress display without expanding:

```typescript
// Option A: Include subtask counts in GET /api/todos response
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const todos = todoDB.findAll(session.userId)

  // Enrich with subtask data
  const enriched = todos.map(todo => {
    const subtasks = subtaskDB.findByTodoId(todo.id)
    return {
      ...todo,
      subtasks,
      subtask_count: subtasks.length,
      subtask_completed: subtasks.filter(s => s.completed).length,
    }
  })

  return NextResponse.json(enriched)
}
```

**Enriched Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `subtasks` | `Subtask[]` | Full subtask array for the todo |
| `subtask_count` | `number` | Total number of subtasks |
| `subtask_completed` | `number` | Number of completed subtasks |

---

## UI Components

### Subtask Toggle Button

```tsx
<button
  onClick={() => toggleSubtaskExpansion(todo.id)}
  className="text-sm text-gray-600 hover:text-gray-800
             dark:text-gray-400 dark:hover:text-gray-200"
>
  {expandedTodos.has(todo.id) ? '▼ Subtasks' : '▶ Subtasks'}
</button>
```

**State Management:**

```typescript
const [expandedTodos, setExpandedTodos] = useState<Set<number>>(new Set())

function toggleSubtaskExpansion(todoId: number) {
  setExpandedTodos(prev => {
    const next = new Set(prev)
    if (next.has(todoId)) {
      next.delete(todoId)
    } else {
      next.add(todoId)
    }
    return next
  })
}
```

### Progress Bar

```tsx
function ProgressBar({ completed, total }: { completed: number; total: number }) {
  if (total === 0) return null

  const percentage = Math.round((completed / total) * 100)
  const isComplete = percentage === 100

  return (
    <div className="mt-1">
      {/* Text indicator */}
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {completed}/{total} subtasks
      </span>

      {/* Visual bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-0.5 dark:bg-gray-700">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${
            isComplete
              ? 'bg-green-500 dark:bg-green-400'
              : 'bg-blue-500 dark:bg-blue-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
```

**Progress Bar Behavior:**

| State | Bar Color | Text | Visual |
|-------|----------|------|--------|
| 0% (0/5) | Blue | "0/5 subtasks" | Empty bar |
| 40% (2/5) | Blue | "2/5 subtasks" | Partially filled |
| 80% (4/5) | Blue | "4/5 subtasks" | Mostly filled |
| 100% (5/5) | Green | "5/5 subtasks" | Fully filled |
| No subtasks | — | — | No bar shown |

### Subtask List (Expanded)

```tsx
{expandedTodos.has(todo.id) && (
  <div className="mt-3 ml-6 space-y-2">
    {/* Existing subtasks */}
    {todo.subtasks.map(subtask => (
      <div key={subtask.id} className="flex items-center gap-2 group">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={subtask.completed}
          onChange={() => toggleSubtask(subtask.id, !subtask.completed)}
          className="rounded"
        />

        {/* Title */}
        <span className={subtask.completed
          ? 'line-through text-gray-400 dark:text-gray-500'
          : 'text-gray-700 dark:text-gray-300'
        }>
          {subtask.title}
        </span>

        {/* Delete button */}
        <button
          onClick={() => deleteSubtask(subtask.id)}
          className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100
                     transition-opacity ml-auto text-sm
                     dark:text-red-500 dark:hover:text-red-400"
        >
          ✕
        </button>
      </div>
    ))}

    {/* Add subtask form */}
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleAddSubtask(todo.id)
      }}
      className="flex gap-2 mt-2"
    >
      <input
        type="text"
        value={newSubtaskTitle[todo.id] ?? ''}
        onChange={(e) => setNewSubtaskTitle(prev => ({
          ...prev,
          [todo.id]: e.target.value,
        }))}
        placeholder="Add subtask..."
        className="flex-1 text-sm border rounded px-2 py-1
                   dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      />
      <button
        type="submit"
        className="text-sm px-3 py-1 bg-blue-500 text-white rounded
                   hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
      >
        Add
      </button>
    </form>
  </div>
)}
```

### Subtask Event Handlers

```typescript
// Toggle subtask completion
async function toggleSubtask(subtaskId: number, completed: boolean) {
  await fetch(`/api/subtasks/${subtaskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  })
  // Refresh todos to update progress
  await fetchTodos()
}

// Add a subtask
async function handleAddSubtask(todoId: number) {
  const title = newSubtaskTitle[todoId]?.trim()
  if (!title) return

  await fetch(`/api/todos/${todoId}/subtasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })

  // Clear input and refresh
  setNewSubtaskTitle(prev => ({ ...prev, [todoId]: '' }))
  await fetchTodos()
}

// Delete a subtask
async function deleteSubtask(subtaskId: number) {
  await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' })
  await fetchTodos()
}
```

### Todo Item Layout with Subtasks

```
┌─────────────────────────────────────────────────────────────────┐
│ ☐  Write project proposal  [High]  [🔄 weekly]  [Work]        │
│    ████████░░░░░░░░ 3/7 subtasks                               │
│                                    [▶ Subtasks] [Edit] [Delete]│
│                                                                 │
│    (expanded — only visible when ▼ Subtasks clicked)           │
│    ☑ Research competitors                                       │
│    ☑ Draft outline                                              │
│    ☑ Write introduction                                         │
│    ☐ Write main body                                            │
│    ☐ Add charts and data                                        │
│    ☐ Proofread                                                  │
│    ☐ Submit for review                                          │
│    [Add subtask...                              ] [Add]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Progress Calculation

```typescript
function calculateProgress(subtasks: Subtask[]): {
  completed: number
  total: number
  percentage: number
} {
  const total = subtasks.length
  const completed = subtasks.filter(s => s.completed).length
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)

  return { completed, total, percentage }
}
```

**Rules:**
- Progress is `0%` when no subtasks are completed
- Progress is `100%` when all subtasks are completed
- Progress bar is not shown when there are 0 subtasks
- Percentage is rounded to the nearest integer
- Deleting a completed subtask may increase or decrease the percentage
- Deleting all subtasks removes the progress bar

---

## Position Management

Subtasks maintain their order via the `position` field:

```typescript
// New subtasks get position = max(position) + 1
const maxPos = db.prepare(
  'SELECT COALESCE(MAX(position), -1) as maxPos FROM subtasks WHERE todo_id = ?'
).get(todoId) as { maxPos: number }

const nextPosition = maxPos.maxPos + 1
```

**Ordering:**
- Subtasks are ordered by `position ASC, id ASC`
- New subtasks are appended at the end (highest position + 1)
- If positions are equal, `id` (creation order) is the tiebreaker
- Drag-and-drop reordering is out of scope for this PRP

---

## Search Integration

Subtask titles are included in the client-side search (see PRP 08 for full search):

```typescript
// In the search/filter logic on the client
const filteredTodos = todos.filter(todo => {
  if (!searchQuery) return true

  const query = searchQuery.toLowerCase()

  // Search todo title
  if (todo.title.toLowerCase().includes(query)) return true

  // Search subtask titles
  if (todo.subtasks?.some(s => s.title.toLowerCase().includes(query))) return true

  return false
})
```

**Example:**
```
Search: "report"

Todo: "Project Alpha"
  Subtask: "Send report to team"  ← MATCH

Result: "Project Alpha" is shown because its subtask matches
```

---

## Edge Cases

### Subtask Creation

| Scenario | Expected Behavior |
|----------|-------------------|
| Empty subtask title | Reject — "Subtask title is required" (400) |
| Whitespace-only title | Reject — title trimmed, found empty (400) |
| Title with leading/trailing spaces | Trim before saving |
| Add subtask to non-existent todo | 404 "Todo not found" |
| Add subtask to another user's todo | 404 "Todo not found" (user_id scoping) |
| Add subtask to a completed todo | Allowed — no restriction |

### Subtask Completion

| Scenario | Expected Behavior |
|----------|-------------------|
| Toggle subtask to completed | `completed: true`, progress updates |
| Toggle subtask to incomplete | `completed: false`, progress updates |
| Complete all subtasks | Progress bar turns green at 100% |
| Completing subtask does NOT complete parent | Parent todo completion is independent |
| Completing parent todo with incomplete subtasks | Allowed — subtasks don't block parent |

### Progress Bar

| Scenario | Expected Behavior |
|----------|-------------------|
| 0 subtasks | No progress bar shown |
| 1 subtask added (incomplete) | Bar at 0%, text "0/1 subtasks" |
| 3/5 completed | Bar at 60%, blue, text "3/5 subtasks" |
| 5/5 completed | Bar at 100%, green, text "5/5 subtasks" |
| Delete a completed subtask (was 3/5, now 2/4) | Bar at 50%, text "2/4 subtasks" |
| Delete all subtasks | Progress bar disappears |

### Cascade Delete

| Scenario | Expected Behavior |
|----------|-------------------|
| Delete todo with 5 subtasks | All 5 subtasks cascade-deleted |
| Delete todo with 0 subtasks | No error, todo deleted normally |
| Delete individual subtask | Only that subtask removed, parent todo untouched |
| Delete subtask updates progress | Progress recalculated after deletion |

### Expand/Collapse

| Scenario | Expected Behavior |
|----------|-------------------|
| Click ▶ Subtasks | Expands, button becomes ▼ Subtasks |
| Click ▼ Subtasks | Collapses, button becomes ▶ Subtasks |
| Multiple todos expanded | Each manages its own expansion state |
| Expand state persists across operations | Adding/deleting within expanded section stays expanded |
| Page refresh | All sections collapse (expansion state not persisted) |

### Recurring Todos

| Scenario | Expected Behavior |
|----------|-------------------|
| Complete recurring todo with subtasks | New instance does NOT inherit subtasks |
| Subtasks on completed instance | Remain on the completed instance |
| New recurring instance | Starts with 0 subtasks |

### Authorization

| Scenario | Expected Behavior |
|----------|-------------------|
| Access subtask of another user's todo | 404 or 403 (parent todo not found for user) |
| Update subtask on another user's todo | 403 "Not authorized" |
| Delete subtask on another user's todo | 403 "Not authorized" |

---

## Acceptance Criteria

### Adding Subtasks

- [ ] "▶ Subtasks" button appears on every todo
- [ ] Clicking expands the subtask section
- [ ] Text input and "Add" button appear in the expanded section
- [ ] Typing a title and pressing Enter creates a subtask
- [ ] Typing a title and clicking "Add" creates a subtask
- [ ] New subtask appears with an unchecked checkbox
- [ ] Empty/whitespace-only title is rejected
- [ ] Input field clears after adding a subtask
- [ ] Subtasks are ordered by position (creation order)

### Toggling Subtask Completion

- [ ] Clicking the checkbox toggles subtask completion
- [ ] Completed subtask title shows strikethrough styling
- [ ] Unchecking a completed subtask removes strikethrough
- [ ] Progress bar updates in real-time on toggle
- [ ] Subtask completion does NOT affect parent todo completion

### Progress Bar

- [ ] Progress bar appears when a todo has at least 1 subtask
- [ ] Progress bar is hidden when a todo has 0 subtasks
- [ ] Text shows "X/Y subtasks" format
- [ ] Bar width corresponds to completion percentage
- [ ] Bar is blue for 0–99% completion
- [ ] Bar turns green at 100% completion
- [ ] Progress is visible even when subtasks are collapsed
- [ ] Progress updates immediately on subtask toggle, add, or delete

### Deleting Subtasks

- [ ] "✕" button appears on hover for each subtask
- [ ] Clicking "✕" immediately deletes the subtask
- [ ] Progress bar updates after deletion
- [ ] Deleting the last subtask removes the progress bar

### Expand/Collapse

- [ ] Default state is collapsed (▶ Subtasks)
- [ ] Clicking toggles between expanded (▼) and collapsed (▶)
- [ ] Multiple todos can be expanded simultaneously
- [ ] Expansion state is maintained during CRUD operations

### Cascade Delete

- [ ] Deleting a parent todo removes all its subtasks
- [ ] No orphaned subtask rows remain in the database
- [ ] `ON DELETE CASCADE` is defined in the schema

### Search Integration

- [ ] Searching for a subtask title shows the parent todo
- [ ] Search is case-insensitive for subtask titles
- [ ] Partial matches work for subtask titles

### Authorization

- [ ] All subtask endpoints require authentication (401 without session)
- [ ] Users cannot create subtasks on other users' todos (404)
- [ ] Users cannot update or delete other users' subtasks (403)

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/05-subtasks.spec.ts

import { test, expect } from '@playwright/test'
import { TodoHelper } from './helpers'

test.describe('Subtasks & Progress Tracking', () => {

  test('should expand subtask section', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Parent todo')

    // Click expand
    await page.click('button:has-text("▶ Subtasks")')

    // Should see add subtask input
    await expect(page.getByPlaceholder('Add subtask...')).toBeVisible()
    // Button should show collapse indicator
    await expect(page.locator('button:has-text("▼ Subtasks")')).toBeVisible()
  })

  test('should add a subtask', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Parent todo')

    await helper.addSubtask('Parent todo', 'First subtask')

    // Subtask should be visible
    await expect(page.getByText('First subtask')).toBeVisible()
  })

  test('should add multiple subtasks', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Multi-subtask todo')

    await helper.addSubtask('Multi-subtask todo', 'Step 1')
    await helper.addSubtask('Multi-subtask todo', 'Step 2')
    await helper.addSubtask('Multi-subtask todo', 'Step 3')

    await expect(page.getByText('Step 1')).toBeVisible()
    await expect(page.getByText('Step 2')).toBeVisible()
    await expect(page.getByText('Step 3')).toBeVisible()
  })

  test('should show progress bar after adding subtasks', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Progress todo')

    await helper.addSubtask('Progress todo', 'Subtask A')
    await helper.addSubtask('Progress todo', 'Subtask B')

    // Progress text should show 0/2
    await expect(page.getByText('0/2 subtasks')).toBeVisible()
  })

  test('should update progress on subtask completion', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Toggle todo')

    await helper.addSubtask('Toggle todo', 'Task A')
    await helper.addSubtask('Toggle todo', 'Task B')

    // Complete first subtask
    const checkboxes = page.locator('.subtask-item input[type="checkbox"]')
    await checkboxes.first().click()

    // Progress should show 1/2
    await expect(page.getByText('1/2 subtasks')).toBeVisible()
  })

  test('should show green bar at 100%', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Complete all')

    await helper.addSubtask('Complete all', 'Only task')

    // Complete the only subtask
    const checkbox = page.locator('.subtask-item input[type="checkbox"]')
    await checkbox.click()

    // Progress should show 1/1 and green bar
    await expect(page.getByText('1/1 subtasks')).toBeVisible()
  })

  test('should delete a subtask', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Delete subtask todo')

    await helper.addSubtask('Delete subtask todo', 'Remove me')

    // Delete the subtask
    await page.locator('.subtask-item').hover()
    await page.click('button:has-text("✕")')

    // Subtask should be gone
    await expect(page.getByText('Remove me')).not.toBeVisible()
  })

  test('should cascade delete subtasks with parent todo', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Cascade parent')

    await helper.addSubtask('Cascade parent', 'Child 1')
    await helper.addSubtask('Cascade parent', 'Child 2')

    // Delete the parent
    await page.click('button:has-text("Delete")')

    // Parent and subtasks should all be gone
    await expect(page.getByText('Cascade parent')).not.toBeVisible()
    await expect(page.getByText('Child 1')).not.toBeVisible()
    await expect(page.getByText('Child 2')).not.toBeVisible()
  })

  test('should collapse subtask section', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Collapse test')

    // Expand
    await page.click('button:has-text("▶ Subtasks")')
    await expect(page.getByPlaceholder('Add subtask...')).toBeVisible()

    // Collapse
    await page.click('button:has-text("▼ Subtasks")')
    await expect(page.getByPlaceholder('Add subtask...')).not.toBeVisible()
  })

  test('should reject empty subtask title', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Empty subtask test')

    // Expand subtasks
    await page.click('button:has-text("▶ Subtasks")')

    // Try to add empty subtask
    await page.click('button:has-text("Add")')

    // Should not create a subtask (no new items in list)
  })

  test('should show subtask strikethrough when completed', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Strikethrough test')

    await helper.addSubtask('Strikethrough test', 'Done task')

    // Complete the subtask
    const checkbox = page.locator('.subtask-item input[type="checkbox"]')
    await checkbox.click()

    // Verify line-through style
    const subtaskText = page.locator('.subtask-item span:has-text("Done task")')
    await expect(subtaskText).toHaveCSS('text-decoration-line', 'line-through')
  })
})
```

### Test Helper Extension

```typescript
// tests/helpers.ts — add to TodoHelper class

export class TodoHelper {
  // ... existing methods

  async addSubtask(todoTitle: string, subtaskTitle: string) {
    // Find the todo and expand subtasks
    const todoItem = this.page.locator(`[data-testid="todo-item"]:has-text("${todoTitle}")`)

    // Expand if collapsed
    const expandBtn = todoItem.locator('button:has-text("▶ Subtasks")')
    if (await expandBtn.isVisible()) {
      await expandBtn.click()
    }

    // Add subtask
    await todoItem.locator('input[placeholder="Add subtask..."]').fill(subtaskTitle)
    await todoItem.locator('button:has-text("Add")').click()
  }
}
```

### API Integration Tests

```typescript
// Subtask API tests

test('POST /api/todos/:id/subtasks creates a subtask', async () => {
  const todo = await createTestTodo()
  const res = await fetch(`/api/todos/${todo.id}/subtasks`, {
    method: 'POST',
    body: JSON.stringify({ title: 'Test subtask' }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(201)

  const subtask = await res.json()
  expect(subtask.title).toBe('Test subtask')
  expect(subtask.completed).toBe(false)
  expect(subtask.todo_id).toBe(todo.id)
})

test('POST /api/todos/:id/subtasks rejects empty title', async () => {
  const todo = await createTestTodo()
  const res = await fetch(`/api/todos/${todo.id}/subtasks`, {
    method: 'POST',
    body: JSON.stringify({ title: '' }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(400)
})

test('PUT /api/subtasks/:id toggles completion', async () => {
  const subtask = await createTestSubtask()
  const res = await fetch(`/api/subtasks/${subtask.id}`, {
    method: 'PUT',
    body: JSON.stringify({ completed: true }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(200)

  const updated = await res.json()
  expect(updated.completed).toBe(true)
})

test('DELETE /api/subtasks/:id removes subtask', async () => {
  const subtask = await createTestSubtask()
  const res = await fetch(`/api/subtasks/${subtask.id}`, {
    method: 'DELETE',
  })
  expect(res.status).toBe(200)

  // Verify it's gone
  const check = await fetch(`/api/subtasks/${subtask.id}`)
  expect(check.status).toBe(404)
})

test('deleting parent todo cascades to subtasks', async () => {
  const todo = await createTestTodo()
  await createTestSubtask(todo.id)
  await createTestSubtask(todo.id)

  // Delete the parent
  await fetch(`/api/todos/${todo.id}`, { method: 'DELETE' })

  // Subtasks should be gone (check via direct DB query or listing)
  const res = await fetch(`/api/todos/${todo.id}/subtasks`)
  expect(res.status).toBe(404) // todo not found
})

test('returns 401 for unauthenticated subtask requests', async () => {
  const res = await fetch('/api/todos/1/subtasks', {
    headers: {}, // No auth cookie
  })
  expect(res.status).toBe(401)
})
```

---

## Out of Scope

These are related features handled by other PRPs:

- Todo CRUD basics → **PRP 01**
- Priority badges and sorting → **PRP 02**
- Recurring todos (subtasks NOT inherited) → **PRP 03**
- Reminders and notifications → **PRP 04**
- Tag system and associations → **PRP 06**
- Template subtask serialization (JSON) → **PRP 07**
- Search across subtask titles → **PRP 08**
- Export/import subtask data → **PRP 09**
- Calendar view → **PRP 10**
- Drag-and-drop subtask reordering → Future enhancement
- Subtask nesting (sub-subtasks) → Future enhancement
- Subtask due dates → Future enhancement
- Subtask assignment to users → Future enhancement

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Subtask creation response time | < 100ms |
| Progress bar update latency | < 200ms (after toggle) |
| Cascade delete correctness | 100% — no orphaned subtasks |
| Progress calculation accuracy | 100% — matches completed/total |
| Search inclusion | 100% — subtask titles found in search |
| E2E test pass rate | 100% |
| Input validation coverage | 100% — empty titles rejected |
| Authorization enforcement | 100% — cross-user access blocked |

---

## Implementation Notes

### Project-Specific Patterns

1. **Subtasks are fetched alongside todos** — the `GET /api/todos` response includes enriched `subtasks`, `subtask_count`, and `subtask_completed` fields so the client doesn't need separate requests for progress display.
2. **Subtask CRUD uses two route groups** — creating and listing under `/api/todos/[id]/subtasks`, while updating and deleting use `/api/subtasks/[id]` (subtask ID directly).
3. **Authorization checks go through the parent todo** — every subtask operation verifies the parent todo's `user_id` matches the session. There is no `user_id` on the subtask row itself.
4. **Expansion state is client-side only** — `expandedTodos` is a `Set<number>` in React state, not persisted to localStorage or database.
5. **`newSubtaskTitle` is per-todo** — stored as `Record<number, string>` so multiple todos can be expanded and have independent input fields.
6. **ON DELETE CASCADE** — the SQLite foreign key `FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE` handles cleanup. Make sure `PRAGMA foreign_keys = ON` is set when opening the database.
7. **Immutability** — use spread operators when updating subtask state, never mutate arrays.
8. **`params` is async** in Next.js 16 — always `const { id } = await params`.

### File Locations

```
app/api/todos/[id]/subtasks/route.ts   # GET (list), POST (create) subtasks
app/api/subtasks/[id]/route.ts         # PUT (update), DELETE subtask
lib/db.ts                               # subtaskDB CRUD operations, Subtask interface
app/page.tsx                            # UI: expand/collapse, progress bar, subtask list
```

### Dependencies

No additional npm packages. Uses:
- `better-sqlite3` for subtask table and CRUD
- React state (`useState`) for expansion tracking and input management
- Tailwind CSS for progress bar styling and dark mode
- `ON DELETE CASCADE` SQLite pragma for cleanup

### SQLite Foreign Keys Requirement

```typescript
// In lib/db.ts — ensure foreign keys are enabled
db.pragma('foreign_keys = ON')
```

Without this pragma, `ON DELETE CASCADE` will not function and subtasks will be orphaned on parent deletion.
