# PRP-05: Subtasks & Progress Tracking

**Depends on:** PRP-01 (Todo CRUD Operations)
**Feature:** Checklist items within a todo with visual progress bar
**Last updated:** 2026-04-08

---

## 1. Feature Overview

Subtasks allow users to break a single todo into smaller, trackable checklist items. Each todo can have zero or more subtasks, each with its own completion state and a title. Subtasks are displayed in an expandable panel beneath the parent todo item, reducing visual clutter while keeping progress information accessible.

A visual progress bar summarises the completion ratio at a glance. The bar is rendered inline within the todo card when subtasks exist. It transitions from blue (#3B82F6) to green (#10B981) once all subtasks are done, giving users a clear "done" signal without needing to open the subtask list.

Subtask ordering is explicit via an integer `position` field assigned as `max(position) + 1` on creation. Reordering is out of scope for this PRP but the column exists to support it later. When a parent todo is deleted the database CASCADE ensures all its subtasks are removed automatically, requiring no application-level cleanup code.

---

## 2. User Stories

1. **As a user**, I want to add checklist steps to a todo so that I can track partial progress on multi-step tasks.
2. **As a user**, I want to check off individual subtasks so that completed work is visually distinguished from remaining work.
3. **As a user**, I want to see a progress bar on any todo that has subtasks so that I know at a glance how close I am to finishing.
4. **As a user**, I want to delete a subtask I no longer need without affecting the parent todo or other subtasks.
5. **As a user (edge case)**, when I delete a todo that has subtasks, all subtasks are removed automatically so that I do not leave orphaned data.
6. **As a user (edge case)**, when a todo has zero subtasks the progress bar is not rendered, keeping the UI clean.
7. **As a user (edge case)**, when all subtasks are completed the progress bar turns green and shows 100%, providing a satisfying completion signal.

---

## 3. Technical Requirements

### 3.1 Architecture Reference

| Layer | File | Responsibility |
|-------|------|---------------|
| DB module | `lib/db/subtasks.ts` | CRUD helpers using better-sqlite3 (synchronous) |
| DB migration | `lib/db/connection.ts` | `CREATE TABLE IF NOT EXISTS subtasks …` called in schema init |
| API routes | `app/api/todos/[id]/subtasks/route.ts` | POST – create subtask |
| API routes | `app/api/subtasks/[id]/route.ts` | PUT – update, DELETE – delete |
| API client | `lib/api/subtasks.ts` | `createSubtask`, `updateSubtask`, `deleteSubtask` |
| Types | `lib/types/subtask.ts` | `Subtask`, `CreateSubtaskDto`, `UpdateSubtaskDto` |
| Hook | `lib/hooks/useSubtasks.ts` | TanStack Query mutations + query |
| Components | `components/subtasks/` | `SubtaskList`, `SubtaskItem`, `SubtaskForm`, `ProgressBar` |

All database operations use **synchronous** better-sqlite3 calls (no async/await inside DB modules). API route handlers are `async` and call synchronous DB helpers.

### 3.2 Database Schema

```sql
-- Add to lib/db/connection.ts schema initialisation block
CREATE TABLE IF NOT EXISTS subtasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id     INTEGER NOT NULL,
  title       TEXT    NOT NULL,
  completed   INTEGER NOT NULL DEFAULT 0,   -- 0 = false, 1 = true
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id   ON subtasks(todo_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_position  ON subtasks(todo_id, position);
```

**Position assignment rule:** `SELECT COALESCE(MAX(position), -1) + 1 FROM subtasks WHERE todo_id = ?` – executed inside `subtaskDB.create()` within a transaction to prevent race conditions.

### 3.3 API Endpoints

#### POST `/api/todos/[id]/subtasks`

Creates a new subtask for the todo identified by `[id]`.

**Request body:**
```typescript
{ title: string }  // 1–200 characters
```

**Response `201`:**
```typescript
{
  success: true,
  data: Subtask   // newly created subtask including auto-assigned position
}
```

**Errors:**
- `400` – missing/empty title or title > 200 chars
- `404` – parent todo not found or does not belong to the authenticated user
- `401` – unauthenticated

---

#### PUT `/api/subtasks/[id]`

Updates title and/or completed state of an existing subtask.

**Request body (all fields optional, at least one required):**
```typescript
{
  title?:     string   // 1–200 chars
  completed?: boolean
}
```

**Response `200`:**
```typescript
{
  success: true,
  data: Subtask   // updated subtask
}
```

**Errors:**
- `400` – validation failure
- `404` – subtask not found or user does not own parent todo
- `401` – unauthenticated

---

#### DELETE `/api/subtasks/[id]`

Permanently deletes a subtask.

**Response `200`:**
```typescript
{ success: true }
```

**Errors:**
- `404` – subtask not found or unauthorised
- `401` – unauthenticated

---

### 3.4 TypeScript Types

```typescript
// lib/types/subtask.ts

export interface Subtask {
  id:         number
  todo_id:    number
  title:      string
  completed:  boolean
  position:   number
  created_at: string   // ISO 8601, Singapore TZ
}

export interface CreateSubtaskDto {
  title: string
}

export interface UpdateSubtaskDto {
  title?:     string
  completed?: boolean
}
```

```typescript
// lib/types/todo.ts  (extend existing Todo interface)
// Add optional field:
subtasks?: Subtask[]   // populated when todos are fetched with subtask data
```

---

## 4. React Components

### 4.1 Component Tree (ASCII)

```
TodoItem
└── SubtaskList (expandable, shown when todo has subtasks OR user clicks "Add subtask")
    ├── ProgressBar        (rendered above subtask rows; hidden when subtasks.length === 0)
    ├── SubtaskItem[]      (one per existing subtask)
    │   ├── Checkbox       (common/Checkbox.tsx)
    │   ├── <span> title
    │   └── <button> delete
    └── SubtaskForm        (inline text input + submit; always visible inside SubtaskList)
```

---

### 4.2 Component Specifications

#### `SubtaskList`

**File:** `components/subtasks/SubtaskList.tsx` (≤ 120 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `todoId` | `number` | ✓ | Parent todo identifier |
| `initialExpanded` | `boolean` | — | Default `false` |

**Internal state:**
- `isExpanded: boolean` — toggled by clicking the expand button on `TodoItem`
- Subtask data fetched via `useSubtasks(todoId)`

**Design tokens:**
- Container border: `var(--color-border-subtle)` (1px solid)
- Background: `var(--color-surface-raised)` (slight elevation from card)
- Padding: `var(--spacing-3)` (12 px)

**Accessibility:**
- `aria-expanded` on the toggle button
- `aria-label="Subtasks for: {todoTitle}"`
- List rendered as `<ul role="list">`

---

#### `SubtaskItem`

**File:** `components/subtasks/SubtaskItem.tsx` (≤ 100 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `subtask` | `Subtask` | ✓ | The subtask object |
| `onToggle` | `(id: number, completed: boolean) => void` | ✓ | Fires when checkbox changes |
| `onDelete` | `(id: number) => void` | ✓ | Fires when delete button clicked |

**Design tokens:**
- Completed title: `text-[var(--color-text-muted)]` with `line-through`
- Delete button icon: `var(--color-danger-icon)` on hover
- Row height: `var(--spacing-8)` (32 px)

**Accessibility:**
- Checkbox `aria-label="Complete subtask: {title}"`
- Delete button `aria-label="Delete subtask: {title}"`

---

#### `SubtaskForm`

**File:** `components/subtasks/SubtaskForm.tsx` (≤ 80 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `todoId` | `number` | ✓ | Parent todo id |
| `onAdd` | `(subtask: Subtask) => void` | ✓ | Called after successful creation |

**Local state:**
- `inputValue: string`
- `isSubmitting: boolean`

**Behaviour:**
- Submit on Enter key or clicking the "+" button
- Clears input after success
- Shows inline error if title is empty or > 200 chars
- Debounce is NOT required (immediate submission)

**Design tokens:**
- Input border: `var(--color-border-default)` → `var(--color-border-focus)` on focus
- Submit button: `var(--color-primary)` fill

**Accessibility:**
- `aria-label="Add subtask"` on input
- `data-testid="subtask-input"` on input
- `data-testid="subtask-submit"` on submit button

---

#### `ProgressBar`

**File:** `components/subtasks/ProgressBar.tsx` (≤ 60 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `total` | `number` | ✓ | Total subtask count |
| `completed` | `number` | ✓ | Completed subtask count |

**Rendering logic:**
```typescript
const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
const color = percent === 100 ? '#10B981' : '#3B82F6'
```
- Returns `null` when `total === 0` (no subtasks)
- Displays `"{completed}/{total}"` text label alongside the bar

**Design tokens:**
- Track background: `var(--color-surface-sunken)` (grey trough)
- Bar height: `var(--spacing-2)` (8 px)
- Border radius: `var(--radius-full)` (pill shape)

**Accessibility:**
- `<div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Subtask progress">`
- `data-testid="progress-bar"`
- `data-testid="progress-bar-fill"` on the inner fill element

---

## 5. TanStack Query Hooks

### `useSubtasks(todoId: number)`

**File:** `lib/hooks/useSubtasks.ts`

```typescript
// Query key factory
const subtaskKeys = {
  all:        ['subtasks'] as const,
  byTodo:     (todoId: number) => ['subtasks', todoId] as const,
}

// Query (subtasks are embedded in the todo — fetch via todos query)
// Subtask state is derived from useTodos() data; no separate GET endpoint.
// Mutations below call their respective endpoints then invalidate todos query.

export function useSubtasks(todoId: number) {
  const queryClient = useQueryClient()

  const createSubtask = useMutation({
    mutationFn: (dto: CreateSubtaskDto) => apiCreateSubtask(todoId, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })

  const updateSubtask = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateSubtaskDto }) =>
      apiUpdateSubtask(id, dto),
    onMutate: async ({ id, dto }) => {
      // Optimistic update: flip completed flag immediately
      await queryClient.cancelQueries({ queryKey: ['todos'] })
      const previous = queryClient.getQueryData(['todos'])
      queryClient.setQueryData(['todos'], (old: Todo[] | undefined) =>
        (old ?? []).map(todo =>
          todo.id === todoId
            ? {
                ...todo,
                subtasks: (todo.subtasks ?? []).map(s =>
                  s.id === id ? { ...s, ...dto } : s
                ),
              }
            : todo
        )
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['todos'], ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })

  const deleteSubtask = useMutation({
    mutationFn: (id: number) => apiDeleteSubtask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })

  return { createSubtask, updateSubtask, deleteSubtask }
}
```

**Stale/cache times:** Subtask data lives inside the `todos` query cache entry (staleTime: 30 s, gcTime: 5 min — inherited from `useTodos`).

**Optimistic updates:** Toggle completion is applied optimistically with rollback on error (see `onMutate` above).

**Invalidation targets on mutation:** `['todos']` — causes `useTodos` to refetch, which includes subtasks in the response payload.

---

## 6. State Management

| Context | Read | Written |
|---------|------|---------|
| `QueryClient` | `useQueryClient()` | `invalidateQueries(['todos'])` after every subtask mutation |

**Local state per `SubtaskList`:**
- `isExpanded: boolean` — toggles the subtask panel open/closed

**URL state:** None — subtask expansion is ephemeral UI state, not persisted to URL.

**Derived state:**
```typescript
// Inside TodoItem / SubtaskList
const subtasks = todo.subtasks ?? []
const completedCount = subtasks.filter(s => s.completed).length
const percent = subtasks.length === 0 ? 0 : Math.round((completedCount / subtasks.length) * 100)
```

---

## 7. Test Specifications

### 7.1 E2E Tests (Playwright)

**File:** `tests/06-subtasks-progress.spec.ts`

#### Test: "Add a subtask to a todo"
```
1. Navigate to / (logged in as test user)
2. Create a todo "Buy groceries" via [data-testid="todo-form-input"]
3. Click [data-testid="expand-subtasks-{todoId}"] to open subtask panel
4. Assert [data-testid="subtask-list-{todoId}"] is visible
5. Type "Buy milk" into [data-testid="subtask-input"]
6. Click [data-testid="subtask-submit"]
7. Assert [data-testid="subtask-item-{subtaskId}"] appears with text "Buy milk"
8. Assert [data-testid="progress-bar"] shows aria-valuenow="0" (0/1 completed)
```

#### Test: "Complete a subtask updates progress bar"
```
1. Setup: todo with 2 subtasks "Step A", "Step B"
2. Check [data-testid="subtask-checkbox-{idA}"]
3. Assert [data-testid="progress-bar-fill"] has width ~50%
4. Assert progress bar color is #3B82F6
5. Check [data-testid="subtask-checkbox-{idB}"]
6. Assert [data-testid="progress-bar-fill"] has width 100%
7. Assert progress bar color is #10B981
```

#### Test: "Delete a subtask"
```
1. Setup: todo with 1 subtask "Remove me"
2. Click [data-testid="delete-subtask-{id}"]
3. Assert [data-testid="subtask-item-{id}"] is not present in DOM
4. Assert [data-testid="progress-bar"] is not rendered (no subtasks remain)
```

#### Test: "Deleting parent todo removes subtasks"
```
1. Setup: todo "Parent" with subtasks "Child A", "Child B"
2. Note subtask ids
3. Delete the parent todo via API: DELETE /api/todos/{todoId}
4. Assert GET /api/todos/{todoId} returns 404
5. Assert subtask rows are absent from DB (integration assertion)
```

#### Test: "Progress bar not shown when no subtasks"
```
1. Create a todo without any subtasks
2. Assert [data-testid="progress-bar"] does not exist in todo card
```

---

### 7.2 Unit Tests

**File:** `lib/db/subtasks.test.ts`

| Function | Input | Expected Output |
|----------|-------|----------------|
| `subtaskDB.create(todoId, {title})` | `todoId=1, {title:"Step 1"}` | Returns `Subtask` with `position=0`, `completed=false` |
| `subtaskDB.create(todoId, {title})` (second call) | Same `todoId` | Returns `Subtask` with `position=1` |
| `subtaskDB.update(id, {completed:true})` | `id=1, {completed:true}` | Returns updated subtask with `completed=true` |
| `subtaskDB.delete(id)` | `id=1` | Row no longer exists in DB |
| `subtaskDB.findByTodoId(todoId)` | `todoId=1` | Returns array ordered by `position ASC` |

**File:** `components/subtasks/ProgressBar.test.tsx`

| Scenario | Props | Expected |
|----------|-------|----------|
| No subtasks | `total=0, completed=0` | Renders nothing (`null`) |
| Half done | `total=4, completed=2` | `aria-valuenow=50`, fill color `#3B82F6` |
| All done | `total=3, completed=3` | `aria-valuenow=100`, fill color `#10B981` |
| Rounding | `total=3, completed=1` | `aria-valuenow=33` (Math.round(33.33)) |

---

### 7.3 Integration Tests

**File:** `tests/contracts/todo-subtasks.contract.test.ts`

```
1. POST /api/todos (create todo) → assert 201, save todoId
2. POST /api/todos/{todoId}/subtasks {title:"A"} → assert 201, subtask.todo_id === todoId
3. POST /api/todos/{todoId}/subtasks {title:"B"} → assert position=1 (incremented)
4. PUT /api/subtasks/{idA} {completed:true} → assert 200, subtask.completed === true
5. DELETE /api/subtasks/{idA} → assert 200
6. GET /api/todos (includes subtasks) → todo.subtasks length === 1
7. DELETE /api/todos/{todoId} → assert 200
8. Verify via direct DB query: subtasks WHERE todo_id={todoId} returns 0 rows
```

---

## 8. Acceptance Criteria

1. A user can add a subtask (1–200 characters) to any existing todo.
2. A user can check/uncheck a subtask; the UI updates immediately (optimistic update).
3. The progress bar is visible on a todo card if and only if `subtasks.length >= 1`.
4. Progress percentage is `Math.round(completed / total * 100)`.
5. The progress bar fill is `#10B981` (green) when progress = 100%, `#3B82F6` (blue) otherwise.
6. A user can delete an individual subtask without affecting other subtasks or the parent todo.
7. Deleting a parent todo removes all of its subtasks from the database (verified via DB or API).
8. Subtasks appear in `position ASC` order.
9. Newly added subtasks appear at the bottom of the list (`position = max + 1`).
10. An empty subtask title is rejected with a `400` error.
11. A subtask title longer than 200 characters is rejected with a `400` error.
12. The subtask panel is collapsed by default; clicking the expand control reveals it.
13. `aria-expanded` reflects the actual expanded state of the subtask panel.
14. Progress bar has `role="progressbar"` and correct `aria-valuenow`.

---

## 9. Integration Points

### 9.1 What This Feature Consumes

| Feature | Usage |
|---------|-------|
| PRP-01 Todo CRUD | `todos` table (FK `todo_id`), `useTodos` query (subtasks embedded in response), authenticated session |
| `lib/db/connection.ts` | Schema init must include `CREATE TABLE IF NOT EXISTS subtasks` |
| `lib/types/todo.ts` | `Todo.subtasks?: Subtask[]` field added |
| `common/Checkbox.tsx` | Reused for subtask completion toggle |
| `common/Button.tsx` | Reused for delete and submit buttons |
| `lib/timezone.ts` | `getSingaporeNow()` for `created_at` timestamp |

### 9.2 What This Feature Exposes

| Artifact | Consumed by |
|----------|-------------|
| `lib/types/subtask.ts` (`Subtask`, `CreateSubtaskDto`, `UpdateSubtaskDto`) | PRP-07 Template System (serialises subtasks to JSON) |
| `lib/db/subtasks.ts` | PRP-07 (creates subtasks when a template is used) |
| `lib/hooks/useSubtasks.ts` | `TodoItem` component, template use flow |
| `ProgressBar` component | Any future feature needing a progress visualisation |
| `subtasks_json` pattern | PRP-07 stores subtask blueprints as `[{title, position}][]` |

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Empty title submitted | `400 Bad Request` with `{ success: false, error: "Title is required" }` |
| Title > 200 characters | `400 Bad Request` with `{ success: false, error: "Title must be ≤ 200 characters" }` |
| `todoId` does not exist | `404 Not Found` with `{ success: false, error: "Todo not found" }` |
| `todoId` belongs to another user | `404 Not Found` (do not leak existence information) |
| `subtaskId` does not exist | `404 Not Found` |
| Concurrent toggle of same subtask | Last write wins; TanStack Query refetch reconciles state |
| Network error during optimistic update | `onError` rolls back the optimistic change in query cache |
| All subtasks deleted | Progress bar unmounts (returns `null`); expand panel stays open but shows "No subtasks yet" |
| Todo has 0 subtasks but panel is open | `SubtaskForm` is the only content; no progress bar |
| Parent todo marked complete before subtasks done | Allowed — subtasks track independently from parent completion |
| Very long title at display (≤200 chars) | Truncate with CSS `truncate` class and full title in `title` attribute |
| Rapid successive creates | Each create invalidates `todos` query; UI shows loading indicator via `isPending` |

---

## 11. Out of Scope

- Drag-and-drop reordering of subtasks (position column exists for future use)
- Nested subtasks (subtask of a subtask)
- Subtask due dates or individual reminder settings
- Subtask assignment to different users
- Bulk operations (check all / uncheck all)
- Subtask search

---

## 12. Singapore Timezone Considerations

- `created_at` stored as `datetime('now')` in SQLite (UTC). When exposing via API, convert to Singapore ISO 8601 using `lib/timezone.ts → toSingaporeISO(utcString)`.
- Do **not** call `new Date()` directly in any module; use `getSingaporeNow()` from `lib/timezone.ts`.
- E2E tests set `TZ=Asia/Singapore` in `playwright.config.ts` — ensure this env var is present so date assertions match.
- Subtasks have no due date field, so timezone impact is limited to `created_at` display only.
- If a feature adds subtask due dates in the future, reference `lib/timezone.ts` patterns from PRP-01.
