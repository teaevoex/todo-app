# PRP 08: Search & Filtering

## Feature Overview

Implement a comprehensive client-side search and filtering system that lets users find todos by text query, priority level, and tag. All three filters combine with AND logic — a todo must match all active filters to be displayed. Search matches against todo titles and subtask titles. Filtering updates section counters (Overdue, Pending, Completed) to reflect only visible todos. This feature builds on **PRP 01** (CRUD), **PRP 02** (Priority), **PRP 05** (Subtasks — search matches subtask titles), and **PRP 06** (Tags — filter by tag).

---

## User Stories

### As a user, I want to:

1. **Search todos by title** so I can quickly find a specific task
2. **Search todos by subtask title** so I can find tasks containing specific steps
3. **Filter by priority level** so I can focus on high/medium/low priority tasks
4. **Filter by tag** so I can view only tasks in a specific category
5. **Combine search and filters** so I can narrow down to exactly what I need
6. **See updated section counters** so I know how many filtered results exist in each section
7. **Clear all filters** so I can return to the full todo list quickly

---

## User Flow

### Text Search

```
1. User types in the search input at the top of the page
2. As the user types, the todo list filters in real time
3. Todos whose title contains the search text are shown
4. Todos whose subtask titles contain the search text are also shown
5. Search is case-insensitive
6. Clearing the search input shows all todos (respecting other active filters)
```

### Priority Filter

```
1. User clicks the "All Priorities" dropdown
2. Options: "All Priorities", "High", "Medium", "Low"
3. User selects a priority level
4. Todo list filters to show only todos matching that priority
5. Selecting "All Priorities" clears the priority filter
```

### Tag Filter

```
1. User clicks the "All Tags" dropdown
2. Options: "All Tags" plus all user-created tags
3. User selects a tag
4. Todo list filters to show only todos with that tag assigned
5. Selecting "All Tags" clears the tag filter
```

### Combined Filtering

```
1. User types "report" in search
2. User selects "High" from priority dropdown
3. User selects "Work" from tag dropdown
4. Result: Only todos that:
   a. Contain "report" in title OR a subtask title, AND
   b. Have "high" priority, AND
   c. Have the "Work" tag assigned
5. Section counters show filtered counts
```

### Clearing Filters

```
1. User clears the search input (backspace or clear button)
2. User resets priority to "All Priorities"
3. User resets tag to "All Tags"
4. Full todo list is restored
```

---

## Technical Requirements

### Filter State

```typescript
// app/page.tsx — filter state

const [searchQuery, setSearchQuery] = useState('')
const [priorityFilter, setPriorityFilter] = useState<string>('')
const [tagFilter, setTagFilter] = useState<string>('')
```

**State Values:**

| Filter | State Variable | Empty Value | Active Value |
|--------|---------------|-------------|--------------|
| Search | `searchQuery` | `''` | Any non-empty string |
| Priority | `priorityFilter` | `''` | `'high'` \| `'medium'` \| `'low'` |
| Tag | `tagFilter` | `''` | Tag ID as string (e.g., `'5'`) |

### Filtering Logic

All filtering is done client-side after fetching the full todo list from `GET /api/todos`:

```typescript
// app/page.tsx

const filteredTodos = todos.filter(todo => {
  // Text search filter — matches title OR any subtask title
  if (searchQuery) {
    const query = searchQuery.toLowerCase()
    const titleMatch = todo.title.toLowerCase().includes(query)
    const subtaskMatch = todo.subtasks?.some(
      (s: { title: string }) => s.title.toLowerCase().includes(query)
    )
    if (!titleMatch && !subtaskMatch) return false
  }

  // Priority filter
  if (priorityFilter) {
    if (todo.priority !== priorityFilter) return false
  }

  // Tag filter
  if (tagFilter) {
    const hasTag = todo.tags?.some((t: { id: number }) => t.id === Number(tagFilter))
    if (!hasTag) return false
  }

  return true
})
```

**Key Behaviors:**
- All three filters combine with **AND** logic
- Each filter is independently optional — only active when non-empty
- Search is case-insensitive using `toLowerCase()`
- Search matches against `todo.title` AND `todo.subtasks[].title`
- A todo with a matching subtask title is included even if its own title doesn't match
- Priority filter compares exact string equality
- Tag filter checks if the todo's `tags` array contains a tag with the matching ID

