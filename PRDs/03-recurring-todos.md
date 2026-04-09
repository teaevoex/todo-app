# PRP-03: Recurring Todos

> **Recurrence engine** — lets todos automatically re-schedule on completion.
> An agent reading only this file + `ARCHITECTURE.md` + PRP-01 has enough context to implement the feature completely.

**Status:** Ready for implementation
**Priority:** P1
**Dependencies:** PRP-01 (Todo CRUD Operations)
**Depended on by:** None directly

---

## 1. Feature Overview

Recurring Todos allow a todo to automatically create a new instance of itself when the user marks it complete. Instead of manually re-creating the same "Weekly team meeting" or "Monthly rent payment" todo, the system advances the due date by the chosen pattern (daily, weekly, monthly, yearly) and creates a fresh pending todo with the same attributes.

The feature introduces two new columns in the `todos` table: `is_recurring` (boolean flag) and `recurrence_pattern` (the interval). When a recurring todo is completed, the completion handler on the server calculates the next due date in Singapore timezone, then inserts a new todo row. The original completed todo is preserved in the Completed section exactly as any non-recurring todo would be. The new instance appears in Pending immediately.

All date arithmetic is handled in `lib/recurrence.ts` using a purpose-built `calculateNextDueDate` function that is Singapore-timezone-aware and handles month-end edge cases (e.g., January 31 → February 28/29, February 29 → February 28 on non-leap years).

---

## 2. User Stories

**US-01 — Mark a todo as recurring on create**
As a user, when creating a todo with a due date, I want to check a "Recurring" checkbox and choose a pattern (daily/weekly/monthly/yearly) so that the system automatically creates the next instance when I complete it.

**US-02 — Complete a recurring todo**
As a user, when I check off a recurring todo, I want to see it move to Completed AND immediately see a new pending instance appear with the next due date.

**US-03 — Visual indicator**
As a user, I want to see a recurrence badge (🔄 icon + pattern label) on recurring todos so that I know at a glance they will auto-renew.

**US-04 — Edit recurrence**
As a user, I want to open the edit modal for a recurring todo and change the pattern or turn off recurrence entirely.

**US-05 — Recurring requires a due date**
As a user, if I check "Recurring" but haven't set a due date, the form should display an error and not allow submission.

**US-06 — Disable recurrence on edit**
As a user, I want to uncheck the recurring checkbox in the edit modal to stop future auto-creation without affecting the current todo.

**US-07 — Edge: monthly end-of-month**
As a user who has a monthly recurring todo due on January 31, when I complete it the next instance should be due on February 28 (or 29 in a leap year), not an invalid date.

**US-08 — Edge: yearly February 29**
As a user who sets a yearly recurring todo due on February 29, on non-leap years the next instance should be due on February 28.

**US-09 — Edge: recurring without due date prevented**
As a user, if I somehow submit a recurring todo without a due date (e.g., via API), the server should reject it with a 400 error.

---

## 3. Technical Requirements

### 3.1 Architecture Reference

| Concern | Location |
|---------|----------|
| DB schema migration | `lib/db/migrations/003-recurrence.sql` |
| DB operations | `lib/db/todos.ts` — extend `createTodo`, `updateTodo`; add `completeTodoWithRecurrence` |
| Recurrence math | `lib/recurrence.ts` — `calculateNextDueDate` |
| API routes | `app/api/todos/[id]/route.ts` — `PUT` handler detects completion of recurring todo |
| Types | `lib/types/todo.ts` — `RecurrencePattern` already exported by PRP-01 |
| Hooks | `lib/hooks/useTodos.ts` — `useUpdateTodo` handles optimistic spawn of new todo |
| Components | New: `RecurrenceCheckbox`, `RecurrencePatternSelect`, `RecurrenceBadge` |
| Timezone | `lib/timezone.ts` — all date arithmetic in SGT |

### 3.2 Database Schema

