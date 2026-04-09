# PRP-01: Todo CRUD Operations

> **Foundation feature** — every other feature (priority, recurrence, reminders, tags, subtasks) builds on this.
> An agent reading only this file + `ARCHITECTURE.md` has enough context to implement the feature completely.

**Status:** Ready for implementation
**Priority:** P0 — Must ship first
**Dependencies:** None
**Depended on by:** PRP-02, PRP-03, PRP-04, PRP-05 (tags), PRP-06 (subtasks)

---

## 1. Feature Overview

Todo CRUD Operations form the irreducible core of the application. This feature delivers the complete lifecycle of a todo item: creation, display, editing, completion toggling, and deletion. Without it, no other feature can be built or tested.

The UI is organised into three semantically distinct sections rendered in a single scrollable page: **Overdue** (past due date, not completed), **Active / Pending** (not yet due or no due date, not completed), and **Completed** (toggled done). Each section is collapsible and shows a live item count in its header. Sections that contain zero items are hidden entirely to keep the UI clean.

All mutations use optimistic updates via TanStack Query so that the UI responds instantly while the network request is in flight. If the server returns an error, the mutation rolls back to the previous state and surfaces a user-facing toast. Due dates are stored as UTC ISO-8601 strings internally but always displayed in `Asia/Singapore` time (UTC+8). Never call `new Date()` directly — always go through `lib/timezone.ts`.

---

## 2. User Stories

**US-01 — Create a todo**
As a logged-in user, I want to type a title, optionally pick a due date, and press Enter (or click Add) so that a new todo appears immediately in the Pending section.

**US-02 — Complete a todo**
As a user, I want to click the checkbox next to a todo so that it moves instantly to the Completed section. If I accidentally complete a todo I want to uncheck it and have it return to its original section.

**US-03 — Edit a todo**
As a user, I want to click the edit icon on a todo to open a modal where I can update the title, due date, and other fields, then save. The list should reflect my changes without a full page reload.

**US-04 — Delete a todo**
As a user, I want to click a delete icon on a todo (with confirmation) so that it is permanently removed from the list.

**US-05 — View overdue todos prominently**
As a user who has not completed some todos by their due date, I want them grouped in a clearly coloured "Overdue" section at the top so that I immediately know what needs urgent attention.

**US-06 — Empty state**
As a new user with no todos, I want to see a friendly empty-state message encouraging me to create my first todo, rather than a blank screen.

**US-07 — Edge: whitespace-only title rejected**
As a user, if I submit a todo with only spaces/tabs in the title, the form should show a validation error and not submit.

**US-08 — Edge: past due date rejected on create**
As a user, if I pick a due date that is in the past (or less than 1 minute from now), the form should reject it with an inline error.

**US-09 — Edge: concurrent delete**
If another session deletes a todo that I try to edit, I should receive a clear "Todo not found" error rather than a silent failure.

---

## 3. Technical Requirements

### 3.1 Architecture Reference

| Concern | Location |
|---------|----------|
| DB operations | `lib/db/todos.ts` — synchronous (better-sqlite3) |
| API routes | `app/api/todos/route.ts`, `app/api/todos/[id]/route.ts` |
| API client | `lib/api/todos.ts` — async fetch wrappers |
| Shared types | `lib/types/todo.ts` |
| Timezone helpers | `lib/timezone.ts` — `nowSG()`, `toSGDisplay()`, `toUTC()` |
| TanStack hooks | `lib/hooks/useTodos.ts` |
| Components | `components/todos/` |
| Session auth | `lib/auth/session.ts` — `getUserFromRequest(req)` |

> **Next.js 16 rule:** Route params are async. Always `const { id } = await params` inside route handlers.
> **better-sqlite3 rule:** All DB calls are synchronous — do NOT `await` them.

### 3.2 Database Schema

