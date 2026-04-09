# PRP-02: Priority System

> **Layer on top of PRP-01** — adds visual priority to existing todos.
> An agent reading only this file + `ARCHITECTURE.md` + PRP-01 has enough context to implement the feature completely.

**Status:** Ready for implementation
**Priority:** P1
**Dependencies:** PRP-01 (Todo CRUD Operations) — `todos` table and all its hooks/components must exist
**Depended on by:** None directly; enhances UX for PRP-03, PRP-04

---

## 1. Feature Overview

The Priority System gives users a three-tier urgency classification for their todos: **high**, **medium**, and **low**. The schema column `priority` already exists (added by PRP-01 with `DEFAULT 'medium'`), so this PRP is entirely about surfacing it in the UI and controlling sort order.

Priority is expressed through colour-coded badge pills that appear inside `TodoBadges`. The colours map to semantic design tokens so they work correctly in both light and dark mode and meet WCAG AA contrast requirements. A dropdown on the `TodoForm` lets users set (or change) priority when creating or editing a todo. A filter dropdown in the `TodoList` header lets users narrow the view to a single priority tier.

Sort order within the **Pending** and **Overdue** sections changes from simple `due_date ASC` to a two-key sort: `priority DESC` (high → medium → low encoded as 3/2/1), then `due_date ASC NULLS LAST`. The **Completed** section retains its `updated_at DESC` order regardless of priority.

---

## 2. User Stories

**US-01 — Set priority on create**
As a user, when I create a new todo I want to choose high, medium, or low priority from a dropdown (defaulting to medium) so that my list is immediately sorted by urgency.

**US-02 — Change priority via edit**
As a user, I want to open the edit modal for an existing todo and change its priority, and see the badge and position in the list update after I save.

**US-03 — Visual priority at a glance**
As a user, I want to see a small coloured badge (High / Medium / Low) on every todo item so that I can scan my list by urgency without opening anything.

**US-04 — Filter by priority**
As a user, I want to pick "High only", "Medium only", "Low only", or "All" from a filter control so that I can focus on a single urgency tier.

**US-05 — Correct sort order**
As a user, I want high-priority todos to appear before medium, and medium before low, within each section, with ties broken by due date (earliest first).

**US-06 — Edge: changing a high todo to low**
As a user, when I downgrade a high todo to low, it should move to the bottom of its section immediately (optimistic update).

**US-07 — Edge: filter + section interaction**
As a user, if I filter to "High only" and a section has no high todos, that section should hide (same zero-item rule as PRP-01).

**US-08 — Edge: WCAG contrast**
The priority badge colours must pass WCAG AA (4.5:1 for normal text) in both light and dark themes.

---

## 3. Technical Requirements

### 3.1 Architecture Reference

| Concern | Location |
|---------|----------|
| DB schema | `todos` table — `priority` column already exists (PRP-01) |
| API routes | `app/api/todos/route.ts` + `app/api/todos/[id]/route.ts` — extend existing |
| API client | `lib/api/todos.ts` — `priority` already part of `CreateTodoInput` / `UpdateTodoInput` |
| Types | `lib/types/todo.ts` — `Priority` type already exported |
| Hooks | `lib/hooks/useTodos.ts` — sorting logic updated here |
| Components | `components/todos/` — extend `TodoForm`, `TodoItem`, `TodoBadges`; add `PriorityBadge`, `PriorityFilter` |
| Design tokens | `app/globals.css` — add priority-specific tokens under `@theme` |

### 3.2 Database Schema

The `priority` column was created by PRP-01. No migration is needed unless deploying PRP-02 to a database that has PRP-01 but with a missing column (unlikely; document below for safety).

```sql
-- Only run if priority column is missing (idempotent guard)
ALTER TABLE todos ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'
  CHECK (priority IN ('high','medium','low'));

-- Helper: sort order mapping (used in ORDER BY expression, not a stored column)
-- ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC, due_date ASC NULLS LAST
```

No new tables. No new indexes (existing `idx_todos_user_completed` + `idx_todos_due_date` are sufficient; priority cardinality is too low to benefit from its own index).

### 3.3 API Endpoints

Priority is already included in the existing create/update endpoints from PRP-01. This PRP adds:

1. **Sorting** in `GET /api/todos` — the server now sorts pending/overdue by priority then due_date (was already specified in PRP-01 sorting rules; this PRP confirms the implementation).
2. **Validation** — `priority` field validated as `'high' | 'medium' | 'low'` on create and update.