```sql
-- Migration: 003-recurrence.sql
-- Add columns to todos (idempotent — only adds if missing)

ALTER TABLE todos ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0;
ALTER TABLE todos ADD COLUMN recurrence_pattern TEXT
  CHECK (recurrence_pattern IN ('daily','weekly','monthly','yearly') OR recurrence_pattern IS NULL);

-- Constraint: if is_recurring = 1, recurrence_pattern must be set AND due_date must be set
-- Enforced at application layer (SQLite CHECK cannot reference other columns in ALTER TABLE)
-- DB-level constraint added via trigger:
CREATE TRIGGER IF NOT EXISTS check_recurrence_consistency
BEFORE INSERT ON todos
FOR EACH ROW
WHEN NEW.is_recurring = 1
BEGIN
  SELECT CASE
    WHEN NEW.recurrence_pattern IS NULL
      THEN RAISE(ABORT, 'recurrence_pattern required when is_recurring=1')
    WHEN NEW.due_date IS NULL
      THEN RAISE(ABORT, 'due_date required when is_recurring=1')
  END;
END;

CREATE TRIGGER IF NOT EXISTS check_recurrence_consistency_update
BEFORE UPDATE ON todos
FOR EACH ROW
WHEN NEW.is_recurring = 1
BEGIN
  SELECT CASE
    WHEN NEW.recurrence_pattern IS NULL
      THEN RAISE(ABORT, 'recurrence_pattern required when is_recurring=1')
    WHEN NEW.due_date IS NULL
      THEN RAISE(ABORT, 'due_date required when is_recurring=1')
  END;
END;
```

### 3.3 API Endpoints

All existing endpoints from PRP-01 are used. The only change is in the `PUT /api/todos/[id]` handler.

#### `PUT /api/todos/[id]` — extended behaviour

When the request body contains `completed: true` and the todo has `is_recurring: 1`:

1. Update the existing todo to `completed = 1` (normal behaviour).
2. Call `completeTodoWithRecurrence(todo)` from `lib/db/todos.ts`.
3. This function: computes next due date via `calculateNextDueDate`, inserts a new todo row.
4. Return the updated (completed) todo in the response, plus the new recurring instance:

```typescript
// Extended response shape when completing a recurring todo
interface CompleteRecurringResponse {
  success: true
  data: {
    completed: Todo    // the todo just completed
    next: Todo         // the newly created next instance
  }
}

// Normal update response (non-recurring or no completed change)
interface TodoResponse {
  success: true
  data: Todo
}
```

The client hook checks if the response contains `data.next` and adds it to the optimistic cache.

**Validation on create/update:**
```typescript
// Server-side guard
if (body.is_recurring && !body.due_date) {
  return Response.json(
    { success: false, error: 'A due date is required for recurring todos', field: 'due_date' },
    { status: 400 }
  )
}
if (body.is_recurring && !body.recurrence_pattern) {
  return Response.json(
    { success: false, error: 'A recurrence pattern is required', field: 'recurrence_pattern' },
    { status: 400 }
  )
}
```

### 3.4 TypeScript Types

```typescript
// lib/types/todo.ts — additions for PRP-03

// Already exported by PRP-01:
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

// Display metadata
export interface RecurrenceMeta {
  label: string         // e.g. "Daily", "Weekly"
  shortLabel: string    // e.g. "day", "wk", "mo", "yr"
}

export const RECURRENCE_META: Record<RecurrencePattern, RecurrenceMeta> = {
  daily:   { label: 'Daily',   shortLabel: 'day' },
  weekly:  { label: 'Weekly',  shortLabel: 'wk'  },
  monthly: { label: 'Monthly', shortLabel: 'mo'  },
  yearly:  { label: 'Yearly',  shortLabel: 'yr'  },
}

// Extended update input (PRP-01 had these nullable — confirm here)
export interface UpdateTodoInput {
  title?: string
  completed?: boolean
  due_date?: string | null
  priority?: Priority
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
  reminder_minutes?: number | null
}

// Extended create input
export interface CreateTodoInput {
  title: string
  due_date?: string | null
  priority?: Priority
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
  reminder_minutes?: number | null
}

// Response when completing a recurring todo
export interface CompleteRecurringResponse {
  success: true
  data: {
    completed: Todo
    next: Todo
  }
}
```

---

## 4. React Components

### 4.1 Component Tree ASCII

```
TodoForm (create + edit)
├── [existing fields: title, due_date, priority]
├── RecurrenceCheckbox          ← NEW: "Repeat" toggle
└── RecurrencePatternSelect     ← NEW: shown when checkbox is checked

TodoItem
└── TodoBadges
    ├── PriorityBadge           (PRP-02)
    └── RecurrenceBadge         ← NEW: 🔄 icon + pattern label
```

### 4.2 Component Specs

#### `RecurrenceCheckbox`