```sql
-- Primary table
CREATE TABLE IF NOT EXISTS todos (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                TEXT    NOT NULL,
  completed            INTEGER NOT NULL DEFAULT 0,        -- 0 | 1 (SQLite boolean)
  due_date             TEXT,                              -- ISO-8601 UTC, nullable
  priority             TEXT    NOT NULL DEFAULT 'medium'
                         CHECK (priority IN ('high','medium','low')),
  is_recurring         INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern   TEXT
                         CHECK (recurrence_pattern IN ('daily','weekly','monthly','yearly') OR recurrence_pattern IS NULL),
  reminder_minutes     INTEGER,                           -- e.g. 60 means 1 hour before
  last_notification_sent TEXT,                           -- ISO-8601 UTC, nullable
  created_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Keep updated_at fresh on every write
CREATE TRIGGER IF NOT EXISTS todos_updated_at
AFTER UPDATE ON todos
FOR EACH ROW BEGIN
  UPDATE todos SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = OLD.id;
END;

-- Fast lookups by owner
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
-- Fast section queries
CREATE INDEX IF NOT EXISTS idx_todos_user_completed ON todos(user_id, completed);
-- Fast due-date ordering
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
```

### 3.3 API Endpoints

#### `GET /api/todos`

Returns all todos for the authenticated user, split into three groups.

**Request headers:** `Cookie: session=<token>`

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "overdue":   [ ...Todo[] ],
    "pending":   [ ...Todo[] ],
    "completed": [ ...Todo[] ]
  }
}
```

**Sorting rules:**
- `overdue`: `due_date ASC` (most overdue first)
- `pending`: `priority DESC` (high → medium → low), then `due_date ASC NULLS LAST`
- `completed`: `updated_at DESC` (most recently completed first)

**Error `401 Unauthorized`:**
```json
{ "success": false, "error": "Unauthorized" }
```

---

#### `POST /api/todos`

Creates a new todo.

**Request body:**
```json
{
  "title": "Buy milk",
  "due_date": "2026-04-10T10:00:00.000Z",
  "priority": "medium"
}
```

**Validation rules (server-side):**
- `title`: required, trimmed length ≥ 1
- `due_date`: optional; if provided, must be at least 60 seconds after `nowSG()`
- `priority`: optional, defaults to `'medium'`; must be `'high' | 'medium' | 'low'` if provided

**Response `201 Created`:**
```json
{
  "success": true,
  "data": { ...Todo }
}
```

**Error `400 Bad Request`:**
```json
{
  "success": false,
  "error": "Title is required",
  "field": "title"
}
```

---

#### `GET /api/todos/[id]`

Returns a single todo.

**Response `200 OK`:**
```json
{ "success": true, "data": { ...Todo } }
```

**Error `404 Not Found`:**
```json
{ "success": false, "error": "Todo not found" }
```

---

#### `PUT /api/todos/[id]`

Partial update — only fields provided are changed. At least one field must be present.

**Request body (all optional):**
```json
{
  "title": "Updated title",
  "completed": true,
  "due_date": "2026-04-15T08:00:00.000Z",
  "priority": "high"
}
```

**Response `200 OK`:**
```json
{ "success": true, "data": { ...Todo } }
```

---

#### `DELETE /api/todos/[id]`

Permanently deletes a todo (including cascade-deleted subtasks and tag assignments via FK).

**Response `200 OK`:**
```json
{ "success": true }
```

**Error `404 Not Found`:**
```json
{ "success": false, "error": "Todo not found" }
```

### 3.4 TypeScript Types

```typescript
// lib/types/todo.ts

export type Priority = 'high' | 'medium' | 'low'
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Todo {
  id: number
  user_id: number
  title: string
  completed: boolean
  due_date: string | null          // ISO-8601 UTC
  priority: Priority
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: number | null
  last_notification_sent: string | null
  created_at: string               // ISO-8601 UTC
  updated_at: string               // ISO-8601 UTC
}

export interface CreateTodoInput {
  title: string
  due_date?: string | null
  priority?: Priority
}

export interface UpdateTodoInput {
  title?: string
  completed?: boolean
  due_date?: string | null
  priority?: Priority
}

export interface TodosResponse {
  success: true
  data: {
    overdue: Todo[]
    pending: Todo[]
    completed: Todo[]
  }
}

export interface TodoResponse {
  success: true
  data: Todo
}

