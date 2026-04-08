# PRP 03: Recurring Todos

## Feature Overview

Implement recurring (repeating) todos that automatically create a new instance when the current one is completed. Supports four recurrence patterns: **Daily**, **Weekly**, **Monthly**, and **Yearly**. Recurring todos require a due date, and the next instance inherits all metadata (priority, tags, reminder, recurrence pattern). All date calculations use **Singapore timezone** (`Asia/Singapore`). This feature builds on **PRP 01** (CRUD) and **PRP 02** (Priority).

---

## User Stories

### As a user, I want to:

1. **Mark a todo as recurring** so it automatically repeats on a schedule
2. **Choose a recurrence pattern** (daily, weekly, monthly, yearly) so the repeat frequency matches my needs
3. **See a visual indicator** on recurring todos so I can distinguish them from one-time tasks
4. **Have a new instance auto-created** when I complete a recurring todo so I don't have to recreate it manually
5. **Have the next instance inherit all metadata** (priority, tags, reminder, pattern) so I don't lose configuration
6. **Disable recurrence** on an existing todo so it stops repeating
7. **Be required to set a due date** for recurring todos so the next due date can be calculated

---

## User Flow

### Creating a Recurring Todo

```
1. User enters a todo title in the form
2. User checks the "Repeat" checkbox
3. Recurrence pattern dropdown appears (disabled when Repeat is unchecked)
4. User selects a pattern: Daily, Weekly, Monthly, or Yearly
5. User sets a due date (REQUIRED for recurring todos)
6. User optionally sets priority, reminder, tags
7. User clicks "Add"
8. Todo appears with a 🔄 badge showing the pattern (e.g., "🔄 weekly")
```

### Completing a Recurring Todo

```
1. User clicks the checkbox on a recurring todo
2. Current instance is marked as completed
3. System automatically creates a NEW todo with:
   a. Same title
   b. Same priority level
   c. Same recurrence pattern (still recurring)
   d. Same reminder timing
   e. Same tags
   f. New due date calculated from the pattern
4. New instance appears in the Pending section
5. Completed instance moves to the Completed section
```

### Editing Recurrence

```
1. User clicks "Edit" on a recurring todo
2. Edit modal shows "Repeat" checkbox (checked) and pattern dropdown
3. User can:
   a. Change the pattern (e.g., daily → weekly)
   b. Uncheck "Repeat" to make it one-time
   c. Check "Repeat" on a non-recurring todo to make it recurring
4. If enabling recurrence, a due date is required
5. User clicks "Update"
```

### Disabling Recurrence

```
1. User clicks "Edit" on a recurring todo
2. User unchecks the "Repeat" checkbox
3. Pattern dropdown becomes disabled
4. User clicks "Update"
5. 🔄 badge disappears from the todo
6. Next completion will NOT create a new instance
```

---

## Technical Requirements

### Database Schema

Recurrence fields in the `todos` table (defined in PRP 01):

```sql
-- Recurrence columns in todos table
is_recurring INTEGER NOT NULL DEFAULT 0,    -- Boolean: 0 = one-time, 1 = recurring
recurrence_pattern TEXT                      -- 'daily' | 'weekly' | 'monthly' | 'yearly' | NULL
```

No additional tables needed. The next instance is a new row in the same `todos` table.

### TypeScript Types

```typescript
// lib/db.ts

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

// Used within the Todo interface
export interface Todo {
  // ... other fields from PRP 01
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
}
```

### Validation Rules

```typescript
const VALID_PATTERNS: RecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly']

// In POST /api/todos and PUT /api/todos/[id]
// 1. If is_recurring is true, due_date is required
if (body.is_recurring && !body.due_date) {
  return NextResponse.json(
    { error: 'Recurring todos must have a due date' },
    { status: 400 }
  )
}

// 2. If is_recurring is true, recurrence_pattern is required and valid
if (body.is_recurring && !VALID_PATTERNS.includes(body.recurrence_pattern)) {
  return NextResponse.json(
    { error: 'Invalid recurrence pattern' },
    { status: 400 }
  )
}

// 3. If is_recurring is false, clear recurrence_pattern
if (!body.is_recurring) {
  body.recurrence_pattern = null
}
```

---

### Due Date Calculation

The core logic for computing the next occurrence date:

```typescript
// lib/timezone.ts or within the API route

import { getSingaporeNow } from '@/lib/timezone'

function calculateNextDueDate(
  currentDueDate: string,
  pattern: RecurrencePattern
): string {
  const current = new Date(currentDueDate)

  switch (pattern) {
    case 'daily':
      current.setDate(current.getDate() + 1)
      break
    case 'weekly':
      current.setDate(current.getDate() + 7)
      break
    case 'monthly':
      current.setMonth(current.getMonth() + 1)
      break
    case 'yearly':
      current.setFullYear(current.getFullYear() + 1)
      break
  }

  return current.toISOString()
}
```

**Pattern Details:**

| Pattern | Calculation | Example (from Nov 10) |
|---------|-------------|----------------------|
| Daily | +1 day | Nov 11 |
| Weekly | +7 days | Nov 17 |
| Monthly | +1 month (same date) | Dec 10 |
| Yearly | +1 year | Nov 10 next year |

**Monthly Edge Cases:**
- Jan 31 → Feb 28 (or Feb 29 in leap year) — JavaScript `setMonth` handles overflow by rolling to next month
- Jan 30 → Feb 28/29 — same overflow handling
- Mar 31 → Apr 30 — `setMonth` adjusts

### Next Instance Creation (on Completion)

This logic lives in the `PUT /api/todos/[id]` handler when `completed` is set to `true`:

```typescript
// app/api/todos/[id]/route.ts — PUT handler

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
  const todoId = Number(id)

  // Fetch the current todo
  const existingTodo = todoDB.findById(todoId, session.userId)
  if (!existingTodo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  // Update the current todo
  const updatedTodo = todoDB.update(todoId, session.userId, body)

  // If completing a recurring todo, create the next instance
  if (
    body.completed === true &&
    existingTodo.is_recurring &&
    existingTodo.recurrence_pattern &&
    existingTodo.due_date
  ) {
    const nextDueDate = calculateNextDueDate(
      existingTodo.due_date,
      existingTodo.recurrence_pattern
    )

    // Create next instance with inherited metadata
    const nextTodo = todoDB.create(session.userId, {
      title: existingTodo.title,
      due_date: nextDueDate,
      priority: existingTodo.priority,
      is_recurring: true,
      recurrence_pattern: existingTodo.recurrence_pattern,
      reminder_minutes: existingTodo.reminder_minutes ?? null,
    })

    // Copy tags from the completed todo to the new instance
    const tags = todoTagDB.findByTodoId(todoId)
    for (const tag of tags) {
      todoTagDB.create(nextTodo.id, tag.id)
    }

    return NextResponse.json({
      completed: updatedTodo,
      next: nextTodo,
    })
  }

  return NextResponse.json(updatedTodo)
}
```

**Inherited Metadata:**

| Field | Inherited? | Notes |
|-------|-----------|-------|
| `title` | ✅ Yes | Exact same title |
| `priority` | ✅ Yes | Same priority level |
| `is_recurring` | ✅ Yes | Always `true` |
| `recurrence_pattern` | ✅ Yes | Same pattern |
| `reminder_minutes` | ✅ Yes | Same reminder offset (use `?? null`) |
| `tags` | ✅ Yes | All tag associations copied |
| `due_date` | ✅ Calculated | Next date based on pattern |
| `completed` | ❌ No | New instance starts as incomplete |
| `subtasks` | ❌ No | Not inherited — added after creation |
| `last_notification_sent` | ❌ No | Reset to null for fresh reminder |

---

## UI Components

### Repeat Checkbox and Pattern Dropdown (Create Form)

```tsx
{/* Repeat checkbox */}
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    checked={isRecurring}
    onChange={(e) => {
      setIsRecurring(e.target.checked)
      if (!e.target.checked) {
        setRecurrencePattern(null)
      }
    }}
    className="rounded"
  />
  <span className="text-sm dark:text-gray-300">Repeat</span>
</label>

{/* Pattern dropdown — only enabled when Repeat is checked */}
<select
  value={recurrencePattern ?? ''}
  onChange={(e) => setRecurrencePattern(e.target.value as RecurrencePattern)}
  disabled={!isRecurring}
  className="border rounded-lg px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed
             dark:bg-gray-700 dark:border-gray-600 dark:text-white"
>
  <option value="">Select pattern</option>
  <option value="daily">Daily</option>
  <option value="weekly">Weekly</option>
  <option value="monthly">Monthly</option>
  <option value="yearly">Yearly</option>
</select>
```

### Repeat Controls in Edit Modal