**File:** `components/todos/RecurrenceCheckbox.tsx`
**Purpose:** Toggle that enables/disables recurrence. Disables itself visually when no `due_date` is set in the parent form.

**Props:**
```typescript
interface RecurrenceCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean      // true when due_date is empty in the parent form
}
```

**Render:**
```tsx
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    id="todo-recurring"
    data-testid="todo-recurring-checkbox"
    checked={checked}
    onChange={e => onChange(e.target.checked)}
    disabled={disabled}
    aria-describedby={disabled ? 'recurring-disabled-hint' : undefined}
  />
  <label htmlFor="todo-recurring">Repeat</label>
  {disabled && (
    <span id="recurring-disabled-hint" className="text-xs text-[var(--color-text-muted)]">
      Set a due date first
    </span>
  )}
</div>
```

**Behaviour in parent `TodoForm`:**
- When `dueDate` field is empty: `disabled={true}`, `checked` forced to `false`
- When user clears `dueDate` while recurring is enabled: auto-uncheck and set `isRecurring = false`

**Design tokens:** `--color-text-muted`, `--color-interactive-primary` (checkbox accent)

**Accessibility:**
- `disabled` attribute prevents interaction when no due date
- `aria-describedby` explains why it is disabled
- `data-testid="todo-recurring-checkbox"`

---

#### `RecurrencePatternSelect`

**File:** `components/todos/RecurrencePatternSelect.tsx`
**Purpose:** Dropdown for choosing recurrence pattern. Only renders when `RecurrenceCheckbox` is checked.

**Props:**
```typescript
interface RecurrencePatternSelectProps {
  value: RecurrencePattern
  onChange: (pattern: RecurrencePattern) => void
}
```

**Render:**
```tsx
<div>
  <label htmlFor="todo-recurrence-pattern">Repeat every</label>
  <select
    id="todo-recurrence-pattern"
    data-testid="todo-recurrence-pattern-select"
    value={value}
    onChange={e => onChange(e.target.value as RecurrencePattern)}
  >
    <option value="daily">Day</option>
    <option value="weekly">Week</option>
    <option value="monthly">Month</option>
    <option value="yearly">Year</option>
  </select>
</div>
```

**Default value when checkbox is first checked:** `'weekly'`

**Accessibility:**
- `<label>` with `htmlFor`
- `data-testid="todo-recurrence-pattern-select"`

---

#### `RecurrenceBadge`

**File:** `components/todos/RecurrenceBadge.tsx`
**Purpose:** Small badge that indicates a todo is recurring. Shows 🔄 icon + short pattern label.

**Props:**
```typescript
interface RecurrenceBadgeProps {
  pattern: RecurrencePattern
}
```

**Render:**
```tsx
const meta = RECURRENCE_META[pattern]
return (
  <span
    data-testid={`recurrence-badge-${pattern}`}
    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
    style={{
      backgroundColor: 'var(--color-recurrence-bg)',
      color: 'var(--color-recurrence-text)',
      border: '1px solid var(--color-recurrence-border)',
    }}
    aria-label={`Repeats ${meta.label}`}
    title={`Repeats ${meta.label}`}
  >
    <span aria-hidden="true">🔄</span>
    {meta.shortLabel}
  </span>
)
```

**Design tokens to add to `app/globals.css`:**
```css
@theme {
  --color-recurrence-bg:     #f0fdf4;   /* green-50 */
  --color-recurrence-text:   #166534;   /* green-800 — 8.1:1 ✓ */
  --color-recurrence-border: #86efac;   /* green-300 */
}

.dark {
  --color-recurrence-bg:     #052e16;   /* green-950 */
  --color-recurrence-text:   #86efac;   /* green-300 — 8.5:1 ✓ */
  --color-recurrence-border: #14532d;   /* green-900 */
}
```

**Accessibility:**
- `aria-hidden="true"` on emoji to avoid screen-reader confusion
- `aria-label` on the span provides full text description
- `data-testid="recurrence-badge-{pattern}"`

---

#### `TodoBadges` (extended — PRP-03 update)