No new routes needed.

**Updated validation for `POST /api/todos` and `PUT /api/todos/[id]`:**
```typescript
if (priority !== undefined && !['high', 'medium', 'low'].includes(priority)) {
  return Response.json(
    { success: false, error: 'Priority must be high, medium, or low', field: 'priority' },
    { status: 400 }
  )
}
```

**Updated `lib/db/todos.ts` sort query:**
```sql
-- Pending section
SELECT * FROM todos
WHERE user_id = ? AND completed = 0 AND (due_date IS NULL OR due_date >= ?)
ORDER BY
  CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC,
  due_date ASC NULLS LAST

-- Overdue section
SELECT * FROM todos
WHERE user_id = ? AND completed = 0 AND due_date < ?
ORDER BY
  CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC,
  due_date ASC
```

### 3.4 TypeScript Types

```typescript
// lib/types/todo.ts  — additions/confirmations for PRP-02

// Already exported by PRP-01:
export type Priority = 'high' | 'medium' | 'low'

// New: filter state type used by PriorityFilter
export type PriorityFilter = Priority | 'all'

// Helper constant — single source of truth for priority ordering
export const PRIORITY_ORDER: Record<Priority, number> = {
  high:   1,
  medium: 2,
  low:    3,
}

// New: display metadata for each priority level
export interface PriorityMeta {
  label: string
  bgToken: string          // CSS custom property name
  textToken: string
  borderToken: string
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  high:   { label: 'High',   bgToken: '--color-priority-high-bg',   textToken: '--color-priority-high-text',   borderToken: '--color-priority-high-border' },
  medium: { label: 'Medium', bgToken: '--color-priority-medium-bg', textToken: '--color-priority-medium-text', borderToken: '--color-priority-medium-border' },
  low:    { label: 'Low',    bgToken: '--color-priority-low-bg',    textToken: '--color-priority-low-text',    borderToken: '--color-priority-low-border' },
}
```

---

## 4. React Components

### 4.1 Component Tree ASCII

```
TodoList
├── PriorityFilter              ← NEW: filter dropdown in list header
├── TodoSection[overdue]
│   └── TodoItem[]
│       └── TodoBadges
│           └── PriorityBadge  ← NEW: replaces placeholder pill
├── TodoSection[pending]        ← filtered by PriorityFilter
│   └── TodoItem[]
│       └── TodoBadges
│           └── PriorityBadge
└── TodoSection[completed]
    └── TodoItem[]
        └── TodoBadges
            └── PriorityBadge

TodoForm (create + edit mode)
└── PrioritySelect              ← NEW: priority dropdown inside form
```

### 4.2 Component Specs

#### `PriorityBadge`

**File:** `components/todos/PriorityBadge.tsx`
**Purpose:** Renders a small coloured pill showing the priority label.

**Props:**
```typescript
interface PriorityBadgeProps {
  priority: Priority
  size?: 'sm' | 'md'           // default 'sm'
}
```

**Render:**
```tsx
const meta = PRIORITY_META[priority]
return (
  <span
    data-testid={`priority-badge-${priority}`}
    style={{
      backgroundColor: `var(${meta.bgToken})`,
      color: `var(${meta.textToken})`,
      border: `1px solid var(${meta.borderToken})`,
    }}
    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
    aria-label={`Priority: ${meta.label}`}
  >
    {meta.label}
  </span>
)
```

**Design tokens to add to `app/globals.css`:**

```css
@theme {
  /* Priority — Light mode */
  --color-priority-high-bg:      #fef2f2;   /* red-50 */
  --color-priority-high-text:    #991b1b;   /* red-800 — 7.5:1 on red-50 ✓ WCAG AA */
  --color-priority-high-border:  #fca5a5;   /* red-300 */

  --color-priority-medium-bg:    #fffbeb;   /* amber-50 */
  --color-priority-medium-text:  #92400e;   /* amber-800 — 7.1:1 on amber-50 ✓ WCAG AA */
  --color-priority-medium-border:#fcd34d;   /* amber-300 */

  --color-priority-low-bg:       #eff6ff;   /* blue-50 */
  --color-priority-low-text:     #1e40af;   /* blue-800 — 8.6:1 on blue-50 ✓ WCAG AA */
  --color-priority-low-border:   #93c5fd;   /* blue-300 */
}

.dark {
  /* Priority — Dark mode */
  --color-priority-high-bg:      #450a0a;   /* red-950 */
  --color-priority-high-text:    #fca5a5;   /* red-300 — 7.2:1 on red-950 ✓ WCAG AA */
  --color-priority-high-border:  #7f1d1d;   /* red-900 */

  --color-priority-medium-bg:    #451a03;   /* amber-950 */
  --color-priority-medium-text:  #fcd34d;   /* amber-300 — 9.1:1 on amber-950 ✓ WCAG AA */
  --color-priority-medium-border:#78350f;   /* amber-900 */

  --color-priority-low-bg:       #172554;   /* blue-950 */
  --color-priority-low-text:     #93c5fd;   /* blue-300 — 8.9:1 on blue-950 ✓ WCAG AA */
  --color-priority-low-border:   #1e3a8a;   /* blue-900 */
}
```

