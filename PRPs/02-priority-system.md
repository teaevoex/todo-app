# PRP 02: Priority System

## Feature Overview

Implement a three-level priority system (High, Medium, Low) for todos with color-coded badges, automatic sorting, and priority-based filtering. Priority is a core attribute of every todo, with `'medium'` as the default. This feature builds directly on the Todo CRUD foundation from **PRP 01**.

---

## User Stories

### As a user, I want to:

1. **Assign a priority level** when creating a todo so I can indicate its importance
2. **See color-coded badges** on each todo so I can visually scan urgency at a glance
3. **Change a todo's priority** via the edit modal so I can adjust importance over time
4. **Filter todos by priority** so I can focus on tasks of a specific importance level
5. **Have todos auto-sorted by priority** so the most urgent items always appear first
6. **See priority badges adapt in dark mode** so they remain readable in all lighting conditions

---

## User Flow

### Assigning Priority on Creation

```
1. User enters a todo title in the form
2. User clicks the Priority dropdown (defaults to "Medium")
3. User selects High, Medium, or Low
4. User clicks "Add"
5. Todo appears in the list with a color-coded priority badge
6. Dropdown resets to "Medium" for the next entry
```

### Changing Priority via Edit

```
1. User clicks "Edit" on an existing todo
2. Edit modal opens with the current priority pre-selected
3. User changes the priority dropdown to a different level
4. User clicks "Update"
5. Badge color updates immediately in the list
6. Todo re-sorts to its new position based on the updated priority
```

### Filtering by Priority

```
1. User locates the "All Priorities" dropdown in the filter bar
2. User selects "High Priority", "Medium Priority", or "Low Priority"
3. Todo list updates to show only matching todos
4. Section counters (Overdue, Pending, Completed) reflect filtered counts
5. User selects "All Priorities" to clear the filter
```

---

## Technical Requirements

### Database Schema

Priority is stored in the `todos` table (defined in PRP 01):

```sql
-- priority column in todos table
priority TEXT NOT NULL DEFAULT 'medium'
-- Valid values: 'high', 'medium', 'low'
```

No additional tables or migrations are needed for this feature.

### TypeScript Types

```typescript
// lib/db.ts

export type Priority = 'high' | 'medium' | 'low'

// Priority is used within the Todo interface (defined in PRP 01)
export interface Todo {
  id: number
  user_id: number
  title: string
  completed: boolean
  due_date: string | null
  priority: Priority
  // ... other fields
}
```

### Validation

Priority validation in API routes:

```typescript
const VALID_PRIORITIES: Priority[] = ['high', 'medium', 'low']

// In POST /api/todos and PUT /api/todos/[id]
if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
  return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
}
```

### Default Behavior

- When no priority is provided during creation, default to `'medium'`
- The create form dropdown defaults to `'medium'`
- Imported todos without a priority field should default to `'medium'`

---

## UI Components

### Priority Badge

A small color-coded label displayed inline next to the todo title:

```tsx
function PriorityBadge({ priority }: { priority: Priority }) {
  const styles = {
    high: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
    low: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  }

  const labels = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  }

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${styles[priority]}`}>
      {labels[priority]}
    </span>
  )
}
```

**Visual Mapping:**

| Priority | Light Mode | Dark Mode | Text |
|----------|-----------|-----------|------|
| High | 🔴 Red background, dark red text | Muted red bg, bright red text | "High" |
| Medium | 🟡 Yellow background, dark yellow text | Muted yellow bg, bright yellow text | "Medium" |
| Low | 🔵 Blue background, dark blue text | Muted blue bg, bright blue text | "Low" |

### Priority Dropdown (Create Form)

```tsx
<select
  value={newPriority}
  onChange={(e) => setNewPriority(e.target.value as Priority)}
  className="border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
>
  <option value="medium">Medium</option>
  <option value="high">High</option>
  <option value="low">Low</option>
</select>
```

### Priority Dropdown (Edit Modal)

```tsx
<label className="block text-sm font-medium mb-1">Priority</label>
<select
  value={editPriority}
  onChange={(e) => setEditPriority(e.target.value as Priority)}
  className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