```tsx
// components/todos/TodoBadges.tsx
import { PriorityBadge }    from './PriorityBadge'    // PRP-02
import { RecurrenceBadge }  from './RecurrenceBadge'  // PRP-03

export function TodoBadges({ todo }: TodoBadgesProps) {
  return (
    <div className="flex gap-1 items-center flex-wrap" data-testid={`todo-badges-${todo.id}`}>
      <PriorityBadge priority={todo.priority} />
      {todo.is_recurring && todo.recurrence_pattern && (
        <RecurrenceBadge pattern={todo.recurrence_pattern} />
      )}
      {/* ReminderBadge placeholder — PRP-04 */}
    </div>
  )
}
```

---

#### `TodoForm` (extended — PRP-03 update)

**New local state:**
```typescript
const [isRecurring, setIsRecurring]             = useState(initialValues?.is_recurring ?? false)
const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>(
  initialValues?.recurrence_pattern ?? 'weekly'
)
```

**Render additions (after due date field):**
```tsx
<RecurrenceCheckbox
  checked={isRecurring}
  onChange={setIsRecurring}
  disabled={!dueDate}
/>
{isRecurring && (
  <RecurrencePatternSelect
    value={recurrencePattern}
    onChange={setRecurrencePattern}
  />
)}
```

**On submit payload:**
```typescript
const payload: CreateTodoInput = {
  title: title.trim(),
  due_date: dueDate ? toUTC(dueDate) : null,
  priority,
  is_recurring: isRecurring,
  recurrence_pattern: isRecurring ? recurrencePattern : null,
}
```

---

## 5. TanStack Query Hooks

### Updates to `useTodos.ts` — handling recurring completion

```typescript
// Extended useUpdateTodo to handle CompleteRecurringResponse
export function useUpdateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & UpdateTodoInput) =>
      updateTodo(id, data),          // lib/api/todos.ts

    onMutate: async ({ id, completed, ...rest }) => {
      await qc.cancelQueries({ queryKey: todoKeys.lists() })
      const prev = qc.getQueryData<TodosResponse>(todoKeys.lists())

      qc.setQueryData(todoKeys.lists(), (old: TodosResponse) => {
        let next = patchTodoInGroups(old, id, { completed, ...rest })

        // If completing a recurring todo, optimistically add a placeholder next instance
        const completedTodo = findTodoInGroups(old, id)
        if (completed && completedTodo?.is_recurring && completedTodo.recurrence_pattern && completedTodo.due_date) {
          const nextDueDate = calculateNextDueDate(completedTodo.due_date, completedTodo.recurrence_pattern)
          const nextTodo: Todo = {
            ...completedTodo,
            id: -(Date.now()),          // temp negative id
            completed: false,
            due_date: nextDueDate,
            last_notification_sent: null,
            created_at: nowSG().toISOString(),
            updated_at: nowSG().toISOString(),
          }
          next = {
            ...next,
            data: {
              ...next.data,
              pending: sortByPriorityThenDueDate([nextTodo, ...next.data.pending]),
            },
          }
        }
        return next
      })
      return { prev }
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(todoKeys.lists(), ctx.prev)
    },

    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.lists() }),
  })
}
```

**Note:** The optimistic placeholder gets a negative `id` so it doesn't clash. `onSettled` triggers a real refetch that replaces it with the server-assigned id.

---

## 6. State Management

| State | Type | Location | Notes |
|-------|------|----------|-------|
| `isRecurring` | Local UI | `TodoForm` | Controlled checkbox |
| `recurrencePattern` | Local UI | `TodoForm` | Controlled select |
| Todo recurrence data | Server state | TanStack Query `todoKeys.lists()` | Source of truth |
| Optimistic next instance | TanStack cache | `todoKeys.lists()` | Temp negative id; replaced on refetch |

---

## 7. Test Specifications

### 7.1 E2E Tests (Playwright)

**File:** `e2e/recurring.spec.ts`

#### Test: Create recurring todo

```
Steps:
1. Navigate to /
2. Fill title "Weekly standup"
3. Set due date to tomorrow at 09:00 SG time
4. Check [data-testid="todo-recurring-checkbox"]
5. Assert [data-testid="todo-recurrence-pattern-select"] is visible
6. Select "weekly"
7. Click [data-testid="todo-submit-btn"]
Assertions:
- New todo in pending section with text "Weekly standup"
- [data-testid^="recurrence-badge-"] is visible on that todo
```

#### Test: Complete recurring todo spawns next instance

```
Steps:
1. Via API: create recurring weekly todo "Weekly standup" due tomorrow
2. Note the id as todoId
3. Navigate to /
4. Click [data-testid="todo-checkbox-{todoId}"]
Assertions:
- "Weekly standup" appears in Completed section (original)
- A NEW "Weekly standup" item appears in Pending section with next week's due date
- The new pending item has [data-testid^="recurrence-badge-"]
```