```tsx
{/* Edit modal recurrence section */}
<div className="flex items-center gap-4">
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={editIsRecurring}
      onChange={(e) => {
        setEditIsRecurring(e.target.checked)
        if (!e.target.checked) {
          setEditRecurrencePattern(null)
        }
      }}
      className="rounded"
    />
    <span className="text-sm dark:text-gray-300">Repeat</span>
  </label>

  <select
    value={editRecurrencePattern ?? ''}
    onChange={(e) => setEditRecurrencePattern(e.target.value as RecurrencePattern)}
    disabled={!editIsRecurring}
    className="border rounded-lg px-3 py-2 disabled:opacity-50
               dark:bg-gray-700 dark:border-gray-600 dark:text-white"
  >
    <option value="">Select pattern</option>
    <option value="daily">Daily</option>
    <option value="weekly">Weekly</option>
    <option value="monthly">Monthly</option>
    <option value="yearly">Yearly</option>
  </select>
</div>
```

### Recurrence Badge

Displayed inline next to the priority badge on recurring todos:

```tsx
function RecurrenceBadge({ pattern }: { pattern: RecurrencePattern }) {
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full border
                      bg-purple-100 text-purple-800 border-purple-200
                      dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800">
      🔄 {pattern}
    </span>
  )
}

// Usage in todo item
{todo.is_recurring && todo.recurrence_pattern && (
  <RecurrenceBadge pattern={todo.recurrence_pattern} />
)}
```

**Badge Examples:**

| Pattern | Badge Text | Color |
|---------|-----------|-------|
| Daily | 🔄 daily | Purple |
| Weekly | 🔄 weekly | Purple |
| Monthly | 🔄 monthly | Purple |
| Yearly | 🔄 yearly | Purple |

### Badge Placement

```
☐  Pay rent  [High]  [🔄 monthly]  [🔔 1d]  [Finance]
                       ^^^^^^^^^^^^
                       Recurrence badge after priority badge
```

---

## Edge Cases

### Recurrence + Due Date

| Scenario | Expected Behavior |
|----------|-------------------|
| Enable Repeat without due date | Reject — "Recurring todos must have a due date" |
| Remove due date from recurring todo | Either reject or auto-disable recurrence |
| Due date in the past on recurring todo | Allow completion, next instance calculates from current due date |
| Complete recurring todo that's overdue | Next due date still calculated from original due date, not "now" |

### Pattern Calculations

| Scenario | Expected Behavior |
|----------|-------------------|
| Daily: Nov 10 → | Nov 11 |
| Weekly: Nov 10 (Mon) → | Nov 17 (Mon) |
| Monthly: Jan 31 → | Feb 28 (or 29 in leap year) |
| Monthly: Mar 31 → | Apr 30 (JavaScript overflow handling) |
| Monthly: May 31 → | Jun 30 |
| Yearly: Feb 29, 2024 → | Feb 28, 2025 (non-leap year) |
| Yearly: Feb 29, 2024 → | Feb 29, 2028 (next leap year is 4 years out, but calculation is +1 year) |

### Completion Behavior

| Scenario | Expected Behavior |
|----------|-------------------|
| Complete recurring todo | Current marked complete + new instance created |
| Complete non-recurring todo | Only marked complete, no new instance |
| Uncomplete a completed recurring todo | No effect on the already-created next instance |
| Complete the newly created next instance | Another new instance is created (chain continues) |
| Delete a recurring todo | Only that instance deleted, no new instance created |

### Metadata Inheritance

| Scenario | Expected Behavior |
|----------|-------------------|
| Recurring todo with High priority | Next instance has High priority |
| Recurring todo with tags [Work, Urgent] | Next instance has same tags |
| Recurring todo with reminder (1h before) | Next instance has 1h reminder, `last_notification_sent` is null |
| Recurring todo with subtasks | Subtasks are NOT inherited (user adds fresh) |
| Edit title then complete | Next instance uses original title (at time of completion) |

### Editing Recurrence

| Scenario | Expected Behavior |
|----------|-------------------|
| Change pattern from daily to weekly | Next completion uses weekly calculation |
| Disable recurrence (uncheck Repeat) | Next completion does NOT create new instance |
| Enable recurrence on existing todo | Must have due date; next completion creates new instance |
| Change pattern and due date simultaneously | Both changes saved; next instance uses new pattern + calculates from new due date |

### API Responses

| Scenario | Expected Behavior |
|----------|-------------------|
| Complete recurring todo | Response includes both `completed` and `next` todo objects |
| Complete non-recurring todo | Response includes only updated todo |
| Invalid recurrence_pattern | 400 "Invalid recurrence pattern" |
| is_recurring=true without pattern | 400 "Invalid recurrence pattern" |
| is_recurring=true without due_date | 400 "Recurring todos must have a due date" |