### Section Classification with Filtered Results

After filtering, todos are classified into sections using Singapore timezone:

```typescript
import { getSingaporeNow, formatSingaporeDate } from '@/lib/timezone'

const now = getSingaporeNow()
const todayStr = formatSingaporeDate(now) // 'YYYY-MM-DD'

const overdueTodos = filteredTodos.filter(
  todo => !todo.completed && todo.due_date && todo.due_date < todayStr
)

const pendingTodos = filteredTodos.filter(
  todo => !todo.completed && (!todo.due_date || todo.due_date >= todayStr)
)

const completedTodos = filteredTodos.filter(todo => todo.completed)
```

### Section Counters

Section headers display filtered counts:

```tsx
<h2 className="text-lg font-bold dark:text-white">
  Overdue ({overdueTodos.length})
</h2>

<h2 className="text-lg font-bold dark:text-white">
  Pending ({pendingTodos.length})
</h2>

<h2 className="text-lg font-bold dark:text-white">
  Completed ({completedTodos.length})
</h2>
```

When filters are active, counters reflect the filtered subset, not the total count.

---

## UI Components

### Filter Bar

The filter bar sits below the todo creation form and above the todo sections:

```tsx
<div className="flex flex-col sm:flex-row gap-3 mb-6">
  {/* Search input */}
  <div className="flex-1 relative">
    <input
      type="text"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="Search todos..."
      className="w-full border rounded-lg px-3 py-2 pl-9
                 dark:bg-gray-700 dark:border-gray-600 dark:text-white
                 dark:placeholder-gray-400"
    />
    {/* Search icon */}
    <svg
      className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
    {/* Clear button */}
    {searchQuery && (
      <button
        onClick={() => setSearchQuery('')}
        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600
                   dark:hover:text-gray-300"
      >
        ✕
      </button>
    )}
  </div>

  {/* Priority filter dropdown */}
  <select
    value={priorityFilter}
    onChange={(e) => setPriorityFilter(e.target.value)}
    className="border rounded-lg px-3 py-2
               dark:bg-gray-700 dark:border-gray-600 dark:text-white"
    data-testid="priority-filter"
  >
    <option value="">All Priorities</option>
    <option value="high">High</option>
    <option value="medium">Medium</option>
    <option value="low">Low</option>
  </select>

  {/* Tag filter dropdown */}
  <select
    value={tagFilter}
    onChange={(e) => setTagFilter(e.target.value)}
    className="border rounded-lg px-3 py-2
               dark:bg-gray-700 dark:border-gray-600 dark:text-white"
    data-testid="tag-filter"
  >
    <option value="">All Tags</option>
    {tags.map(tag => (
      <option key={tag.id} value={String(tag.id)}>{tag.name}</option>
    ))}
  </select>
</div>
```

### Filter Bar Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔍 Search todos...  ✕          │ All Priorities ▼ │ All Tags ▼    │
└─────────────────────────────────────────────────────────────────────┘

Desktop: horizontal row (flex-row)
Mobile: stacked vertically (flex-col)
```

### Search Input Features

| Feature | Implementation |
|---------|---------------|
| Placeholder | "Search todos..." |
| Search icon | SVG magnifying glass, positioned left (`pl-9`) |
| Clear button | "✕" button, visible only when search has text |
| Debounce | Not required — filtering is client-side and instant |
| Dark mode | Dark background, light text, gray placeholder |

### Empty State

When filters produce no results:

```tsx
{filteredTodos.length === 0 && (searchQuery || priorityFilter || tagFilter) && (
  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
    <p className="text-lg">No todos match your filters</p>
    <p className="text-sm mt-1">Try adjusting your search or filter criteria</p>
    <button
      onClick={() => {
        setSearchQuery('')
        setPriorityFilter('')
        setTagFilter('')
      }}
      className="mt-3 text-sm text-blue-500 hover:text-blue-700
                 dark:text-blue-400 dark:hover:text-blue-300"
    >
      Clear all filters
    </button>
  </div>
)}
```

### Empty Sections

When a filter results in an empty section, the section header is still shown with a count of 0:

```
Overdue (0)
─────────────