#### Test: Cannot create recurring without due date

```
Steps:
1. Navigate to /
2. Fill title "No date recurring"
3. Assert [data-testid="todo-recurring-checkbox"] is disabled (has disabled attribute)
4. Fill due date
5. Assert checkbox is now enabled
6. Clear due date
7. Assert checkbox is disabled again
```

#### Test: Edit — disable recurrence

```
Steps:
1. Via API: create recurring daily todo "Daily exercise" due tomorrow
2. Navigate to /
3. Click [data-testid="todo-edit-btn-{id}"]
4. Uncheck [data-testid="todo-recurring-checkbox"]
5. Save
Assertions:
- Modal closes
- "Daily exercise" no longer has a recurrence badge
- Completing it does NOT spawn a new instance (verify: no new "Daily exercise" in pending)
```

#### Test: Monthly end-of-month — Jan 31

```
Steps:
1. Via API helper: create recurring monthly todo due exactly Jan 31 (current or next year)
2. Complete that todo via PUT API
3. Navigate to /
Assertions:
- A new pending "..." todo exists with due_date in February (28 or 29 depending on year)
- Due date is NOT invalid (not null, not a Feb 30/31)
```

### 7.2 Unit Tests

**File:** `lib/recurrence.test.ts`

```typescript
// All inputs are UTC ISO strings; outputs are UTC ISO strings
// calculateNextDueDate(currentDueDate: string, pattern: RecurrencePattern): string

describe('calculateNextDueDate', () => {
  // Daily
  it('daily: adds 1 day', () => {
    expect(calculateNextDueDate('2026-04-08T01:00:00.000Z', 'daily'))
      .toBe('2026-04-09T01:00:00.000Z')
  })

  // Weekly
  it('weekly: adds 7 days', () => {
    expect(calculateNextDueDate('2026-04-08T01:00:00.000Z', 'weekly'))
      .toBe('2026-04-15T01:00:00.000Z')
  })

  // Monthly — normal
  it('monthly: same day next month', () => {
    expect(calculateNextDueDate('2026-03-10T02:00:00.000Z', 'monthly'))
      .toBe('2026-04-10T02:00:00.000Z')
  })

  // Monthly — end-of-month: Jan 31 → Feb 28
  it('monthly: Jan 31 → Feb 28 (non-leap 2026)', () => {
    // 2026-01-31T00:00:00+08:00 = 2026-01-30T16:00:00Z
    const result = calculateNextDueDate('2026-01-30T16:00:00.000Z', 'monthly')
    const d = new Date(result)
    expect(d.getUTCMonth()).toBe(1)  // February (0-indexed)
    expect(d.getUTCDate()).toBe(28)
  })

  // Monthly — end-of-month: Jan 31 → Feb 29 (leap year 2028)
  it('monthly: Jan 31 → Feb 29 (leap 2028)', () => {
    const result = calculateNextDueDate('2028-01-30T16:00:00.000Z', 'monthly')
    const d = new Date(result)
    expect(d.getUTCMonth()).toBe(1)
    expect(d.getUTCDate()).toBe(29)
  })

  // Yearly — normal
  it('yearly: same date next year', () => {
    expect(calculateNextDueDate('2026-06-15T02:00:00.000Z', 'yearly'))
      .toBe('2027-06-15T02:00:00.000Z')
  })

  // Yearly — Feb 29 on non-leap year → Feb 28
  it('yearly: Feb 29 → Feb 28 on non-leap year', () => {
    // 2028-02-29 is a valid date; 2029-02-29 is not
    const result = calculateNextDueDate('2028-02-28T16:00:00.000Z', 'yearly')
    const d = new Date(result)
    expect(d.getUTCFullYear()).toBe(2029)
    expect(d.getUTCMonth()).toBe(1)
    expect(d.getUTCDate()).toBe(28)
  })

  // Preserves time-of-day
  it('preserves wall-clock time in SG timezone', () => {
    // 2026-04-08 09:00 SGT = 2026-04-08T01:00:00Z
    const result = calculateNextDueDate('2026-04-08T01:00:00.000Z', 'daily')
    // Should be 2026-04-09 09:00 SGT = 2026-04-09T01:00:00Z
    expect(result).toBe('2026-04-09T01:00:00.000Z')
  })
})
```