---

## Acceptance Criteria

### Creating Recurring Todos

- [ ] "Repeat" checkbox appears in the create form
- [ ] Pattern dropdown appears and is enabled when "Repeat" is checked
- [ ] Pattern dropdown is disabled when "Repeat" is unchecked
- [ ] Four pattern options are available: Daily, Weekly, Monthly, Yearly
- [ ] Recurring todo requires a due date (validation error without one)
- [ ] Recurring todo requires a valid pattern (validation error without one)
- [ ] Created recurring todo has `is_recurring: true` in database
- [ ] Created recurring todo stores the selected `recurrence_pattern`

### Recurrence Badge

- [ ] Recurring todos display a 🔄 badge with the pattern name
- [ ] Badge is purple with border in light mode
- [ ] Badge adapts for dark mode visibility
- [ ] Badge appears after the priority badge
- [ ] Non-recurring todos do NOT show a 🔄 badge
- [ ] Badge shows correct pattern text (daily/weekly/monthly/yearly)

### Completion Creates Next Instance

- [ ] Completing a recurring todo creates a new todo automatically
- [ ] New todo has the same title as the completed one
- [ ] New todo has the same priority level
- [ ] New todo has `is_recurring: true` and the same pattern
- [ ] New todo has the same `reminder_minutes` value
- [ ] New todo has the same tag associations
- [ ] New todo has `completed: false`
- [ ] New todo has `last_notification_sent: null`
- [ ] New todo does NOT inherit subtasks
- [ ] New todo's due date is correctly calculated based on the pattern

### Due Date Calculation

- [ ] Daily: adds exactly 1 day
- [ ] Weekly: adds exactly 7 days
- [ ] Monthly: adds 1 month (handles month-end overflow)
- [ ] Yearly: adds 1 year (handles leap year)
- [ ] Calculation is based on the current instance's due date, not "now"
- [ ] All calculations respect Singapore timezone

### Editing Recurrence

- [ ] Edit modal shows "Repeat" checkbox with current state
- [ ] Edit modal shows pattern dropdown with current pattern selected
- [ ] Can change pattern (e.g., daily → weekly)
- [ ] Can disable recurrence (uncheck Repeat)
- [ ] Disabling recurrence clears `recurrence_pattern` to null
- [ ] Enabling recurrence on non-recurring todo requires due date
- [ ] Can enable recurrence on an existing non-recurring todo

### Validation

- [ ] API rejects `is_recurring: true` without `due_date` (400)
- [ ] API rejects `is_recurring: true` with invalid `recurrence_pattern` (400)
- [ ] API rejects `is_recurring: true` without `recurrence_pattern` (400)
- [ ] Disabling recurrence sets `recurrence_pattern` to null in database

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/03-recurring-todos.spec.ts

import { test, expect } from '@playwright/test'
import { TodoHelper } from './helpers'