export interface ApiError {
  success: false
  error: string
  field?: string
}
```

---

## 4. React Components

### 4.1 Component Tree ASCII

```
app/page.tsx  ('use client')
└── AppShell
    └── main
        ├── TodoForm              (create new todo)
        └── TodoList              (server state via useTodos)
            ├── TodoSection[overdue]
            │   └── TodoItem[]
            │       └── TodoBadges
            ├── TodoSection[pending]
            │   └── TodoItem[]
            │       └── TodoBadges
            └── TodoSection[completed]
                └── TodoItem[]
                    └── TodoBadges

TodoItem (on edit click)
└── TodoEditModal
    └── TodoForm (edit mode, pre-filled)
```

### 4.2 Component Specs

#### `TodoForm`

**File:** `components/todos/TodoForm.tsx`
**Purpose:** Shared form for both create (inline) and edit (modal) modes.

**Props:**
```typescript
interface TodoFormProps {
  mode: 'create' | 'edit'
  initialValues?: Partial<CreateTodoInput>
  onSubmit: (values: CreateTodoInput) => Promise<void>
  onCancel?: () => void          // only in edit mode
  isLoading?: boolean
}
```

**Local state:**
```typescript
const [title, setTitle] = useState(initialValues?.title ?? '')
const [dueDate, setDueDate] = useState(initialValues?.due_date ?? '')
const [priority, setPriority] = useState<Priority>(initialValues?.priority ?? 'medium')
const [errors, setErrors] = useState<Record<string, string>>({})
```

**Validation (client-side, mirrors server):**
- `title.trim().length === 0` → `errors.title = 'Title is required'`
- If `dueDate` provided: parse with `lib/timezone.ts`; if < `nowSG() + 60s` → `errors.dueDate = 'Due date must be at least 1 minute in the future'`

**Events:**
- `onSubmit(e)`: `e.preventDefault()`, validate, call `props.onSubmit(payload)`, clear on success
- Title `input`: `onChange` updates title, clears `errors.title`
- Due-date `input[type=datetime-local]`: `onChange` updates dueDate in local SG time

**Design tokens:**
```
--color-surface-card       (form background)
--color-border-default     (input border)
--color-semantic-error     (error text + border)
--color-text-primary       (input text)
--color-text-placeholder   (placeholder)
--color-interactive-primary (submit button bg)
--color-interactive-primary-hover
--radius-md                (input + button border-radius)
--spacing-4                (gap between fields)
```

**Accessibility:**
- All inputs have `<label>` with `htmlFor` matching `id`
- Error messages use `role="alert"` and `aria-live="polite"`
- Submit button has `aria-busy={isLoading}`
- `data-testid="todo-form"`, `data-testid="todo-title-input"`, `data-testid="todo-due-date-input"`, `data-testid="todo-submit-btn"`

---

#### `TodoList`

**File:** `components/todos/TodoList.tsx`
**Purpose:** Reads TanStack Query data and renders three `TodoSection` components.

**Props:** none (reads `useTodos()` directly)

**Render logic:**
```typescript
const { data, isLoading, isError } = useTodos()
if (isLoading) return <TodoListSkeleton />
if (isError)   return <ErrorBanner message="Failed to load todos" />
const { overdue, pending, completed } = data
```

**Empty state:** If all three arrays are empty, render:
```html
<div data-testid="empty-state">
  <p>No todos yet. Add your first one above!</p>