**File:** `components/todos/RecurrenceCheckbox.test.tsx`

| Scenario | Setup | Assertion |
|----------|-------|-----------|
| Disabled when no due date | `disabled={true}` | input has `disabled` attribute |
| Enabled when due date present | `disabled={false}` | input does not have `disabled` |
| Toggle calls onChange | click checkbox | `onChange` called with `true` |

**File:** `components/todos/RecurrenceBadge.test.tsx`

| Scenario | Setup | Assertion |
|----------|-------|-----------|
| Shows weekly | `pattern="weekly"` | text "wk" visible |
| Shows daily | `pattern="daily"` | text "day" visible |
| Has aria-label | any pattern | `aria-label` starts with "Repeats" |

### 7.3 Integration Tests

**File:** `app/api/todos/[id]/route.test.ts` — additions

```
PUT /api/todos/[id] — complete recurring todo
- Setup: create recurring weekly todo due tomorrow
- Call: PUT { completed: true }
- Assert: response has data.completed and data.next
- Assert: data.next.due_date is 7 days after original due_date
- Assert: data.next.completed is false
- Assert: data.next.is_recurring is true

PUT /api/todos/[id] — recurring validation
- POST { title: 'X', is_recurring: true } (no due_date) → 400
- POST { title: 'X', due_date: future, is_recurring: true } (no pattern) → 400
- POST { title: 'X', due_date: future, is_recurring: true, recurrence_pattern: 'weekly' } → 201
```

**File:** `lib/recurrence.test.ts` — already covered in 7.2 above.

---

## 8. Acceptance Criteria

1. A recurring todo requires a due date; the "Repeat" checkbox is disabled and labelled with a hint when no due date is set.
2. When the "Repeat" checkbox is checked and the form is submitted, `is_recurring = 1` and `recurrence_pattern` are persisted.
3. Completing a recurring todo creates a new todo with the same `title`, `priority`, `recurrence_pattern`, `reminder_minutes`, and `user_id`.
4. The new instance's `due_date` is computed by `calculateNextDueDate` using Singapore timezone arithmetic.
5. `calculateNextDueDate` with pattern `daily` advances by exactly 1 calendar day in SGT.
6. `calculateNextDueDate` with pattern `weekly` advances by exactly 7 days.
7. `calculateNextDueDate` with pattern `monthly` advances by 1 month; if the resulting date is invalid (e.g., Feb 30), it clamps to the last day of that month.
8. `calculateNextDueDate` with pattern `yearly` advances by 1 year; Feb 29 clamps to Feb 28 on non-leap years.
9. The wall-clock time (hour/minute in SGT) is preserved when advancing the due date.
10. The original completed todo is NOT deleted — it moves to the Completed section normally.
11. A `RecurrenceBadge` is visible on any todo with `is_recurring = true`.
12. The badge shows the 🔄 emoji (aria-hidden) and the short pattern label.
13. Turning off recurrence in the edit modal sets `is_recurring = 0` and `recurrence_pattern = null` in the DB.
14. Submitting a create/update with `is_recurring = true` but no `due_date` returns `400` from the API.
15. The optimistic update shows the next instance immediately, replaced by the server response after `onSettled`.
16. All date math goes through `lib/recurrence.ts#calculateNextDueDate` — no inline `new Date()` arithmetic in route handlers.

---

## 9. Integration Points

### 9.1 What This Feature Consumes

| Dependency | Usage |
|------------|-------|
| PRP-01: `todos` table | Adds `is_recurring`, `recurrence_pattern` columns |
| PRP-01: `createTodo` DB function | Called inside `completeTodoWithRecurrence` to insert next instance |
| PRP-01: `useTodos`, `useUpdateTodo` | Extends `onMutate` to handle recurring completion |
| PRP-01: `TodoForm` | Adds `RecurrenceCheckbox` and `RecurrencePatternSelect` |
| PRP-01: `TodoBadges` | Adds `RecurrenceBadge` |
| PRP-02: `sortByPriorityThenDueDate` | Used when inserting next instance into optimistic cache |
| `lib/timezone.ts` | `nowSG()` used to resolve wall-clock time preservation |

### 9.2 What This Feature Exposes