test.describe('Recurring Todos', () => {

  test('should create a daily recurring todo', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Daily standup', {
      priority: 'high',
      dueDate: '2025-12-01T09:00',
      recurring: true,
      recurrencePattern: 'daily',
    })

    await expect(page.getByText('Daily standup')).toBeVisible()
    await expect(page.getByText('🔄 daily')).toBeVisible()
  })

  test('should create a weekly recurring todo', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Weekly review', {
      recurring: true,
      recurrencePattern: 'weekly',
      dueDate: '2025-12-01T10:00',
    })

    await expect(page.getByText('🔄 weekly')).toBeVisible()
  })

  test('should require due date for recurring todo', async ({ page }) => {
    // Attempt to create recurring todo without due date
    await page.fill('input[placeholder*="What needs to be done"]', 'No date recurring')
    await page.check('input[type="checkbox"]') // Repeat checkbox
    await page.selectOption('select:has(option[value="daily"])', 'daily')
    // Leave due date empty
    await page.click('button:has-text("Add")')

    // Should see validation error or todo should not be created
    await expect(page.getByText('No date recurring')).not.toBeVisible()
  })

  test('should create next instance on completion', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Recurring task', {
      recurring: true,
      recurrencePattern: 'daily',
      dueDate: '2025-12-10T09:00',
    })

    // Complete the recurring todo
    await page.locator('input[type="checkbox"]').first().click()

    // Verify completed instance in Completed section
    await expect(page.locator('text=Completed').first()).toBeVisible()

    // Verify new instance created in Pending section
    // There should still be a "Recurring task" in the Pending section
    const pendingSection = page.locator('section:has-text("Pending")')
    await expect(pendingSection.getByText('Recurring task')).toBeVisible()
  })

  test('should inherit priority on next instance', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('High priority recurring', {
      priority: 'high',
      recurring: true,
      recurrencePattern: 'weekly',
      dueDate: '2025-12-10T09:00',
    })

    // Complete it
    await page.locator('input[type="checkbox"]').first().click()

    // New instance should also have High badge
    const pendingSection = page.locator('section:has-text("Pending")')
    await expect(pendingSection.getByText('High')).toBeVisible()
  })

  test('should calculate correct next due date for daily', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Daily task', {
      recurring: true,
      recurrencePattern: 'daily',
      dueDate: '2025-12-10T09:00',
    })

    // Complete it
    await page.locator('input[type="checkbox"]').first().click()

    // Next instance should show Dec 11 due date
    // Exact assertion depends on how due date is displayed
  })

  test('should disable recurrence via edit', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Stop recurring', {
      recurring: true,
      recurrencePattern: 'daily',
      dueDate: '2025-12-10T09:00',
    })

    // Verify badge exists
    await expect(page.getByText('🔄 daily')).toBeVisible()

    // Edit and uncheck Repeat
    await page.click('button:has-text("Edit")')
    await page.uncheck('input[type="checkbox"]:near(:text("Repeat"))')
    await page.click('button:has-text("Update")')

    // Badge should be gone
    await expect(page.getByText('🔄 daily')).not.toBeVisible()
  })

  test('should change recurrence pattern via edit', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Pattern change', {
      recurring: true,
      recurrencePattern: 'daily',
      dueDate: '2025-12-10T09:00',
    })

    await expect(page.getByText('🔄 daily')).toBeVisible()

    // Edit and change pattern
    await page.click('button:has-text("Edit")')
    await page.selectOption('select:has(option[value="weekly"])', 'weekly')
    await page.click('button:has-text("Update")')

    await expect(page.getByText('🔄 weekly')).toBeVisible()
    await expect(page.getByText('🔄 daily')).not.toBeVisible()
  })

  test('should not create next instance for non-recurring todo', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('One-time task', { priority: 'medium' })

    // Get initial count
    const pendingBefore = await page.locator('section:has-text("Pending") [data-testid="todo-item"]').count()

    // Complete it
    await page.locator('input[type="checkbox"]').first().click()

    // Pending count should decrease by 1 (no new instance)
    const pendingAfter = await page.locator('section:has-text("Pending") [data-testid="todo-item"]').count()
    expect(pendingAfter).toBe(pendingBefore - 1)
  })
})
```

### Unit Tests — Due Date Calculation

```typescript
// Unit tests for calculateNextDueDate

import { calculateNextDueDate } from '@/lib/timezone'

describe('calculateNextDueDate', () => {
  test('daily: adds 1 day', () => {
    const result = calculateNextDueDate('2025-11-10T09:00:00', 'daily')
    expect(new Date(result).getDate()).toBe(11)
  })

  test('weekly: adds 7 days', () => {
    const result = calculateNextDueDate('2025-11-10T09:00:00', 'weekly')
    expect(new Date(result).getDate()).toBe(17)
  })

  test('monthly: adds 1 month', () => {
    const result = calculateNextDueDate('2025-11-10T09:00:00', 'monthly')
    const next = new Date(result)
    expect(next.getMonth()).toBe(11) // December (0-indexed)
    expect(next.getDate()).toBe(10)
  })

  test('monthly: handles Jan 31 → Feb 28', () => {
    const result = calculateNextDueDate('2025-01-31T09:00:00', 'monthly')
    const next = new Date(result)
    expect(next.getMonth()).toBe(1) // February
    expect(next.getDate()).toBe(28)
  })

  test('monthly: handles leap year Feb 29', () => {
    const result = calculateNextDueDate('2024-01-31T09:00:00', 'monthly')
    const next = new Date(result)
    expect(next.getMonth()).toBe(1)
    expect(next.getDate()).toBeLessThanOrEqual(29)
  })

  test('yearly: adds 1 year', () => {
    const result = calculateNextDueDate('2025-11-10T09:00:00', 'yearly')
    expect(new Date(result).getFullYear()).toBe(2026)
  })

  test('yearly: handles leap year Feb 29 → Feb 28', () => {
    const result = calculateNextDueDate('2024-02-29T09:00:00', 'yearly')
    const next = new Date(result)
    expect(next.getFullYear()).toBe(2025)
    expect(next.getMonth()).toBe(1)
    expect(next.getDate()).toBe(28) // 2025 is not a leap year
  })
})
```

### API Integration Tests

```typescript
// Test recurring-specific API behavior