</div>
```

**Design tokens:** `--color-surface-page` (list background)

---

#### `TodoSection`

**File:** `components/todos/TodoSection.tsx`
**Purpose:** Collapsible section with a coloured header.

**Props:**
```typescript
interface TodoSectionProps {
  variant: 'overdue' | 'pending' | 'completed'
  todos: Todo[]
  defaultOpen?: boolean
}
```

**Local state:** `const [open, setOpen] = useState(defaultOpen ?? true)`

**Display:** Hidden entirely (`return null`) when `todos.length === 0`.

**Header tokens by variant:**
| Variant | Token | Label |
|---------|-------|-------|
| `overdue` | `--color-semantic-error` | Overdue |
| `pending` | `--color-text-primary` | Active |
| `completed`| `--color-text-muted` | Completed |

**Accessibility:**
- Header is a `<button>` with `aria-expanded={open}`
- Section body has `id` matched by header's `aria-controls`
- `data-testid="section-overdue"`, `data-testid="section-pending"`, `data-testid="section-completed"`

---

#### `TodoItem`

**File:** `components/todos/TodoItem.tsx`
**Purpose:** Single todo row.

**Props:**
```typescript
interface TodoItemProps {
  todo: Todo
}
```

**Events:**
- Checkbox `onChange`: calls `updateTodo({ id, completed: !todo.completed })` optimistically
- Edit icon `onClick`: opens `TodoEditModal`
- Delete icon `onClick`: shows native `confirm()` dialog; on confirm calls `deleteTodo(id)`

**Due-date display (smart time):**

The urgency of a due date is communicated through colour. Compute `diffMs = dueDate - nowSG()`:

| Condition | Text colour token | Label example |
|-----------|------------------|---------------|
| `diffMs < 0` (overdue) | `--color-semantic-error` | "2h overdue" |
| `0 ≤ diffMs < 3_600_000` (< 1h) | `--color-semantic-error` | "in 45m" |
| `3_600_000 ≤ diffMs < 86_400_000` (< 24h) | `--color-semantic-warning` | "in 6h" |
| `86_400_000 ≤ diffMs < 604_800_000` (< 7d) | `--color-semantic-caution` | "in 3d" |
| `diffMs ≥ 604_800_000` (7d+) | `--color-semantic-info` | "Apr 15, 09:00" |

Use `lib/timezone.ts#formatDueDateDisplay(dueDate)` to generate the label string.

**Design tokens:**
```
--color-surface-card          (row background)
--color-surface-card-hover    (hover state)
--color-border-subtle         (row bottom border)
--color-text-primary          (title)
--color-text-muted            (completed todo, strikethrough)
```

**Accessibility:**
- Checkbox: `aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'}`
- Edit button: `aria-label="Edit todo"`
- Delete button: `aria-label="Delete todo"`
- `data-testid="todo-item-{todo.id}"`, `data-testid="todo-checkbox-{todo.id}"`, `data-testid="todo-edit-btn-{todo.id}"`, `data-testid="todo-delete-btn-{todo.id}"`

---

#### `TodoEditModal`

**File:** `components/todos/TodoEditModal.tsx`
**Purpose:** Modal wrapping `TodoForm` in edit mode.

**Props:**
```typescript
interface TodoEditModalProps {
  todo: Todo
  open: boolean
  onClose: () => void
}
```

**Render:** Uses a `<dialog>` element (or a `<div role="dialog" aria-modal="true">`). Closes on Escape key and overlay click. Traps focus inside while open.

**Design tokens:**
```
--color-surface-overlay   (backdrop rgba)
--color-surface-modal     (modal bg)
--shadow-lg               (modal elevation)
--radius-lg               (modal corners)
```

**Accessibility:**
- `aria-labelledby` pointing to modal title
- Focus moves to first interactive element on open
- `data-testid="todo-edit-modal"`

---

#### `TodoBadges`

**File:** `components/todos/TodoBadges.tsx`
**Purpose:** Renders a horizontal strip of small badges for priority, recurrence, and reminder. (Priority badge is minimal here; PRP-02 expands it.)

**Props:**
```typescript
interface TodoBadgesProps {
  todo: Todo
}
```

**Renders:**
1. Priority pill — minimal in PRP-01, see PRP-02 for full spec
2. Recurrence icon — minimal in PRP-01, see PRP-03
3. Reminder icon — minimal in PRP-01, see PRP-04

**data-testid:** `data-testid="todo-badges-{todo.id}"`

---

## 5. TanStack Query Hooks

### `useTodos`

**File:** `lib/hooks/useTodos.ts`

