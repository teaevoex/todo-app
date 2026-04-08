# PRP 01: Todo CRUD Operations

## Feature Overview

Implement the core Create, Read, Update, and Delete (CRUD) operations for the Todo App. This is the foundational feature upon which all other features build. Todos support titles, due dates, priority levels, and completion tracking. All date/time operations use **Singapore timezone** (`Asia/Singapore`).

---

## User Stories

### As a user, I want to:

1. **Create a todo** with a title so I can track tasks I need to do
2. **Create a todo with a due date** so I know when it needs to be completed
3. **View all my todos** organized into Overdue, Pending, and Completed sections
4. **Edit a todo** to change its title, due date, or other properties
5. **Mark a todo as complete** by clicking a checkbox
6. **Unmark a completed todo** to move it back to Pending/Overdue
7. **Delete a todo** when it is no longer needed
8. **See smart time displays** that show urgency-based formatting for due dates

---

## User Flow

### Creating a Todo

```
1. User sees the todo form at the top of the main page
2. User types a title in the text input field
3. (Optional) User selects a priority level from the dropdown
4. (Optional) User picks a due date/time using the datetime picker
5. User clicks "Add" button
6. Todo appears in the Pending section (or Overdue if due date is past)
7. Form clears, ready for next entry
```

### Viewing Todos

```
1. User loads the main page
2. Todos are fetched from the API and displayed in three sections:
   a. Overdue — past due date, not completed (red background, ⚠️ icon)
   b. Pending — future due date or no due date, not completed
   c. Completed — marked as done
3. Within each section, todos are sorted by: Priority → Due Date → Creation Date
4. Each todo shows its title, badges, due date (color-coded), and action buttons
```

### Editing a Todo

```
1. User clicks "Edit" button on any todo
2. Edit modal opens with current values pre-filled
3. User modifies title, due date, priority, or other fields
4. User clicks "Update" to save, or "Cancel" to discard
5. Modal closes, todo list refreshes with updated data
```

### Completing a Todo

```
1. User clicks the checkbox on a todo
2. Todo moves from Overdue/Pending to the Completed section
3. Checkbox shows a checkmark (✓)
4. (If recurring, a new instance is created — see PRP 03)
```

### Uncompleting a Todo

```
1. User clicks the checked checkbox on a completed todo
2. Todo moves back to Overdue (if past due) or Pending
```

### Deleting a Todo

```
1. User clicks "Delete" button on any todo
2. Todo is immediately deleted (no confirmation dialog)
3. All associated subtasks and tag associations are cascade-deleted
```

---

## Technical Requirements

### Database Schema

```sql
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
```

**Field Details:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INTEGER | Auto | Auto-increment | Primary key |
| `user_id` | INTEGER | Yes | — | Foreign key to `users` table |
| `title` | TEXT | Yes | — | Todo title (non-empty, trimmed) |
| `completed` | INTEGER | Yes | `0` | Boolean: 0 = incomplete, 1 = complete |
| `due_date` | TEXT | No | `null` | ISO 8601 datetime string (Singapore TZ) |
| `priority` | TEXT | Yes | `'medium'` | One of: `'high'`, `'medium'`, `'low'` |
| `is_recurring` | INTEGER | No | `0` | Boolean: 0 = one-time, 1 = recurring |
| `recurrence_pattern` | TEXT | No | `null` | One of: `'daily'`, `'weekly'`, `'monthly'`, `'yearly'` |
| `reminder_minutes` | INTEGER | No | `null` | Minutes before due date to remind |
| `last_notification_sent` | TEXT | No | `null` | Timestamp of last notification |
| `created_at` | TEXT | Yes | `datetime('now')` | Creation timestamp |

### TypeScript Interfaces

```typescript
// lib/db.ts

export type Priority = 'high' | 'medium' | 'low'
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Todo {
  id: number
  user_id: number
  title: string
  completed: boolean
  due_date: string | null
  priority: Priority
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: number | null
  last_notification_sent: string | null
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
```