test('completing recurring todo returns completed + next', async () => {
  // Create recurring todo via API
  const createRes = await fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Recurring API test',
      due_date: '2025-12-10T09:00',
      is_recurring: true,
      recurrence_pattern: 'daily',
    }),
    headers: { 'Content-Type': 'application/json' },
  })
  const created = await createRes.json()

  // Complete it
  const completeRes = await fetch(`/api/todos/${created.id}`, {
    method: 'PUT',
    body: JSON.stringify({ completed: true }),
    headers: { 'Content-Type': 'application/json' },
  })
  const result = await completeRes.json()

  expect(result.completed).toBeDefined()
  expect(result.next).toBeDefined()
  expect(result.next.title).toBe('Recurring API test')
  expect(result.next.is_recurring).toBe(true)
  expect(result.next.completed).toBe(false)
})

test('rejects recurring todo without due date', async () => {
  const res = await fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify({
      title: 'No date',
      is_recurring: true,
      recurrence_pattern: 'daily',
    }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(400)
})

test('rejects recurring todo without pattern', async () => {
  const res = await fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify({
      title: 'No pattern',
      due_date: '2025-12-10T09:00',
      is_recurring: true,
    }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(400)
})

test('rejects invalid recurrence pattern', async () => {
  const res = await fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Bad pattern',
      due_date: '2025-12-10T09:00',
      is_recurring: true,
      recurrence_pattern: 'biweekly',
    }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(400)
})
```

---

## Out of Scope

These are related features handled by other PRPs:

- Todo CRUD basics (create, read, update, delete) → **PRP 01**
- Priority badge colors and sorting → **PRP 02**
- Reminder timing and `reminder_minutes` inheritance details → **PRP 04**
- Subtask behavior (not inherited by next instance) → **PRP 05**
- Tag system and `todoTagDB` operations → **PRP 06**
- Templates for recurring patterns → **PRP 07**
- Filtering recurring vs non-recurring → **PRP 08**
- Exporting recurring metadata → **PRP 09**
- Calendar display of recurring series → **PRP 10**

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Next instance creation reliability | 100% — every recurring completion creates exactly one new instance |
| Due date calculation accuracy | 100% — correct for all patterns including edge cases |
| Metadata inheritance completeness | 100% — priority, pattern, reminder, tags all copied |
| API validation coverage | 100% — all invalid recurrence inputs rejected with 400 |
| E2E test pass rate | 100% |
| Badge render correctness | 100% — pattern text matches database value |
| Monthly overflow handling | Correct for all 12 months |
| Leap year handling | Correct for Feb 29 calculations |

---

## Implementation Notes

### Project-Specific Patterns

1. **Next instance creation happens in the PUT handler** — not in the client. The API creates the new todo server-side when `completed: true` is received for a recurring todo.
2. **Response shape changes** — when completing a recurring todo, the API returns `{ completed, next }` instead of a single todo. The client must handle both cases.
3. **Tag copying uses `todoTagDB`** — after creating the next instance, iterate over the completed todo's tags and associate them with the new todo via `todoTagDB.create()`.
4. **Use `?? null` for `reminder_minutes`** — the field can be `undefined` from the database; always null-coalesce before passing to `todoDB.create()`.
5. **`params` is async in Next.js 16** — always `const { id } = await params` in route handlers.
6. **Immutability** — never mutate the existing todo object. Create fresh objects for the next instance.
7. **Client refresh** — after completing a recurring todo, re-fetch the full todo list to see both the completed and new instances.

### File Locations

```
app/api/todos/[id]/route.ts    # PUT handler — next instance creation logic
lib/db.ts                       # todoDB.create(), todoTagDB operations
lib/timezone.ts                 # calculateNextDueDate() function
app/page.tsx                    # UI: Repeat checkbox, pattern dropdown, 🔄 badge
```

### Dependencies

No additional dependencies beyond PRP 01. Recurrence uses:
- JavaScript `Date` methods for date arithmetic (`setDate`, `setMonth`, `setFullYear`)
- `lib/timezone.ts` for Singapore timezone awareness
- Existing `todoDB` and `todoTagDB` from `lib/db.ts`