```typescript
// Query key factory
export const todoKeys = {
  all:    () => ['todos'] as const,
  lists:  () => ['todos', 'list'] as const,
  detail: (id: number) => ['todos', 'detail', id] as const,
}

// Query
export function useTodos() {
  return useQuery({
    queryKey: todoKeys.lists(),
    queryFn:  fetchTodos,           // GET /api/todos
    staleTime: 30_000,              // 30 s
    gcTime:    300_000,             // 5 min
  })
}

// Create mutation with optimistic update
export function useCreateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createTodo,          // POST /api/todos
    onMutate: async (newTodo) => {
      await qc.cancelQueries({ queryKey: todoKeys.lists() })
      const prev = qc.getQueryData<TodosResponse>(todoKeys.lists())
      qc.setQueryData(todoKeys.lists(), (old: TodosResponse) => ({
        ...old,
        data: {
          ...old.data,
          pending: [
            { ...newTodo, id: Date.now(), completed: false, created_at: nowSG().toISOString(), updated_at: nowSG().toISOString() },
            ...old.data.pending,
          ],
        },
      }))
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(todoKeys.lists(), ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.lists() }),
  })
}

// Update mutation with optimistic update
export function useUpdateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & UpdateTodoInput) =>
      updateTodo(id, data),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: todoKeys.lists() })
      const prev = qc.getQueryData<TodosResponse>(todoKeys.lists())
      qc.setQueryData(todoKeys.lists(), (old: TodosResponse) =>
        patchTodoInGroups(old, id, data)
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(todoKeys.lists(), ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.lists() }),
  })
}

// Delete mutation with optimistic update
export function useDeleteTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteTodo,
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: todoKeys.lists() })
      const prev = qc.getQueryData<TodosResponse>(todoKeys.lists())
      qc.setQueryData(todoKeys.lists(), (old: TodosResponse) =>
        removeTodoFromGroups(old, id)
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(todoKeys.lists(), ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.lists() }),
  })
}
```

**Helper functions (same file):**
- `patchTodoInGroups(state, id, patch)` — immutably updates a todo across all three groups
- `removeTodoFromGroups(state, id)` — immutably removes a todo from whichever group it lives in

---

## 6. State Management

| State | Type | Location | Notes |
|-------|------|----------|-------|
| Todo list data | Server state | TanStack Query `todoKeys.lists()` | Source of truth |
| Edit modal open/target | Local UI | `TodoList` or `TodoItem` | `useState<Todo \| null>` |
| Section collapse state | Local UI | `TodoSection` | `useState<boolean>` |
| Form field values | Local UI | `TodoForm` | Controlled inputs |
| Auth user | Context | `AuthContext` | Read for `user_id` guard |

**URL state:** No URL state in PRP-01 (filter by tag/priority comes in later PRPs).

---

## 7. Test Specifications

### 7.1 E2E Tests (Playwright)

**File:** `e2e/todo-crud.spec.ts`

#### Test: Create a todo

```
Steps:
1. Navigate to / (logged-in session via storageState fixture)
2. Locate [data-testid="todo-title-input"]
3. Fill "Buy milk"
4. Click [data-testid="todo-submit-btn"]
Assertions:
- [data-testid="section-pending"] is visible
- Within section-pending: text "Buy milk" is visible
- [data-testid="todo-title-input"] value is empty (reset)
```

#### Test: Complete a todo

```
Steps:
1. Create a todo "Walk the dog" (via API helper for speed)
2. Navigate to /
3. Locate [data-testid="todo-checkbox-{id}"]
4. Click checkbox
Assertions:
- Todo disappears from section-pending
- [data-testid="section-completed"] contains "Walk the dog"
```

#### Test: Edit a todo

```
Steps:
1. Create todo "Draft email" via API helper
2. Navigate to /
3. Click [data-testid="todo-edit-btn-{id}"]
4. [data-testid="todo-edit-modal"] is visible
5. Clear title input, fill "Draft quarterly email"
6. Click save button inside modal
Assertions:
- Modal closes
- "Draft quarterly email" is visible in pending section
- "Draft email" no longer visible
```

#### Test: Delete a todo

```
Steps:
1. Create todo "Old task" via API helper
2. Navigate to /
3. page.on('dialog', d => d.accept())   // accept confirm
4. Click [data-testid="todo-delete-btn-{id}"]
Assertions:
- "Old task" is no longer present in the DOM
```

#### Test: Validation — empty title

```
Steps:
1. Navigate to /
2. Click [data-testid="todo-submit-btn"] without entering a title
Assertions:
- [role="alert"] containing "Title is required" is visible
- No new todo appears in the list
```

#### Test: Validation — past due date

```
Steps:
1. Navigate to /
2. Fill [data-testid="todo-title-input"] "Future task"
3. Fill [data-testid="todo-due-date-input"] with a datetime 30 seconds from now
4. Click [data-testid="todo-submit-btn"]
Assertions:
- [role="alert"] containing "at least 1 minute" is visible
```

#### Test: Empty state