### Database CRUD Operations

All database operations are synchronous using `better-sqlite3`:

```typescript
// lib/db.ts — todoDB object

export const todoDB = {
  findAll(userId: number): Todo[] {
    return db.prepare(
      'SELECT * FROM todos WHERE user_id = ? ORDER BY priority, due_date, created_at DESC'
    ).all(userId) as Todo[]
  },

  findById(id: number, userId: number): Todo | undefined {
    return db.prepare(
      'SELECT * FROM todos WHERE id = ? AND user_id = ?'
    ).get(id, userId) as Todo | undefined
  },

  create(userId: number, input: CreateTodoInput): Todo {
    const stmt = db.prepare(`
      INSERT INTO todos (user_id, title, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
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

    const updated = {
      ...todo,
      ...input,
      title: input.title !== undefined ? input.title.trim() : todo.title,
      completed: input.completed !== undefined ? input.completed : todo.completed,
    }

    db.prepare(`
      UPDATE todos SET title = ?, completed = ?, due_date = ?, priority = ?,
        is_recurring = ?, recurrence_pattern = ?, reminder_minutes = ?
      WHERE id = ? AND user_id = ?
    `).run(
      updated.title,
      updated.completed ? 1 : 0,
      updated.due_date ?? null,
      updated.priority,
      updated.is_recurring ? 1 : 0,
      updated.recurrence_pattern ?? null,
      updated.reminder_minutes ?? null,
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
  }
}
```

### API Endpoints

#### `GET /api/todos` — List all todos

```typescript
// app/api/todos/route.ts

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const todos = todoDB.findAll(session.userId)
  return NextResponse.json(todos)
}
```

**Response:** `200 OK` — Array of `Todo` objects

---

#### `POST /api/todos` — Create a todo

```typescript
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()

  // Validate title
  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  // Validate priority
  if (body.priority && !['high', 'medium', 'low'].includes(body.priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  // Validate due date (must be in the future if provided)
  if (body.due_date) {
    const dueDate = new Date(body.due_date)
    const now = getSingaporeNow()
    if (dueDate <= now) {
      return NextResponse.json(
        { error: 'Due date must be in the future' },
        { status: 400 }
      )
    }
  }

  const todo = todoDB.create(session.userId, body)
  return NextResponse.json(todo, { status: 201 })
}
```

**Request Body:**
```json
{
  "title": "Buy groceries",
  "due_date": "2025-11-10T14:00",
  "priority": "medium"
}
```

**Response:** `201 Created` — Created `Todo` object

**Validation Rules:**
- `title` — Required, cannot be empty or whitespace-only
- `priority` — Must be `'high'`, `'medium'`, or `'low'` (defaults to `'medium'`)
- `due_date` — Must be at least 1 minute in the future (Singapore timezone)

---

#### `GET /api/todos/[id]` — Get a single todo

```typescript
// app/api/todos/[id]/route.ts

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params // params is a Promise in Next.js 16
  const todo = todoDB.findById(Number(id), session.userId)

  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  return NextResponse.json(todo)
}
```

**Response:** `200 OK` — Single `Todo` object or `404 Not Found`

---

#### `PUT /api/todos/[id]` — Update a todo

```typescript
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

  // Validate title if provided
  if (body.title !== undefined && !body.title.trim()) {
    return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
  }

  const todo = todoDB.update(Number(id), session.userId, body)
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  return NextResponse.json(todo)
}
```

**Request Body:** Partial `UpdateTodoInput` — only include fields to change

**Response:** `200 OK` — Updated `Todo` object or `404 Not Found`

---

#### `DELETE /api/todos/[id]` — Delete a todo

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
  const deleted = todoDB.delete(Number(id), session.userId)

  if (!deleted) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
```

**Response:** `200 OK` — `{ success: true }` or `404 Not Found`