**Accessibility:**
- `role` is implicitly `generic` (span); `aria-label` describes priority for screen readers
- Do not use colour alone — the text label ("High" / "Medium" / "Low") is always present

---

#### `PriorityFilter`

**File:** `components/todos/PriorityFilter.tsx`
**Purpose:** A dropdown (or segmented control) that filters the visible todos by priority tier. Persists in React state (no URL needed for PRP-02).

**Props:**
```typescript
interface PriorityFilterProps {
  value: PriorityFilter
  onChange: (value: PriorityFilter) => void
}
```

**Render:**
```tsx
<label htmlFor="priority-filter" className="sr-only">Filter by priority</label>
<select
  id="priority-filter"
  data-testid="priority-filter"
  value={value}
  onChange={e => onChange(e.target.value as PriorityFilter)}
>
  <option value="all">All priorities</option>
  <option value="high">High only</option>
  <option value="medium">Medium only</option>
  <option value="low">Low only</option>
</select>
```

**Design tokens:**
```
--color-surface-input
--color-border-default
--color-text-primary
--radius-md
```

**Accessibility:**
- Visible `<label>` with `htmlFor`
- `data-testid="priority-filter"`

---

#### `TodoForm` (extended)

**File:** `components/todos/TodoForm.tsx` — extend existing component

**New prop in `CreateTodoInput`:** `priority?: Priority` (already typed)

**New field to render inside the form:**
```tsx
<label htmlFor="todo-priority">Priority</label>
<select
  id="todo-priority"
  data-testid="todo-priority-select"
  value={priority}
  onChange={e => setPriority(e.target.value as Priority)}
>
  <option value="high">High</option>
  <option value="medium">Medium</option>
  <option value="low">Low</option>
</select>
```

Default value: `'medium'` (from `initialValues?.priority ?? 'medium'`).

---

#### `TodoBadges` (extended)

**File:** `components/todos/TodoBadges.tsx` — replace placeholder with real `PriorityBadge`

```tsx
import { PriorityBadge } from './PriorityBadge'

export function TodoBadges({ todo }: TodoBadgesProps) {
  return (
    <div className="flex gap-1 items-center" data-testid={`todo-badges-${todo.id}`}>
      <PriorityBadge priority={todo.priority} />
      {/* RecurrenceBadge placeholder — PRP-03 */}
      {/* ReminderBadge placeholder — PRP-04 */}
    </div>
  )
}
```

---

#### `TodoList` (extended)

**File:** `components/todos/TodoList.tsx` — add filter state and `PriorityFilter`

```typescript
// New state inside TodoList
const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')

// Filter helper (pure function, no mutation)
function applyPriorityFilter(todos: Todo[], filter: PriorityFilter): Todo[] {
  if (filter === 'all') return todos
  return todos.filter(t => t.priority === filter)
}

const overdue   = applyPriorityFilter(data.overdue,   priorityFilter)
const pending   = applyPriorityFilter(data.pending,   priorityFilter)
const completed = applyPriorityFilter(data.completed, priorityFilter)
```

Render `<PriorityFilter value={priorityFilter} onChange={setPriorityFilter} />` above the sections.

---

## 5. TanStack Query Hooks

### Updates to `useTodos` / `useUpdateTodo` in `lib/hooks/useTodos.ts`

No new hooks needed. The existing hooks from PRP-01 handle `priority` as part of `UpdateTodoInput`. The key change is in the **client-side sort** applied after the server response is received, ensuring the optimistic update also re-sorts correctly.

```typescript
// Add a client-side sort utility (lib/utils/sortTodos.ts)
import { Todo, PRIORITY_ORDER } from '@/lib/types/todo'

export function sortByPriorityThenDueDate(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (pDiff !== 0) return pDiff
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })
}
```