```
Steps:
1. Clear all todos for user via API helper
2. Navigate to /
Assertions:
- [data-testid="empty-state"] is visible
- No section headers visible
```

### 7.2 Unit Tests

**File:** `lib/db/todos.test.ts`

| Function | Input | Expected Output |
|----------|-------|-----------------|
| `createTodo` | `{user_id:1, title:'A', priority:'high'}` | Todo object with `id`, `priority:'high'`, `completed:false` |
| `createTodo` | `{user_id:1, title:'  '}` | throws `Error('Title is required')` |
| `getTodosByUser` | user_id with 2 todos | Array of length 2 |
| `updateTodo` | `{id:1, title:'New'}` | Returns todo with `title:'New'` |
| `updateTodo` | id that does not exist | throws `Error('Todo not found')` |
| `deleteTodo` | existing id | Returns `{ success: true }` |
| `deleteTodo` | non-existent id | throws `Error('Todo not found')` |

**File:** `lib/timezone.test.ts`

| Function | Input | Expected |
|----------|-------|----------|
| `toSGDisplay` | `'2026-04-10T02:00:00.000Z'` | `'Apr 10, 2026 10:00'` (UTC+8) |
| `formatDueDateDisplay` | date 30min from now | string starting with `'in '` |
| `formatDueDateDisplay` | date 2h ago | string ending with `'overdue'` |

**File:** `components/todos/TodoForm.test.tsx`

| Scenario | Setup | Assertion |
|----------|-------|-----------|
| submit empty title | render, click submit | `getByRole('alert')` contains "Title is required" |
| submit valid title | render, fill "Test", click submit | `onSubmit` called with `{ title: 'Test' }` |
| cancel in edit mode | render with mode='edit', click cancel | `onCancel` called |

### 7.3 Integration Tests

**File:** `app/api/todos/route.test.ts`

```
POST /api/todos
- valid body → 201 + todo in response
- missing title → 400 + error.field === 'title'
- unauthenticated → 401
- past due_date → 400

GET /api/todos
- authenticated → 200 + { overdue, pending, completed }
- unauthenticated → 401

PUT /api/todos/[id]
- valid update → 200 + updated todo
- wrong user_id → 404 (ownership check)
- unknown id → 404

DELETE /api/todos/[id]
- known id, owner → 200
- unknown id → 404
```

---

## 8. Acceptance Criteria

1. A logged-in user can create a todo with a non-empty, non-whitespace title and have it appear in the Pending section without a page reload.
2. A logged-in user can create a todo with a due date that is at least 1 minute in the future.
3. Submitting a form with an empty or whitespace-only title displays an inline error and does not create a record.
4. Submitting a form with a due date less than 1 minute in the future displays an inline error and does not create a record.
5. Clicking the checkbox on a Pending todo moves it to the Completed section optimistically (before network response).
6. Clicking the checkbox on a Completed todo moves it back to Pending or Overdue as appropriate.
7. Clicking the edit icon opens the `TodoEditModal` pre-filled with the todo's current values.
8. Saving an edit updates the todo in the list without a full page reload.
9. Clicking the delete icon and confirming the dialog permanently removes the todo from the list.
10. The Overdue section appears at the top, with overdue items displayed in `--color-semantic-error`.
11. Due-date labels use the correct colour token based on urgency tier (overdue/< 1h/< 24h/< 7d/7d+).
12. All three sections hide themselves when they contain zero items.
13. When all three sections are empty, `[data-testid="empty-state"]` is visible.
14. All API routes return `401` for unauthenticated requests.
15. DB operations use synchronous better-sqlite3 calls (no `await` on DB functions).
16. Route params use `const { id } = await params` (Next.js 16 async params).
17. All dates displayed in Singapore timezone (UTC+8).
18. Optimistic updates roll back on network error with user-facing error message.

---

## 9. Integration Points

### 9.1 What This Feature Consumes

| Dependency | Location | Usage |
|------------|----------|-------|
| `users` table | `lib/db/users.ts` | FK constraint on `todos.user_id` |
| Session auth | `lib/auth/session.ts` | Every API route calls `getUserFromRequest(req)` |
| `lib/timezone.ts` | Shared utility | `nowSG()`, `toSGDisplay()`, `formatDueDateDisplay()` |