---

### Singapore Timezone Handling

All date/time logic **must** use `lib/timezone.ts`:

```typescript
// lib/timezone.ts

import { format, utcToZonedTime } from 'date-fns-tz'

const TIMEZONE = 'Asia/Singapore'

export function getSingaporeNow(): Date {
  return utcToZonedTime(new Date(), TIMEZONE)
}

export function formatSingaporeDate(date: Date | string, fmt: string = 'yyyy-MM-dd HH:mm'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(utcToZonedTime(d, TIMEZONE), fmt, { timeZone: TIMEZONE })
}
```

**Rules:**
- Never use `new Date()` directly for comparisons — use `getSingaporeNow()`
- Due date validation uses Singapore timezone
- Time display formatting uses Singapore timezone
- Overdue detection uses Singapore timezone

---

## UI Components

### Todo Form (Create)

Located at the top of `app/page.tsx`:

```tsx
// Simplified structure

<form onSubmit={handleAddTodo} className="flex gap-2">
  {/* Title input */}
  <input
    type="text"
    value={newTodoTitle}
    onChange={(e) => setNewTodoTitle(e.target.value)}
    placeholder="What needs to be done?"
    required
  />

  {/* Priority dropdown */}
  <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
    <option value="medium">Medium</option>
    <option value="high">High</option>
    <option value="low">Low</option>
  </select>

  {/* Due date picker */}
  <input
    type="datetime-local"
    value={newDueDate}
    onChange={(e) => setNewDueDate(e.target.value)}
  />

  {/* Submit button */}
  <button type="submit">Add</button>
</form>
```

### Todo List Sections

```tsx
{/* Overdue Section — only shown if overdue todos exist */}
{overdueTodos.length > 0 && (
  <section className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
    <h2>⚠️ Overdue ({overdueTodos.length})</h2>
    {overdueTodos.map(todo => <TodoItem key={todo.id} todo={todo} />)}
  </section>
)}

{/* Pending Section */}
<section>
  <h2>Pending ({pendingTodos.length})</h2>
  {pendingTodos.map(todo => <TodoItem key={todo.id} todo={todo} />)}
</section>

{/* Completed Section */}
<section>
  <h2>Completed ({completedTodos.length})</h2>
  {completedTodos.map(todo => <TodoItem key={todo.id} todo={todo} />)}
</section>
```

### Todo Item Display

Each todo item shows:

```
┌─────────────────────────────────────────────────────────────────┐
│ ☐  Buy groceries  [Medium]  [🔄 weekly]  [🔔 1h]  [Work]     │
│    Due in 3 hours (Nov 10 14:00)                               │
│    ████████░░░░░░░░ 3/7 subtasks                               │
│                                    [▶ Subtasks] [Edit] [Delete]│
└─────────────────────────────────────────────────────────────────┘
```

### Smart Due Date Display

```typescript
function formatDueDate(dueDate: string): { text: string; color: string } {
  const now = getSingaporeNow()
  const due = new Date(dueDate)
  const diffMs = due.getTime() - now.getTime()
  const diffMinutes = diffMs / (1000 * 60)
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffMs < 0) {
    // Overdue
    return { text: `${formatTimeAgo(due)} overdue`, color: 'text-red-600' }
  } else if (diffMinutes < 60) {
    return { text: `Due in ${Math.round(diffMinutes)} minutes`, color: 'text-red-600' }
  } else if (diffHours < 24) {
    return { text: `Due in ${Math.round(diffHours)} hours`, color: 'text-orange-500' }
  } else if (diffDays < 7) {
    return { text: `Due in ${Math.round(diffDays)} days`, color: 'text-yellow-600' }
  } else {
    return { text: formatSingaporeDate(due), color: 'text-blue-500' }
  }
}
```