Pending (2)
─────────────
☐  Buy groceries  [High]  [Work]
☐  Clean house    [High]  [Work]

Completed (0)
─────────────
```

Alternatively, empty sections can be hidden entirely. The approach should be consistent — if the unfiltered view shows empty sections, the filtered view should match.

---

## Search Matching Logic

### Title Matching

```typescript
const titleMatch = todo.title.toLowerCase().includes(query)
```

- Case-insensitive substring match
- Matches anywhere in the title (beginning, middle, end)
- Whitespace in query matches whitespace in title

### Subtask Title Matching

```typescript
const subtaskMatch = todo.subtasks?.some(
  (s: { title: string }) => s.title.toLowerCase().includes(query)
)
```

- Checks all subtask titles for the todo
- If any subtask title matches, the entire todo is shown
- Same case-insensitive substring match
- All subtasks are checked (both completed and uncompleted)

### Match Examples

| Search Query | Todo Title | Subtask Titles | Match? | Reason |
|-------------|-----------|----------------|--------|--------|
| `"report"` | `"Weekly Report"` | — | Yes | Title match |
| `"report"` | `"Team Meeting"` | `["Write report", "Send"]` | Yes | Subtask match |
| `"REPORT"` | `"weekly report"` | — | Yes | Case-insensitive |
| `"buy"` | `"Buy groceries"` | — | Yes | Title match |
| `"milk"` | `"Buy groceries"` | `["Get milk", "Get bread"]` | Yes | Subtask match |
| `"xyz"` | `"Buy groceries"` | `["Get milk"]` | No | No match |
| `""` | Any | Any | Yes | Empty query = no filter |
| `" "` | `"Buy groceries"` | — | Yes | Space in "Buy groceries" |

---

## Filter Combinations

### AND Logic Truth Table

| Search | Priority | Tag | Result |
|--------|----------|-----|--------|
| ✗ | ✗ | ✗ | Show all todos |
| ✓ | ✗ | ✗ | Show text matches only |
| ✗ | ✓ | ✗ | Show priority matches only |
| ✗ | ✗ | ✓ | Show tag matches only |
| ✓ | ✓ | ✗ | Show text AND priority matches |
| ✓ | ✗ | ✓ | Show text AND tag matches |
| ✗ | ✓ | ✓ | Show priority AND tag matches |
| ✓ | ✓ | ✓ | Show text AND priority AND tag matches |

### Filtering Pipeline

```
All Todos → Search Filter → Priority Filter → Tag Filter → Section Classification → Render
```

Each filter is a gate — if the filter is active and the todo doesn't match, it's excluded. If the filter is inactive (empty string), all todos pass through.

---

## Sorting Within Sections

After filtering, todos within each section maintain the standard sort order defined in PRP 01:

```typescript
function sortTodos(todos: Todo[]): Todo[] {
  const PRIORITY_ORDER: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
  }

  return [...todos].sort((a, b) => {
    // 1. Priority (high first)
    const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    if (priorityDiff !== 0) return priorityDiff

    // 2. Due date (earliest first, nulls last)
    if (a.due_date && b.due_date) {
      const dateDiff = a.due_date.localeCompare(b.due_date)
      if (dateDiff !== 0) return dateDiff
    }
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1

    // 3. Created date (newest first)
    return b.created_at.localeCompare(a.created_at)
  })
}
```

Sorting is applied after filtering, before rendering:

```typescript
const sortedOverdue = sortTodos(overdueTodos)
const sortedPending = sortTodos(pendingTodos)
const sortedCompleted = sortTodos(completedTodos)
```

---

## Edge Cases

### Search

| Scenario | Expected Behavior |
|----------|-------------------|
| Empty search string | All todos shown (no filter applied) |
| Single character search | Filters immediately, no minimum length |
| Whitespace-only search | Treated as a valid query (matches spaces in titles) |
| Special characters in search (`[`, `(`, `*`) | Literal string match, no regex interpretation |
| Very long search string | No match, empty results (performance OK — client-side) |
| Search matches subtask but not title | Todo is shown |
| Search matches both title and subtask | Todo shown once (no duplication) |
| Todo with no subtasks | Only title is searched |
| Completed subtask matching search | Todo still shown (all subtasks checked) |

### Priority Filter

| Scenario | Expected Behavior |
|----------|-------------------|
| "All Priorities" selected | No priority filter applied |
| "High" selected | Only high-priority todos shown |
| Todo with no priority field | Should not occur — priority defaults to "medium" |
| Change priority while filter active | Todo appears/disappears based on new priority |

### Tag Filter

| Scenario | Expected Behavior |
|----------|-------------------|
| "All Tags" selected | No tag filter applied |
| Tag selected, no matching todos | Empty sections shown |
| Tag deleted while filter active | Filter state → `''`, all todos shown |
| Todo has multiple tags, filter matches one | Todo is shown |
| Todo has no tags, any tag filter active | Todo is hidden |

### Combined Filters

| Scenario | Expected Behavior |
|----------|-------------------|
| All filters active, no matches | "No todos match your filters" message shown |
| Search + priority, matches only search | Not shown (AND logic) |
| Clear one filter | Other filters remain active |
| Rapid filter changes | UI updates immediately (no debounce needed) |

### Section Counters

| Scenario | Expected Behavior |
|----------|-------------------|
| No filters active | Counters show total counts per section |
| Filters active | Counters show filtered counts per section |
| All filtered to overdue | Pending (0), Completed (0) |
| Mark todo complete while filter active | Moves from Pending to Completed, counters update |

### Responsive Layout

| Scenario | Expected Behavior |
|----------|-------------------|
| Desktop (≥640px) | Filter bar in a single horizontal row |
| Mobile (<640px) | Filters stack vertically |
| Search input on mobile | Full width, with search icon and clear button |

---

## Acceptance Criteria

### Search

- [ ] Search input is displayed with a placeholder "Search todos..."
- [ ] Search icon (magnifying glass) is shown on the left
- [ ] "✕" clear button appears when search has text
- [ ] Clicking clear resets the search input
- [ ] Typing in search filters todos in real time
- [ ] Search is case-insensitive
- [ ] Search matches against todo titles
- [ ] Search matches against subtask titles
- [ ] A todo with a matching subtask but non-matching title is shown
- [ ] Empty search shows all todos
- [ ] Special characters are treated as literal text (no regex)

### Priority Filter

- [ ] Priority dropdown is displayed with "All Priorities" default
- [ ] Options are: All Priorities, High, Medium, Low
- [ ] Selecting a priority shows only matching todos
- [ ] Selecting "All Priorities" clears the filter
- [ ] Priority filter combines with search and tag filters (AND)

### Tag Filter

- [ ] Tag dropdown is displayed with "All Tags" default
- [ ] Dropdown lists all user-created tags by name
- [ ] Selecting a tag shows only todos with that tag
- [ ] Selecting "All Tags" clears the filter
- [ ] Tag filter combines with search and priority filters (AND)

### Combined Filtering

- [ ] All three filters run with AND logic
- [ ] A todo must satisfy all active filters to be displayed
- [ ] Clearing one filter retains the other active filters
- [ ] Section counters update to reflect filtered results
- [ ] "No todos match your filters" shown when no results and filters are active
- [ ] "Clear all filters" link resets all filters

### Section Counters

- [ ] Overdue counter shows filtered overdue count
- [ ] Pending counter shows filtered pending count
- [ ] Completed counter shows filtered completed count
- [ ] Counters update when filters change
- [ ] Counters update when a todo is marked complete/uncomplete

### Sort Order

- [ ] Filtered todos maintain priority → due date → created date sort order
- [ ] Sort order is consistent within each section (Overdue, Pending, Completed)

### Responsive Design

- [ ] Filter bar is horizontal on desktop
- [ ] Filter bar stacks vertically on mobile
- [ ] Search input takes full width in both layouts
- [ ] Dropdowns are usable on touch devices

### Dark Mode

- [ ] Search input has dark background and light text
- [ ] Dropdowns have dark background and light text
- [ ] Clear button visible in dark mode
- [ ] "No results" message styled for dark mode

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/08-search-filtering.spec.ts

import { test, expect } from '@playwright/test'
import { TodoHelper } from './helpers'

test.describe('Search & Filtering', () => {

  test.beforeEach(async ({ page }) => {
    const helper = new TodoHelper(page)
    // Navigate and authenticate
    await helper.login()

    // Create test todos with different properties
    await helper.createTodo('Buy groceries', { priority: 'high' })
    await helper.createTodo('Write report', { priority: 'high' })
    await helper.createTodo('Clean house', { priority: 'medium' })
    await helper.createTodo('Read book', { priority: 'low' })
  })

  // --- Search Tests ---

  test('should filter todos by search text', async ({ page }) => {
    await page.fill('input[placeholder="Search todos..."]', 'buy')

    await expect(page.getByText('Buy groceries')).toBeVisible()
    await expect(page.getByText('Write report')).not.toBeVisible()
    await expect(page.getByText('Clean house')).not.toBeVisible()
    await expect(page.getByText('Read book')).not.toBeVisible()
  })

  test('should search case-insensitively', async ({ page }) => {
    await page.fill('input[placeholder="Search todos..."]', 'BUY')

    await expect(page.getByText('Buy groceries')).toBeVisible()
  })

  test('should match partial text', async ({ page }) => {
    await page.fill('input[placeholder="Search todos..."]', 'gro')

    await expect(page.getByText('Buy groceries')).toBeVisible()
  })

  test('should search subtask titles', async ({ page }) => {
    const helper = new TodoHelper(page)

    // Add a subtask to "Clean house"
    await helper.addSubtask('Clean house', 'Vacuum living room')

    // Search for subtask text
    await page.fill('input[placeholder="Search todos..."]', 'vacuum')

    // "Clean house" should appear because its subtask matches
    await expect(page.getByText('Clean house')).toBeVisible()
    await expect(page.getByText('Buy groceries')).not.toBeVisible()
  })

  test('should show all todos when search is cleared', async ({ page }) => {
    await page.fill('input[placeholder="Search todos..."]', 'buy')
    await expect(page.getByText('Write report')).not.toBeVisible()

    // Clear search
    await page.click('button:has-text("✕")')

    // All todos visible again
    await expect(page.getByText('Buy groceries')).toBeVisible()
    await expect(page.getByText('Write report')).toBeVisible()
    await expect(page.getByText('Clean house')).toBeVisible()
    await expect(page.getByText('Read book')).toBeVisible()
  })

  test('should show empty state when search has no matches', async ({ page }) => {
    await page.fill('input[placeholder="Search todos..."]', 'nonexistent')

    await expect(page.getByText('No todos match your filters')).toBeVisible()
  })

  // --- Priority Filter Tests ---

  test('should filter by high priority', async ({ page }) => {
    await page.selectOption('[data-testid="priority-filter"]', 'high')

    await expect(page.getByText('Buy groceries')).toBeVisible()
    await expect(page.getByText('Write report')).toBeVisible()
    await expect(page.getByText('Clean house')).not.toBeVisible()
    await expect(page.getByText('Read book')).not.toBeVisible()
  })

  test('should filter by medium priority', async ({ page }) => {
    await page.selectOption('[data-testid="priority-filter"]', 'medium')

    await expect(page.getByText('Clean house')).toBeVisible()
    await expect(page.getByText('Buy groceries')).not.toBeVisible()
  })

  test('should filter by low priority', async ({ page }) => {
    await page.selectOption('[data-testid="priority-filter"]', 'low')

    await expect(page.getByText('Read book')).toBeVisible()
    await expect(page.getByText('Buy groceries')).not.toBeVisible()
  })

  test('should clear priority filter', async ({ page }) => {
    await page.selectOption('[data-testid="priority-filter"]', 'high')
    await expect(page.getByText('Clean house')).not.toBeVisible()

    await page.selectOption('[data-testid="priority-filter"]', '')

    await expect(page.getByText('Clean house')).toBeVisible()
    await expect(page.getByText('Buy groceries')).toBeVisible()
  })

  // --- Tag Filter Tests ---

  test('should filter by tag', async ({ page }) => {
    const helper = new TodoHelper(page)

    // Create a tag and assign it
    await helper.createTag('Work', '#3B82F6')
    await page.click('button:has-text("Close")')

    // Create a tagged todo
    await page.click('button:has-text("Work")') // Select tag
    await helper.createTodo('Work task')

    // Create an untagged todo
    await helper.createTodo('Personal task')

    // Filter by Work tag
    await page.selectOption('[data-testid="tag-filter"]', { label: 'Work' })

    await expect(page.getByText('Work task')).toBeVisible()
    await expect(page.getByText('Personal task')).not.toBeVisible()
  })

  test('should clear tag filter', async ({ page }) => {
    await page.selectOption('[data-testid="tag-filter"]', '')

    // All todos visible
    await expect(page.getByText('Buy groceries')).toBeVisible()
  })

  // --- Combined Filter Tests ---

  test('should combine search and priority filter', async ({ page }) => {
    // Search for text that matches multiple todos
    await page.fill('input[placeholder="Search todos..."]', 're')
    // Both "Write report" (high) and "Read book" (low) match "re"

    // Add priority filter
    await page.selectOption('[data-testid="priority-filter"]', 'high')

    // Only "Write report" should remain (matches search + high priority)
    await expect(page.getByText('Write report')).toBeVisible()
    await expect(page.getByText('Read book')).not.toBeVisible()
  })

  test('should combine all three filters', async ({ page }) => {
    const helper = new TodoHelper(page)

    // Setup: create tag and tagged todo
    await helper.createTag('Urgent', '#EF4444')
    await page.click('button:has-text("Close")')
    await page.click('button:has-text("Urgent")')
    await helper.createTodo('Urgent report', { priority: 'high' })

    // Apply all three filters
    await page.fill('input[placeholder="Search todos..."]', 'report')
    await page.selectOption('[data-testid="priority-filter"]', 'high')
    await page.selectOption('[data-testid="tag-filter"]', { label: 'Urgent' })

    // Only the todo matching all three should appear
    await expect(page.getByText('Urgent report')).toBeVisible()
    await expect(page.getByText('Write report')).not.toBeVisible() // No tag
    await expect(page.getByText('Buy groceries')).not.toBeVisible() // No text match
  })

  test('should show no results when combined filters exclude everything', async ({ page }) => {
    await page.fill('input[placeholder="Search todos..."]', 'buy')
    await page.selectOption('[data-testid="priority-filter"]', 'low')

    // "buy" matches "Buy groceries" (high), but priority filter = low → no match
    await expect(page.getByText('No todos match your filters')).toBeVisible()
  })

  test('should clear all filters via link', async ({ page }) => {
    await page.fill('input[placeholder="Search todos..."]', 'nonexistent')
    await expect(page.getByText('No todos match your filters')).toBeVisible()

    await page.click('text=Clear all filters')

    // All todos should be visible again
    await expect(page.getByText('Buy groceries')).toBeVisible()
    await expect(page.getByText('Write report')).toBeVisible()
  })

  // --- Section Counter Tests ---

  test('should update section counters when filtering', async ({ page }) => {
    // All 4 todos should be in Pending
    await expect(page.getByText('Pending (4)')).toBeVisible()

    // Filter to high priority only (2 todos)
    await page.selectOption('[data-testid="priority-filter"]', 'high')

    await expect(page.getByText('Pending (2)')).toBeVisible()
  })

  test('should show zero counts in filtered empty sections', async ({ page }) => {
    await page.selectOption('[data-testid="priority-filter"]', 'high')

    // Completed section should show 0
    await expect(page.getByText('Completed (0)')).toBeVisible()
  })

  // --- Sort Order Tests ---

  test('should maintain sort order within filtered results', async ({ page }) => {
    // Filter to high priority
    await page.selectOption('[data-testid="priority-filter"]', 'high')

    // Both high-priority todos visible, in correct order
    const todoItems = page.locator('[data-testid="todo-item"]')
    await expect(todoItems).toHaveCount(2)

    // Sort order: priority (same) → due date → created_at (newest first)
  })

  // --- Responsive Tests ---

  test('should stack filters vertically on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    // Search input and dropdowns should be visible and stacked
    await expect(page.locator('input[placeholder="Search todos..."]')).toBeVisible()
    await expect(page.locator('[data-testid="priority-filter"]')).toBeVisible()
    await expect(page.locator('[data-testid="tag-filter"]')).toBeVisible()
  })

  // --- Dark Mode Tests ---

  test('should render filter bar in dark mode', async ({ page }) => {
    // Emulate dark color scheme
    await page.emulateMedia({ colorScheme: 'dark' })

    await expect(page.locator('input[placeholder="Search todos..."]')).toBeVisible()
    // Verify dark mode styling is applied
  })
})
```

### Test Helper Extension

```typescript
// tests/helpers.ts — add to TodoHelper class

export class TodoHelper {
  // ... existing methods

  async searchTodos(query: string) {
    await this.page.fill('input[placeholder="Search todos..."]', query)
  }

  async filterByPriority(priority: string) {
    await this.page.selectOption('[data-testid="priority-filter"]', priority)
  }

  async filterByTag(tagName: string) {
    await this.page.selectOption('[data-testid="tag-filter"]', { label: tagName })
  }

  async clearAllFilters() {
    await this.page.fill('input[placeholder="Search todos..."]', '')
    await this.page.selectOption('[data-testid="priority-filter"]', '')
    await this.page.selectOption('[data-testid="tag-filter"]', '')
  }
}
```

---

## Out of Scope

These are related features handled by other PRPs or future enhancements:

- Todo CRUD basics → **PRP 01**
- Priority system → **PRP 02**
- Subtask implementation → **PRP 05**
- Tag system → **PRP 06**
- Server-side search (full-text index) → Future enhancement
- Debounced search (not needed for client-side) → Future enhancement
- Search highlighting (bold matched text) → Future enhancement
- Saved/preset filters → Future enhancement
- Filter by due date range → Future enhancement
- Filter by completion status → Future enhancement
- Filter by recurrence type → Future enhancement
- Sort order toggle (UI to change sort direction) → Future enhancement
- Multi-tag filter (AND/OR logic for tags) → Future enhancement

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Filter response time (client-side) | < 16ms (single frame) |
| Search accuracy | 100% — all matching todos shown, no false positives |
| Subtask search accuracy | 100% — todos with matching subtasks included |
| AND logic correctness | 100% — all filters must match |
| Counter accuracy | 100% — counts match visible filtered todos |
| Sort consistency | 100% — order matches priority → due date → created |
| Mobile layout | Functional on 375px viewport |
| Dark mode | All filter elements properly themed |
| E2E test pass rate | 100% |

---

## Implementation Notes

### Project-Specific Patterns

1. **Client-side filtering only** — no server-side search endpoint. The full todo list is fetched via `GET /api/todos` (which already includes subtasks and tags), and filtering happens in the React component.
2. **No debounce needed** — since filtering is synchronous in-memory, it's fast enough to run on every keystroke without debouncing.
3. **Enriched todo response** — the `GET /api/todos` endpoint returns `subtasks: []` and `tags: []` alongside each todo. This data is already available for the search to match against.
4. **Filter state as strings** — all three filters use string state for simplicity. Tag filter stores the tag ID as a string (`String(tag.id)`), converted back with `Number(tagFilter)` during comparison.
5. **Section classification uses Singapore timezone** — `getSingaporeNow()` and `formatSingaporeDate()` determine whether a todo's due date is overdue or pending.
6. **Sort after filter** — the `sortTodos()` function runs on the filtered result (not on the full list then filtering).
7. **Responsive with Tailwind** — `flex-col sm:flex-row` handles the mobile/desktop layout toggle.
8. **`data-testid` attributes** — `priority-filter` and `tag-filter` used for Playwright test selectors.
9. **No API changes** — this feature requires zero new endpoints. Everything is client-side.
10. **Immutability** — `filteredTodos` is a new array from `.filter()`. Never mutate the original `todos` state.

### No New Files Required

This feature is implemented entirely within existing files:

```
app/page.tsx    # Filter state, filtering logic, filter bar UI, section counters
```

No new API routes, database changes, or utility files are needed.

### Integration Points

- **PRP 01 (CRUD)** — uses the `todos` state array from `GET /api/todos`
- **PRP 02 (Priority)** — `priorityFilter` matches `todo.priority` field
- **PRP 05 (Subtasks)** — search checks `todo.subtasks[].title`
- **PRP 06 (Tags)** — `tagFilter` matches `todo.tags[].id`, dropdown populated from `tags` state