>
  <option value="high">High</option>
  <option value="medium">Medium</option>
  <option value="low">Low</option>
</select>
```

### Priority Filter Dropdown

```tsx
<select
  value={priorityFilter}
  onChange={(e) => setPriorityFilter(e.target.value)}
  className="border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
>
  <option value="">All Priorities</option>
  <option value="high">High Priority</option>
  <option value="medium">Medium Priority</option>
  <option value="low">Low Priority</option>
</select>
```

### Badge Placement in Todo Item

Badges appear inline after the todo title, before due date info:

```
☐  Buy groceries  [Medium]  [🔄 weekly]  [🔔 1h]  [Work]
                    ^^^^^^^^
                    Priority badge is here
```

---

## Sorting Logic

Priority drives the primary sort order within each section (Overdue, Pending, Completed):

```typescript
const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    // 1. Priority (high first)
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (pDiff !== 0) return pDiff

    // 2. Due date (earliest first, nulls last)
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    }
    if (a.due_date) return -1
    if (b.due_date) return 1

    // 3. Creation date (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}
```

**Sort Result Example:**

```
1. High priority, due today
2. High priority, due tomorrow
3. High priority, no due date
4. Medium priority, due today
5. Medium priority, due next week
6. Medium priority, no due date
7. Low priority, due tomorrow
8. Low priority, no due date
```

---

## Filtering Logic

Priority filtering is applied client-side before section classification:

```typescript
const [priorityFilter, setPriorityFilter] = useState<string>('')

// Apply filter before classifying into sections
const filteredTodos = priorityFilter
  ? todos.filter(todo => todo.priority === priorityFilter)
  : todos