| Time Until Due | Display | Color |
|----------------|---------|-------|
| Overdue | "X days/hours/minutes overdue" | Red |
| < 1 hour | "Due in X minutes" | Red |
| < 24 hours | "Due in X hours (timestamp)" | Orange |
| < 7 days | "Due in X days (timestamp)" | Yellow |
| 7+ days | Full timestamp | Blue |

### Edit Modal

```tsx
{/* Edit Modal Overlay */}
{editingTodo && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
      <h3>Edit Todo</h3>

      <input type="text" value={editTitle} onChange={...} />
      <input type="datetime-local" value={editDueDate} onChange={...} />
      <select value={editPriority} onChange={...}>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      {/* Additional fields: Repeat, Reminder, Tags — see other PRPs */}

      <div className="flex gap-2 justify-end">
        <button onClick={() => setEditingTodo(null)}>Cancel</button>
        <button onClick={handleUpdateTodo}>Update</button>
      </div>
    </div>
  </div>
)}
```

---

## Sorting Logic

Todos are sorted within each section using the following priority order:

1. **Priority Level:** High → Medium → Low
2. **Due Date:** Earliest → Latest (todos without due dates come last)
3. **Creation Date:** Newest → Oldest (tiebreaker)

```typescript
function sortTodos(todos: Todo[]): Todo[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 }

  return [...todos].sort((a, b) => {
    // 1. Sort by priority
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (pDiff !== 0) return pDiff

    // 2. Sort by due date (nulls last)
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    }
    if (a.due_date) return -1
    if (b.due_date) return 1

    // 3. Sort by creation date (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}
```

### Section Classification

```typescript
function classifyTodos(todos: Todo[]) {
  const now = getSingaporeNow()

  const overdue = todos.filter(
    t => !t.completed && t.due_date && new Date(t.due_date) < now
  )
  const pending = todos.filter(
    t => !t.completed && (!t.due_date || new Date(t.due_date) >= now)
  )
  const completed = todos.filter(t => t.completed)

  return {
    overdue: sortTodos(overdue),
    pending: sortTodos(pending),
    completed: completed.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }
}
```

---

## Edge Cases

### Input Validation

| Scenario | Expected Behavior |
|----------|-------------------|
| Empty title | Reject with 400, "Title is required" |
| Whitespace-only title | Reject with 400, "Title is required" |
| Title with leading/trailing spaces | Trim before saving |
| Due date in the past | Reject with 400, "Due date must be in the future" |
| Due date less than 1 minute ahead | Reject with 400 |
| No due date provided | Allowed, todo has no deadline |
| Invalid priority value | Reject with 400, "Invalid priority" |
| No priority provided | Default to `'medium'` |

### State Transitions

| Scenario | Expected Behavior |
|----------|-------------------|
| Complete a pending todo | Moves to Completed section |
| Complete an overdue todo | Moves to Completed section |
| Uncomplete a todo (past due) | Moves to Overdue section |
| Uncomplete a todo (future due) | Moves to Pending section |
| Uncomplete a todo (no due date) | Moves to Pending section |
| Edit due date to the past | Todo appears in Overdue section |
| Edit due date to the future | Todo appears in Pending section |
| Remove due date | Todo appears in Pending section |

### Deletion Behavior

| Scenario | Expected Behavior |
|----------|-------------------|
| Delete todo with subtasks | All subtasks cascade-deleted |
| Delete todo with tags | Tag associations removed (tags themselves preserved) |
| Delete todo that is recurring | Only the current instance deleted |
| Delete todo while another user views | Other user's data unaffected (user_id scoping) |

### Authentication

| Scenario | Expected Behavior |
|----------|-------------------|
| No session cookie | Return 401 "Not authenticated" |
| Expired session | Return 401 "Not authenticated" |
| Access another user's todo | Return 404 "Todo not found" (scoped by user_id) |

---

## Acceptance Criteria

### Create Todo