| Export | Consumers |
|--------|-----------|
| `lib/recurrence.ts#calculateNextDueDate` | Any feature that auto-advances due dates |
| `RecurrenceBadge` component | Template feature, calendar view |
| `RECURRENCE_META` constant | Calendar view, any feature that needs pattern display names |
| `CompleteRecurringResponse` type | Client `lib/api/todos.ts` must handle both response shapes |
| Recurrence design tokens | Other badge-style components |

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Due date cleared while recurring is checked | Auto-uncheck `isRecurring`, set `recurrence_pattern = null` in form state |
| `is_recurring = true` with no `due_date` in API | Server returns `400` immediately; DB trigger also enforces |
| `is_recurring = true` with no `recurrence_pattern` in API | Server returns `400` |
| Completing a recurring todo whose next date overflows | Extremely unlikely (year 9999+); no special handling |
| Jan 31 + 1 month in leap year | `calculateNextDueDate` resolves to Feb 29 |
| Oct 31 + 1 month (no Nov 31) | Clamp to Oct 30? No — November has 30 days; Oct 31 + 1mo = Nov 30 (correct) |
| Dec 31 + 1 month | Jan 31 (correct — 31 days in January) |
| Feb 28 + 1 month (non-leap) | Mar 28 (correct — do not clamp) |
| Feb 28 + 1 year (non-leap) | Feb 28 (same date next year, always valid) |
| Network failure on completion | Optimistic rollback; completed todo returns to pending; no orphaned next instance |
| Recurring todo with tags | `completeTodoWithRecurrence` copies `is_recurring`, `recurrence_pattern`; does NOT copy tags (tags per-instance model, out of scope for PRP-03) |
| Recurring todo with subtasks | Does NOT copy subtasks (per-instance model, out of scope) |
| Pattern changed while todo is pending | Allowed; next due date uses updated pattern when eventually completed |

---

## 11. Out of Scope

- Custom recurrence intervals (e.g., "every 3 days" or "every 2 weeks")
- "End recurrence on date" (stop spawning after a certain date)
- "Skip this occurrence" (complete without spawning next)
- Copying tags to the next recurring instance
- Copying subtasks to the next recurring instance
- Calendar view integration (separate PRP)
- Recurring todo templates (separate PRP)
- Bulk complete multiple recurring todos

---

## 12. Singapore Timezone Considerations

Recurring date arithmetic is the most timezone-sensitive logic in the entire app. All rules:

1. **Input to `calculateNextDueDate`:** UTC ISO-8601 strings (as stored in DB).
2. **Arithmetic must happen in SGT wall-clock time**, not UTC, because "1 month later" means the same calendar day next month in Singapore's calendar — not 30 days later.
3. **Implementation approach:**
   ```typescript
   // lib/recurrence.ts
   import { TZDate } from '@date-fns/tz'    // or use Intl.DateTimeFormat + manual math
   const SG_TZ = 'Asia/Singapore'

   export function calculateNextDueDate(
     currentDueDateUTC: string,
     pattern: RecurrencePattern
   ): string {
     // 1. Parse UTC into an SG-local date
     const sgDate = toZonedTime(new Date(currentDueDateUTC), SG_TZ)
     // 2. Advance in SG local time
     let next: Date
     switch (pattern) {
       case 'daily':   next = addDays(sgDate, 1);    break
       case 'weekly':  next = addWeeks(sgDate, 1);   break
       case 'monthly': next = addMonths(sgDate, 1);  break   // date-fns clamps month-end
       case 'yearly':  next = addYears(sgDate, 1);   break
     }
     // 3. Convert back to UTC ISO
     return fromZonedTime(next, SG_TZ).toISOString()
   }
   ```
   Use `date-fns` + `date-fns-tz` for correct month/year arithmetic. `addMonths` in `date-fns` automatically clamps to end-of-month (Jan 31 + 1mo = Feb 28/29).

4. **Preserving wall-clock time:** By doing arithmetic on the SG-local Date object, the hour:minute in Singapore is preserved. E.g., a task due at 09:00 SGT stays due at 09:00 SGT next week.

5. **DST:** Singapore does not observe daylight saving time (fixed UTC+8). No DST edge cases apply. This simplifies the implementation considerably compared to apps serving US/EU timezones.

6. **Testing time-based assertions:** Use `vi.setSystemTime()` (Vitest) or `jest.useFakeTimers()` to freeze `nowSG()` during tests. Never write tests that depend on the actual wall clock.