### 9.2 What This Feature Exposes

| Export | Consumers |
|--------|-----------|
| `todos` table schema | PRP-02 (priority), PRP-03 (recurrence), PRP-04 (reminders) — all `ALTER TABLE` |
| `todoKeys` query key factory | PRP-02, PRP-03, PRP-04 — all invalidate `todoKeys.lists()` |
| `useTodos`, `useUpdateTodo` hooks | PRP-02 (sort by priority), PRP-03 (complete → spawn next), PRP-04 (reminder UI) |
| `Todo` type | All downstream PRPs extend or use it |
| `TodoForm` component | PRP-02 adds priority field, PRP-03 adds recurrence fields, PRP-04 adds reminder dropdown |
| `TodoItem` component | PRP-02 adds `PriorityBadge`, PRP-03 adds `RecurrenceBadge`, PRP-04 adds reminder icon |
| `GET /api/todos` response shape | `TodosResponse` type — downstream hooks depend on `data.overdue / pending / completed` |

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Whitespace-only title | Client + server validation: trim, reject if empty |
| Due date < 1 min in future | Client + server: compare with `nowSG() + 60_000ms` |
| Due date exactly now | Reject (< 1 minute rule applies) |
| Very long title (>500 chars) | Server: `400` with error; Client: `maxLength={500}` on input |
| Update a completed todo's due date | Allowed; does not change `completed` flag |
| Toggle complete on overdue todo | Moves to Completed; does not modify `due_date` |
| Delete a todo that has subtasks | Cascade delete via FK (set up in subtask schema, PRP-05) |
| Network timeout on create | Optimistic item shown; on error removed + toast "Failed to create todo" |
| Concurrent edit from two sessions | Last-write-wins (SQLite serialises writes); no conflict resolution needed |
| User tries to read another user's todo | Server: `404` (not `403`) to avoid enumeration |
| Session expired mid-session | API returns `401`; client redirects to `/login` |
| `due_date` stored in wrong timezone | Guard: always convert user local input to UTC before storing |
| `id` in route is not a number | `parseInt(id, 10)` → if `NaN`, return `400 Bad Request` |

---

## 11. Out of Scope

The following are explicitly NOT part of PRP-01 and will be addressed in separate PRPs:

- Priority levels beyond what's stored in the schema (UI in PRP-02)
- Recurring todo logic (PRP-03)
- Reminder / notification system (PRP-04)
- Tags (separate PRP)
- Subtasks and progress bars (separate PRP)
- Todo templates (separate PRP)
- Calendar view (separate PRP)
- Import / export (separate PRP)
- Search and full-text filtering (separate PRP)
- Drag-and-drop reordering
- Undo/redo beyond TanStack Query rollback

---

## 12. Singapore Timezone Considerations

All temporal logic MUST go through `lib/timezone.ts`. Never use `new Date()` or `Date.now()` directly in business logic.

```typescript
// lib/timezone.ts  (contract — do not change signatures)

const SG_TZ = 'Asia/Singapore'  // UTC+8, no DST

/** Current time as a Date object adjusted to SG wall-clock */
export function nowSG(): Date { ... }

/** Format a UTC ISO string for SG display */
export function toSGDisplay(isoUTC: string): string { ... }
// e.g. '2026-04-10T02:00:00Z' → 'Apr 10, 2026 10:00'

/** Convert a datetime-local string (from an SG-locale browser input) to UTC ISO */
export function toUTC(localSGString: string): string { ... }

/**
 * Smart due-date label with urgency tier
 * Returns e.g. "2h overdue", "in 45m", "in 6h", "in 3d", "Apr 15, 09:00"
 */
export function formatDueDateDisplay(isoUTC: string): string { ... }
```

**Key rules:**
1. `datetime-local` HTML inputs emit values in the **browser's local timezone**. In Singapore, this is already UTC+8 — but do not assume. Always call `toUTC()` before storing.
2. When displaying dates to the user, always call `toSGDisplay()`.
3. The "1 minute in the future" validation on due dates must compare against `nowSG()`, not `new Date()`, to be consistent with stored times.
4. Tests that assert on time-based display strings must either mock `nowSG()` or use relative assertions (e.g., "contains 'overdue'").