- [ ] Can create a todo with title only (no other fields required)
- [ ] Can create a todo with title + priority + due date
- [ ] Title is trimmed of leading/trailing whitespace
- [ ] Empty or whitespace-only title is rejected
- [ ] Due date in the past is rejected
- [ ] Default priority is `'medium'` when not specified
- [ ] Todo appears in Pending section after creation
- [ ] Form clears after successful creation

### Read Todos

- [ ] All todos for the authenticated user are displayed
- [ ] Todos are grouped into Overdue, Pending, and Completed sections
- [ ] Overdue section only appears if overdue todos exist
- [ ] Section counters show correct counts: "Overdue (X)", "Pending (X)", "Completed (X)"
- [ ] Todos are sorted by Priority → Due Date → Creation Date
- [ ] Smart due date display shows color-coded urgency text
- [ ] Other users' todos are never visible

### Update Todo

- [ ] Can update title via edit modal
- [ ] Can update due date via edit modal
- [ ] Can update priority via edit modal
- [ ] Can clear due date (set to null)
- [ ] Updated title is trimmed
- [ ] Empty title update is rejected
- [ ] Todo moves to correct section after due date change
- [ ] Edit modal pre-fills with current values

### Toggle Completion

- [ ] Clicking checkbox marks todo as completed
- [ ] Completed todo moves to Completed section
- [ ] Clicking checked checkbox uncompletes the todo
- [ ] Uncompleted todo moves to Overdue or Pending based on due date

### Delete Todo

- [ ] Clicking "Delete" removes the todo immediately
- [ ] Subtasks are cascade-deleted
- [ ] Tag associations are removed
- [ ] Todo disappears from the list without page refresh

### Authentication & Security

- [ ] All endpoints return 401 without a valid session
- [ ] Users cannot access or modify other users' todos
- [ ] SQL injection prevented via prepared statements
- [ ] Input validation on all user-supplied fields

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/02-todo-crud.spec.ts

import { test, expect } from '@playwright/test'
import { TodoHelper } from './helpers'

test.describe('Todo CRUD Operations', () => {

  test('should create a todo with title only', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Buy groceries')
    await expect(page.getByText('Buy groceries')).toBeVisible()
  })

  test('should create a todo with all metadata', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Team meeting', {
      priority: 'high',
      dueDate: '2025-12-01T09:00'
    })
    await expect(page.getByText('Team meeting')).toBeVisible()
    await expect(page.getByText('High')).toBeVisible()
  })

  test('should reject empty title', async ({ page }) => {
    // Attempt to submit form with empty title
    await page.click('button:has-text("Add")')
    // Form validation should prevent submission
  })

  test('should edit a todo title', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Original title')
    await page.click('button:has-text("Edit")')
    await page.fill('input[type="text"]', 'Updated title')
    await page.click('button:has-text("Update")')
    await expect(page.getByText('Updated title')).toBeVisible()
  })

  test('should toggle todo completion', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Task to complete')
    // Check the checkbox
    await page.click('input[type="checkbox"]')
    // Verify it moved to Completed section
    await expect(page.locator('text=Completed (1)')).toBeVisible()
  })

  test('should delete a todo', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Task to delete')
    await page.click('button:has-text("Delete")')
    await expect(page.getByText('Task to delete')).not.toBeVisible()
  })

  test('should reject past due date', async ({ page }) => {
    // Attempt to create todo with past due date
    // Expect validation error
  })

  test('should display overdue todos in Overdue section', async ({ page }) => {
    // Create a todo with a due date that has passed
    // Verify it appears under "Overdue" heading
  })

  test('should sort todos by priority', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Low task', { priority: 'low' })
    await helper.createTodo('High task', { priority: 'high' })
    await helper.createTodo('Medium task', { priority: 'medium' })

    // Verify order: High → Medium → Low
    const titles = await page.locator('.todo-title').allTextContents()
    expect(titles).toEqual(['High task', 'Medium task', 'Low task'])
  })
})
```

### Test Helper

```typescript
// tests/helpers.ts