// Then classify into overdue / pending / completed
const { overdue, pending, completed } = classifyTodos(filteredTodos)
```

**Filter Behavior:**
- `""` (empty string) — Show all priorities
- `"high"` — Show only high-priority todos
- `"medium"` — Show only medium-priority todos
- `"low"` — Show only low-priority todos

**Combined Filters:**
Priority filter works with AND logic alongside other filters (search, tags, date range, completion status). See PRP 08 for full filter combination details.

---

## Edge Cases

### Priority Values

| Scenario | Expected Behavior |
|----------|-------------------|
| No priority specified on creation | Default to `'medium'` |
| Invalid priority value in API | Reject with 400 "Invalid priority" |
| Priority field missing in import | Default to `'medium'` |
| Case-sensitive check (`"High"` vs `"high"`) | Reject — must be lowercase |

### Sorting

| Scenario | Expected Behavior |
|----------|-------------------|
| All todos same priority | Sort by due date, then creation date |
| Mix of priorities with no due dates | Priority order maintained, no-due-date at bottom |
| Single todo in list | Displayed without sorting issues |
| Empty todo list | No errors, empty sections shown |

### Filtering

| Scenario | Expected Behavior |
|----------|-------------------|
| Filter shows 0 results | Sections hidden, empty state message |
| Filter + search combined | AND logic — must match both |
| Filter cleared | All todos visible again |
| Filter persists across operations | Filter stays active after CRUD operations |
| Filter applied to overdue section | Overdue section also filtered by priority |

### Visual Display

| Scenario | Expected Behavior |
|----------|-------------------|
| Dark mode enabled | Badge uses muted background, bright text |
| Light mode enabled | Badge uses light colored background, dark text |
| Badge in overdue section (red bg) | Badge remains distinguishable |
| Badge in completed section (strikethrough) | Badge still visible and colored |
| Very long todo title with badge | Badge stays inline, doesn't wrap separately |

### Priority Changes

| Scenario | Expected Behavior |
|----------|-------------------|
| Change High → Low | Todo re-sorts to lower position |
| Change Low → High | Todo re-sorts to higher position |
| Change priority of completed todo | Badge updates, sort within Completed section |
| Change priority of overdue todo | Badge updates, sort within Overdue section |

---

## Acceptance Criteria

### Priority Assignment

- [ ] Priority dropdown appears in the create form with three options: High, Medium, Low
- [ ] Default selected value is "Medium"
- [ ] Selected priority is sent to the API on creation
- [ ] created todo has the correct priority stored in the database

### Priority Badge Display

- [ ] Every todo displays a color-coded priority badge
- [ ] High = red badge, Medium = yellow badge, Low = blue badge
- [ ] Badge text shows "High", "Medium", or "Low"
- [ ] Badge is visible in all sections (Overdue, Pending, Completed)
- [ ] Badge adapts correctly in dark mode
- [ ] Badge maintains WCAG AA contrast ratio in both themes

### Priority Editing

- [ ] Edit modal shows a priority dropdown pre-filled with the current value
- [ ] Changing priority and clicking "Update" saves the new value
- [ ] Badge updates immediately without page refresh
- [ ] Todo re-sorts to its new correct position

### Priority Sorting

- [ ] High-priority todos appear before Medium within each section
- [ ] Medium-priority todos appear before Low within each section
- [ ] Secondary sort is by due date (earliest first)
- [ ] Tertiary sort is by creation date (newest first)
- [ ] Sorting is consistent across Overdue, Pending, and Completed sections

### Priority Filtering

- [ ] "All Priorities" dropdown is visible in the filter bar
- [ ] Selecting "High Priority" shows only high-priority todos
- [ ] Selecting "Medium Priority" shows only medium-priority todos
- [ ] Selecting "Low Priority" shows only low-priority todos
- [ ] Selecting "All Priorities" clears the filter
- [ ] Section counters update to reflect filtered counts
- [ ] Filter combines with search and tag filters (AND logic)

### Validation

- [ ] API rejects invalid priority values with 400 status
- [ ] Missing priority defaults to `'medium'` on creation
- [ ] Priority field is always one of: `'high'`, `'medium'`, `'low'`

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/02-todo-crud.spec.ts (extend existing file or create separate)

import { test, expect } from '@playwright/test'
import { TodoHelper } from './helpers'

test.describe('Priority System', () => {

  test('should create todo with default medium priority', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Default priority task')

    // Verify medium badge is visible
    const badge = page.locator('text=Medium').first()
    await expect(badge).toBeVisible()
  })

  test('should create todo with high priority', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Urgent task', { priority: 'high' })

    const badge = page.locator('text=High').first()
    await expect(badge).toBeVisible()
    // Verify red-ish styling
    await expect(badge).toHaveCSS('color', /red|rgb\(.*\)/)
  })

  test('should create todo with low priority', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Someday task', { priority: 'low' })

    const badge = page.locator('text=Low').first()
    await expect(badge).toBeVisible()
  })

  test('should edit priority from medium to high', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Changeable task', { priority: 'medium' })

    // Open edit modal
    await page.click('button:has-text("Edit")')

    // Change priority
    await page.selectOption('select', 'high')
    await page.click('button:has-text("Update")')

    // Verify badge updated
    const badge = page.locator('text=High').first()
    await expect(badge).toBeVisible()
  })

  test('should sort todos by priority within a section', async ({ page }) => {
    const helper = new TodoHelper(page)

    // Create in reverse order
    await helper.createTodo('Low task', { priority: 'low' })
    await helper.createTodo('High task', { priority: 'high' })
    await helper.createTodo('Medium task', { priority: 'medium' })

    // Get all todo titles in order
    const titles = await page.locator('[data-testid="todo-title"]').allTextContents()

    // Verify High → Medium → Low order
    const highIndex = titles.indexOf('High task')
    const mediumIndex = titles.indexOf('Medium task')
    const lowIndex = titles.indexOf('Low task')

    expect(highIndex).toBeLessThan(mediumIndex)
    expect(mediumIndex).toBeLessThan(lowIndex)
  })

  test('should filter by high priority', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('High task', { priority: 'high' })
    await helper.createTodo('Low task', { priority: 'low' })

    // Apply high priority filter
    await page.selectOption('[data-testid="priority-filter"]', 'high')

    // Only high priority todo visible
    await expect(page.getByText('High task')).toBeVisible()
    await expect(page.getByText('Low task')).not.toBeVisible()
  })

  test('should show all todos when filter cleared', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('High task', { priority: 'high' })
    await helper.createTodo('Low task', { priority: 'low' })

    // Apply then clear filter
    await page.selectOption('[data-testid="priority-filter"]', 'high')
    await page.selectOption('[data-testid="priority-filter"]', '')

    // Both visible again
    await expect(page.getByText('High task')).toBeVisible()
    await expect(page.getByText('Low task')).toBeVisible()
  })

  test('should display correct badge colors in light mode', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Red badge', { priority: 'high' })
    await helper.createTodo('Yellow badge', { priority: 'medium' })
    await helper.createTodo('Blue badge', { priority: 'low' })

    // Verify badge elements exist with correct text
    await expect(page.locator('text=High').first()).toBeVisible()
    await expect(page.locator('text=Medium').first()).toBeVisible()
    await expect(page.locator('text=Low').first()).toBeVisible()
  })

  test('should reject invalid priority via API', async ({ request }) => {
    const res = await request.post('/api/todos', {
      data: { title: 'Bad priority', priority: 'urgent' },
      headers: { 'Content-Type': 'application/json' }
    })
    expect(res.status()).toBe(400)
  })
})
```