Apply `sortByPriorityThenDueDate` on the `pending` and `overdue` arrays inside the `onMutate` optimistic updater in `useUpdateTodo` and `useCreateTodo`.

**Query key:** no change — still `todoKeys.lists()`.
**Stale time / cache time:** no change.
**Invalidation:** `todoKeys.lists()` is invalidated on create, update, delete — same as PRP-01.

---

## 6. State Management

| State | Type | Location | Notes |
|-------|------|----------|-------|
| Priority filter | Local UI | `TodoList` component | `useState<PriorityFilter>('all')` |
| Priority field value | Local UI | `TodoForm` | Controlled select, defaults to `'medium'` |
| Todo priority data | Server state | TanStack Query `todoKeys.lists()` | Same cache as PRP-01 |

No new contexts. No URL state (search-param based filtering is out of scope for this PRP).

---

## 7. Test Specifications

### 7.1 E2E Tests (Playwright)

**File:** `e2e/priority.spec.ts`

#### Test: Create high-priority todo

```
Steps:
1. Navigate to /
2. Fill [data-testid="todo-title-input"] "Urgent task"
3. Select "high" in [data-testid="todo-priority-select"]
4. Click [data-testid="todo-submit-btn"]
Assertions:
- [data-testid="priority-badge-high"] is visible inside the new todo item
- Badge background is approximately red (visual check or token check)
```

#### Test: Priority sort order in pending section

```
Steps:
1. Via API: create low-priority todo "Low task" (no due date)
2. Via API: create high-priority todo "High task" (no due date)
3. Via API: create medium-priority todo "Medium task" (no due date)
4. Navigate to /
5. Get all todo items inside [data-testid="section-pending"]
Assertions:
- "High task" appears before "Medium task"
- "Medium task" appears before "Low task"
```

#### Test: Priority filter hides lower priority

```
Steps:
1. Via API: create one high, one medium, one low todo
2. Navigate to /
3. Select "high" in [data-testid="priority-filter"]
Assertions:
- Only the high-priority todo is visible in pending section
- Medium and low todo items are not in the DOM (or have display:none)
```

#### Test: Filter clears section when no matching todos

```
Steps:
1. Via API: create only medium and low todos (no high)
2. Navigate to /
3. Select "high" in [data-testid="priority-filter"]
Assertions:
- [data-testid="section-pending"] is not visible (or not in DOM)
- [data-testid="empty-state"] or no sections visible
```

#### Test: Edit priority updates badge and position

```
Steps:
1. Via API: create low-priority todo "Was low"
2. Via API: create high-priority todo "Stays high"
3. Navigate to /
4. Click [data-testid="todo-edit-btn-{lowId}"]
5. Change priority to "high" in edit modal
6. Save
Assertions:
- "Was low" now shows [data-testid="priority-badge-high"]
- "Was low" appears before or at same position as "Stays high" (both high)
```

### 7.2 Unit Tests

**File:** `lib/utils/sortTodos.test.ts`

| Function | Input | Expected |
|----------|-------|----------|
| `sortByPriorityThenDueDate` | `[low, high, medium]` no due dates | `[high, medium, low]` |
| `sortByPriorityThenDueDate` | `[high(later date), high(earlier date)]` | `[high(earlier), high(later)]` |
| `sortByPriorityThenDueDate` | `[high(no date), high(with date)]` | `[high(with date), high(no date)]` (due NULLS LAST) |
| `sortByPriorityThenDueDate` | empty array | `[]` |
| `sortByPriorityThenDueDate` | single item | unchanged |

**File:** `components/todos/PriorityBadge.test.tsx`

| Scenario | Setup | Assertion |
|----------|-------|-----------|
| Renders high | `<PriorityBadge priority="high" />` | text "High" visible; `aria-label="Priority: High"` |
| Renders medium | `<PriorityBadge priority="medium" />` | text "Medium" visible |
| Renders low | `<PriorityBadge priority="low" />` | text "Low" visible |
| Size prop sm | `size="sm"` | has `text-xs` class |

**File:** `app/api/todos/route.test.ts` — additions

| Scenario | Input | Expected |
|----------|-------|----------|
| Create with invalid priority | `{ title: 'X', priority: 'urgent' }` | `400`, `field: 'priority'` |
| Create with high priority | `{ title: 'X', priority: 'high' }` | `201`, returned todo has `priority: 'high'` |
| Update priority | `PUT /api/todos/1` `{ priority: 'low' }` | `200`, returned todo has `priority: 'low'` |