export class TodoHelper {
  constructor(private page: Page) {}

  async createTodo(title: string, options?: {
    priority?: 'high' | 'medium' | 'low'
    dueDate?: string
  }) {
    await this.page.fill('input[placeholder*="What needs to be done"]', title)

    if (options?.priority) {
      await this.page.selectOption('select', options.priority)
    }

    if (options?.dueDate) {
      await this.page.fill('input[type="datetime-local"]', options.dueDate)
    }

    await this.page.click('button:has-text("Add")')
  }
}
```

### API Integration Tests

```typescript
// Verify each endpoint returns correct status codes and data

// POST /api/todos
test('creates a todo', async () => {
  const res = await fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify({ title: 'Test todo' }),
    headers: { 'Content-Type': 'application/json' }
  })
  expect(res.status).toBe(201)
  const todo = await res.json()
  expect(todo.title).toBe('Test todo')
  expect(todo.priority).toBe('medium')
})

// POST /api/todos — empty title
test('rejects empty title', async () => {
  const res = await fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify({ title: '' }),
    headers: { 'Content-Type': 'application/json' }
  })
  expect(res.status).toBe(400)
})

// GET /api/todos — unauthorized
test('returns 401 without session', async () => {
  const res = await fetch('/api/todos')
  expect(res.status).toBe(401)
})

// DELETE /api/todos/:id — cascade
test('cascade deletes subtasks', async () => {
  // Create todo, add subtasks, delete todo, verify subtasks are gone
})
```

---

## Out of Scope

The following features are covered in other PRPs and should **not** be implemented here:

- Priority badge colors and filtering → **PRP 02**
- Recurring todo logic and next instance creation → **PRP 03**
- Reminder timing and browser notifications → **PRP 04**
- Subtask CRUD and progress tracking → **PRP 05**
- Tag management and associations → **PRP 06**
- Template creation and usage → **PRP 07**
- Search and advanced filtering → **PRP 08**
- Export and import → **PRP 09**
- Calendar visualization → **PRP 10**
- WebAuthn authentication flow → **PRP 11**

However, the database schema and API routes defined here should **accommodate** these features (e.g., include `is_recurring`, `reminder_minutes`, `priority` fields in the schema).

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Todo creation success rate | 100% for valid inputs |
| API response time (GET /api/todos) | < 200ms for 500 todos |
| API response time (POST /api/todos) | < 100ms |
| E2E test pass rate | 100% |
| Cascade delete correctness | Subtasks and tag associations always cleaned up |
| Timezone accuracy | All dates display correctly in Singapore timezone |
| Input validation coverage | All invalid inputs produce clear error messages |

---

## Implementation Notes

### Project-Specific Patterns

1. **Database file**: `todos.db` in project root (SQLite via `better-sqlite3`)
2. **All DB operations are synchronous** — no `async/await` needed for queries
3. **Use prepared statements** (`db.prepare()`) for all queries to prevent SQL injection
4. **params is a Promise** in Next.js 16 — always `await params` in route handlers
5. **Handle null/undefined** with `?? null` or `?? 0` when passing fields to functions
6. **Client component** (`app/page.tsx`) manages all state and makes `fetch()` calls to API routes
7. **Never import `lib/db.ts`** in client components — only in API routes

### File Structure

```
app/
  page.tsx                    # Main UI (client component, 'use client')
  api/
    todos/
      route.ts                # GET (list), POST (create)
      [id]/
        route.ts              # GET (one), PUT (update), DELETE (delete)
lib/
  db.ts                       # Database schema, interfaces, CRUD operations
  auth.ts                     # Session management (getSession)
  timezone.ts                 # Singapore timezone utilities
middleware.ts                 # Route protection
```

### Dependencies

```json
{
  "better-sqlite3": "^11.x",
  "next": "^16.x",
  "react": "^19.x",
  "date-fns-tz": "^2.x"
}
```