### Visual / Dark Mode Tests

```typescript
test.describe('Priority Badges - Dark Mode', () => {

  test.use({
    colorScheme: 'dark',
  })

  test('should display adapted badge colors in dark mode', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Dark mode task', { priority: 'high' })

    const badge = page.locator('text=High').first()
    await expect(badge).toBeVisible()
    // Badge should be readable in dark mode
  })
})
```

---

## Out of Scope

These are related features handled by other PRPs:

- Todo creation and deletion mechanics → **PRP 01**
- Recurring todo behavior on completion → **PRP 03**
- Reminder timing and notifications → **PRP 04**
- Subtask progress tracking → **PRP 05**
- Tag color system → **PRP 06**
- Template priority inheritance → **PRP 07**
- Combined multi-criteria filtering → **PRP 08**
- Export/import of priority data → **PRP 09**
- Calendar color-coding by priority → **PRP 10**

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Badge render time | < 16ms (60fps, no layout shift) |
| Priority filter response | Instant (client-side, < 50ms) |
| Sort correctness | 100% — High always before Medium before Low |
| Dark mode contrast | WCAG AA (4.5:1 minimum for text) |
| E2E test pass rate | 100% |
| Invalid priority rejection | 100% of invalid values produce 400 |
| Default priority accuracy | 100% of todos without explicit priority are `'medium'` |

---

## Implementation Notes

### Project-Specific Patterns

1. **Priority is stored as a TEXT column** — not an integer enum. Use string comparison.
2. **Sorting is client-side** — the API returns todos, and `app/page.tsx` sorts them before rendering.
3. **Filter state is React state** — no URL params or server-side filtering for priority.
4. **Badge component lives inline** in `app/page.tsx` — the monolithic UI pattern (see copilot-instructions).
5. **Immutability** — always use `[...todos].sort()`, never mutate the original array.
6. **Dark mode** via Tailwind `dark:` variant — uses `prefers-color-scheme` media query, no manual toggle.

### Color Reference

```
Light Mode:
  High:   bg-red-100    text-red-800    border-red-200
  Medium: bg-yellow-100 text-yellow-800 border-yellow-200
  Low:    bg-blue-100   text-blue-800   border-blue-200

Dark Mode:
  High:   bg-red-900/30    text-red-300    border-red-800
  Medium: bg-yellow-900/30 text-yellow-300 border-yellow-800
  Low:    bg-blue-900/30   text-blue-300   border-blue-800
```

### Dependencies

No additional dependencies beyond PRP 01. Priority uses:
- Tailwind CSS 4 for badge styling and dark mode
- React state for filter management
- Existing `Todo` interface from `lib/db.ts`