### 7.3 Integration Tests

**File:** `lib/db/todos.test.ts` — additions

```
getTodosByUser — priority sort
- Insert: high(no date), low(no date), medium(no date)
- Call getTodosByUser(userId)
- Assert pending array order: high → medium → low

getTodosByUser — priority + due_date sort
- Insert: high(due tomorrow), high(due next week)
- Assert: high(tomorrow) before high(next week)
```

---

## 8. Acceptance Criteria

1. The `TodoForm` contains a priority select with options High / Medium / Low, defaulting to Medium.
2. Each todo in all three sections displays a `PriorityBadge` with the correct label and colour.
3. High-priority badge uses red colour tokens; medium uses amber/yellow tokens; low uses blue tokens.
4. All badge colour combinations pass WCAG AA (4.5:1 contrast) in both light and dark mode.
5. Within the Pending and Overdue sections, high-priority todos appear before medium, which appear before low.
6. Ties in priority are broken by `due_date ASC NULLS LAST`.
7. The `PriorityFilter` dropdown is visible in the `TodoList` header area.
8. Selecting "High only" hides all medium and low todos without a page reload.
9. Selecting "All priorities" restores the full list.
10. When a filter is active and a section has no matching todos, that section hides entirely.
11. Editing a todo's priority updates the badge and re-sorts the list optimistically.
12. The server validates `priority` on create and update; invalid values return `400`.
13. `sortByPriorityThenDueDate` is a pure function (does not mutate input array).
14. Design token names follow the convention: `--color-priority-{level}-{variant}`.

---

## 9. Integration Points

### 9.1 What This Feature Consumes

| Dependency | Usage |
|------------|-------|
| PRP-01: `todos` table | `priority` column already present |
| PRP-01: `Todo` type | Extends with `PRIORITY_META` constant |
| PRP-01: `useTodos`, `useUpdateTodo` | Adds sort logic; re-uses mutation hooks |
| PRP-01: `TodoForm` | Adds `PrioritySelect` field |
| PRP-01: `TodoBadges` | Replaces placeholder with `PriorityBadge` |
| PRP-01: `TodoList` | Adds `PriorityFilter` and filter state |
| Design token system | Adds 18 new priority-specific tokens |

### 9.2 What This Feature Exposes

| Export | Consumers |
|--------|-----------|
| `PriorityBadge` component | PRP-03 may reuse; standalone components page |
| `PRIORITY_META` constant | Any component needing priority display metadata |
| `sortByPriorityThenDueDate` utility | PRP-03 (recurring creates inherit sort) |
| Priority design tokens | All future badge/pill components |

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Invalid priority value from DB | TypeScript `Priority` type enforces at compile time; DB `CHECK` constraint enforces at runtime |
| Filter active when editing priority | After `onSettled` invalidation, TanStack refetch may cause filtered item to disappear if its new priority doesn't match filter — this is correct behaviour |
| All todos same priority | Sort falls through to `due_date` comparison; stable if dates are equal |
| Dark mode contrast | All dark-mode token values pre-verified to ≥ 4.5:1 |
| Priority select in modal | Same `<select>` code path as create form; pre-fills from `todo.priority` |
| Optimistic priority change reorders list | `patchTodoInGroups` in `useUpdateTodo` applies updated priority; client sort in `onMutate` re-sorts the array |
| `PriorityFilter` reset on navigation | Local state (non-persisted); filter resets to 'all' on page refresh — acceptable for PRP-02 |

---

## 11. Out of Scope

- URL-persisted priority filter (e.g., `?priority=high`)
- Multi-priority filter (selecting both high and medium simultaneously)
- Keyboard shortcut to set priority (e.g., `1` / `2` / `3`)
- Priority-based notification urgency (covered in PRP-04)
- Priority statistics or analytics dashboard
- Custom priority labels or additional tiers beyond 3

---

## 12. Singapore Timezone Considerations

Priority itself has no timezone dependency. However, the **sort** logic that breaks priority ties with `due_date` must use the same UTC timestamps that are stored in the DB. The `sortByPriorityThenDueDate` utility compares raw ISO-8601 UTC strings via `new Date(...).getTime()` — this is correct because UTC comparisons are timezone-independent.

When displaying the sort result, individual due-date labels use `lib/timezone.ts#formatDueDateDisplay()` as specified in PRP-01. No additional timezone handling is introduced by this PRP.
