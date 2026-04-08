# PRP 10: Calendar View

## Feature Overview

Implement a dedicated calendar page (`/calendar`) that displays todos on a monthly calendar grid, with Singapore public holidays highlighted. Users can navigate between months, click on dates to see todos due that day, and visually identify overdue, pending, and completed tasks via color-coded dots. The calendar also shows holiday names inline. This feature builds on **PRP 01** (CRUD — due dates), **PRP 02** (Priority — color indicators), and uses the `holidays` table seeded by `scripts/seed-holidays.ts`.

---

## User Stories

### As a user, I want to:

1. **View my todos on a monthly calendar** so I can see my schedule at a glance
2. **Navigate between months** so I can plan ahead or review past months
3. **See color-coded dots on dates** so I can quickly identify task status
4. **Click a date to see its todos** so I can review what's due
5. **See Singapore public holidays** highlighted on the calendar so I can plan around them
6. **Navigate back to the todo list** so I can switch between views easily

---

## User Flow

### Viewing the Calendar

```
1. User clicks "Calendar" link in the navigation
2. Browser navigates to /calendar
3. Calendar displays the current month (Singapore timezone)
4. Each date cell shows:
   a. Date number
   b. Color-coded dots for todos due that day
   c. Holiday name (if applicable) in red text
5. Today's date is highlighted with a distinct border/background
```

### Navigating Months

```
1. User clicks "←" to go to the previous month
2. Calendar re-renders with the previous month's dates and todos
3. User clicks "→" to go to the next month
4. Calendar re-renders with the next month's dates and todos
5. Month/year header updates (e.g., "April 2026")
6. User clicks "Today" button to jump back to the current month
```

### Viewing Todos for a Date

```
1. User clicks on a date cell in the calendar
2. A panel/section below the calendar shows todos due on that date
3. Each todo shows:
   a. Completion checkbox
   b. Title
   c. Priority badge
   d. Tags
4. User can toggle completion directly from this panel
5. Clicking a different date updates the panel
```

### Viewing Holidays

```
1. Calendar cells for holidays show the holiday name in red text
2. Holiday dates may also have a light red/pink background
3. Holidays are specific to Singapore (seeded from holidays table)
```

---

## Technical Requirements

### Route & Page Setup

The calendar is a separate page at `/calendar`, protected by middleware:

```typescript
// middleware.ts — already protects /calendar
export const config = {
  matcher: ['/', '/calendar'],
}
```

```typescript
// app/calendar/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { getSingaporeNow, formatSingaporeDate } from '@/lib/timezone'
```

### Database — Holidays Table

The `holidays` table is pre-seeded with Singapore public holidays:

```sql
CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(date)
);
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Primary key |
| `date` | TEXT | Date in `YYYY-MM-DD` format |
| `name` | TEXT | Holiday name (e.g., "New Year's Day") |

Seeded via: `npx tsx scripts/seed-holidays.ts`

### Database Operations

```typescript
// lib/db.ts — holidayDB object

export interface Holiday {
  id: number
  date: string
  name: string
}

export const holidayDB = {
  findByMonth(year: number, month: number): Holiday[] {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`
    return db.prepare(
      'SELECT * FROM holidays WHERE date >= ? AND date <= ? ORDER BY date ASC'
    ).all(startDate, endDate) as Holiday[]
  },

  findByDate(date: string): Holiday | undefined {
    return db.prepare(
      'SELECT * FROM holidays WHERE date = ?'
    ).get(date) as Holiday | undefined
  },
}
```

### API Endpoints

#### `GET /api/calendar?year=2026&month=4` — Calendar data for a month

```typescript
// app/api/calendar/route.ts

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 })
  }

  // Get all todos for the user that have a due date in this month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`

  const todos = todoDB.findAll(session.userId).filter(
    todo => todo.due_date && todo.due_date >= startDate && todo.due_date <= endDate
  )

  // Enrich todos with subtasks and tags
  const enrichedTodos = todos.map(todo => {
    const subtasks = subtaskDB.findByTodoId(todo.id)
    const tags = todoTagDB.findByTodoId(todo.id)
    return {
      ...todo,
      subtasks,
      tags,
    }
  })

  // Get holidays for this month
  const holidays = holidayDB.findByMonth(year, month)

  return NextResponse.json({
    year,
    month,
    todos: enrichedTodos,
    holidays,
  })
}
```

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `year` | number | Yes | Year (e.g., 2026) |
| `month` | number | Yes | Month 1-12 |

**Response:** `200 OK`
```json
{
  "year": 2026,
  "month": 4,
  "todos": [
    {
      "id": 1,
      "title": "Buy groceries",
      "completed": false,
      "priority": "high",
      "due_date": "2026-04-10",
      "subtasks": [...],
      "tags": [...]
    }
  ],
  "holidays": [
    { "id": 1, "date": "2026-04-03", "name": "Good Friday" }
  ]
}
```

---

## UI Components

### Calendar Page Layout

```tsx
// app/calendar/page.tsx

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => getSingaporeNow())
  const [todos, setTodos] = useState<Todo[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1 // 1-indexed

  useEffect(() => {
    fetchCalendarData()
  }, [year, month])

  async function fetchCalendarData() {
    const res = await fetch(`/api/calendar?year=${year}&month=${month}`)
    if (res.ok) {
      const data = await res.json()
      setTodos(data.todos)
      setHolidays(data.holidays)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Navigation header */}
      <CalendarHeader
        year={year}
        month={month}
        onPrev={handlePrevMonth}
        onNext={handleNextMonth}
        onToday={handleGoToToday}
      />

      {/* Calendar grid */}
      <CalendarGrid
        year={year}
        month={month}
        todos={todos}
        holidays={holidays}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {/* Selected date detail panel */}
      {selectedDate && (
        <DateDetailPanel
          date={selectedDate}
          todos={todosForDate(selectedDate)}
          holiday={holidayForDate(selectedDate)}
          onToggleComplete={handleToggleComplete}
        />
      )}

      {/* Back to todos link */}
      <nav className="mt-6 text-center">
        <a href="/" className="text-blue-500 hover:text-blue-700
                                dark:text-blue-400 dark:hover:text-blue-300">
          ← Back to Todos
        </a>
      </nav>
    </div>
  )
}
```

### Calendar Header

```tsx
function CalendarHeader({ year, month, onPrev, onNext, onToday }) {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  return (
    <div className="flex items-center justify-between mb-4">
      {/* Back link */}
      <a href="/" className="text-sm text-blue-500 hover:text-blue-700
                              dark:text-blue-400">
        ← Todos
      </a>

      <div className="flex items-center gap-4">
        <button
          onClick={onPrev}
          className="px-3 py-1 rounded hover:bg-gray-100
                     dark:hover:bg-gray-700 dark:text-white"
          aria-label="Previous month"
        >
          ←
        </button>

        <h1 className="text-xl font-bold dark:text-white min-w-[200px] text-center">
          {monthNames[month - 1]} {year}
        </h1>

        <button
          onClick={onNext}
          className="px-3 py-1 rounded hover:bg-gray-100
                     dark:hover:bg-gray-700 dark:text-white"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <button
        onClick={onToday}
        className="text-sm px-3 py-1.5 rounded-lg border
                   border-blue-300 text-blue-600 hover:bg-blue-50
                   dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
      >
        Today
      </button>
    </div>
  )
}
```

### Calendar Grid

```tsx
function CalendarGrid({ year, month, todos, holidays, selectedDate, onSelectDate }) {
  const today = formatSingaporeDate(getSingaporeNow())
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay() // 0=Sun

  // Build array of day cells
  const cells: (number | null)[] = []

  // Leading empty cells for days before the 1st
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(null)
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(day)
  }

  // Group todos by due_date
  const todosByDate: Record<string, Todo[]> = {}
  for (const todo of todos) {
    if (todo.due_date) {
      const key = todo.due_date
      todosByDate[key] = [...(todosByDate[key] || []), todo]
    }
  }

  // Group holidays by date
  const holidaysByDate: Record<string, Holiday> = {}
  for (const holiday of holidays) {
    holidaysByDate[holiday.date] = holiday
  }

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500
                                     dark:text-gray-400 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 border-t border-l
                      dark:border-gray-600">
        {cells.map((day, index) => {
          if (day === null) {
            return (
              <div key={`empty-${index}`}
                   className="border-r border-b h-24 bg-gray-50
                              dark:bg-gray-800 dark:border-gray-600" />
            )
          }

          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayTodos = todosByDate[dateStr] || []
          const holiday = holidaysByDate[dateStr]
          const isToday = dateStr === today
          const isSelected = dateStr === selectedDate

          return (
            <div
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={`border-r border-b h-24 p-1 cursor-pointer transition-colors
                ${isToday
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : holiday
                    ? 'bg-red-50 dark:bg-red-900/10'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'}
                ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
                dark:border-gray-600`}
            >
              {/* Date number */}
              <div className={`text-sm font-medium ${
                isToday
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {day}
              </div>

              {/* Holiday name */}
              {holiday && (
                <div className="text-[10px] text-red-500 dark:text-red-400
                                truncate leading-tight mt-0.5">
                  {holiday.name}
                </div>
              )}

              {/* Todo dots */}
              <div className="flex flex-wrap gap-0.5 mt-1">
                {dayTodos.slice(0, 5).map(todo => (
                  <span
                    key={todo.id}
                    className={`w-2 h-2 rounded-full ${
                      todo.completed
                        ? 'bg-green-400'
                        : dateStr < today
                          ? 'bg-red-400'
                          : todo.priority === 'high'
                            ? 'bg-red-500'
                            : todo.priority === 'medium'
                              ? 'bg-yellow-500'
                              : 'bg-blue-500'
                    }`}
                    title={todo.title}
                  />
                ))}
                {dayTodos.length > 5 && (
                  <span className="text-[10px] text-gray-400">
                    +{dayTodos.length - 5}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

### Date Detail Panel

```tsx
function DateDetailPanel({ date, todos, holiday, onToggleComplete }) {
  const today = formatSingaporeDate(getSingaporeNow())
  const isOverdue = date < today

  // Format date for display
  const displayDate = new Date(date + 'T00:00:00+08:00').toLocaleDateString('en-SG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mt-6 p-4 bg-white border rounded-lg shadow-sm
                    dark:bg-gray-800 dark:border-gray-600">
      <h3 className="text-lg font-bold dark:text-white mb-1">{displayDate}</h3>

      {/* Holiday indicator */}
      {holiday && (
        <p className="text-sm text-red-500 dark:text-red-400 mb-3">
          🎉 {holiday.name}
        </p>
      )}

      {/* Todos for this date */}
      {todos.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No todos due on this date
        </p>
      ) : (
        <ul className="space-y-2">
          {todos.map(todo => (
            <li key={todo.id} className="flex items-center gap-3 p-2 rounded
                                          hover:bg-gray-50 dark:hover:bg-gray-700">
              {/* Completion checkbox */}
              <input
                type="checkbox"
                checked={!!todo.completed}
                onChange={() => onToggleComplete(todo.id, !todo.completed)}
                className="w-4 h-4 rounded"
              />

              {/* Title */}
              <span className={`flex-1 ${
                todo.completed
                  ? 'line-through text-gray-400 dark:text-gray-500'
                  : isOverdue
                    ? 'text-red-600 dark:text-red-400'
                    : 'dark:text-white'
              }`}>
                {todo.title}
              </span>

              {/* Priority badge */}
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                todo.priority === 'high'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : todo.priority === 'medium'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {todo.priority}
              </span>

              {/* Tag pills */}
              {todo.tags?.map(tag => (
                <span
                  key={tag.id}
                  className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

### Todo Dot Color Legend

| Dot Color | Meaning |
|-----------|---------|
| Green (`bg-green-400`) | Completed todo |
| Red (`bg-red-400`) | Overdue (past date, not completed) |
| Red (`bg-red-500`) | High priority (future/today, not completed) |
| Yellow (`bg-yellow-500`) | Medium priority (future/today, not completed) |
| Blue (`bg-blue-500`) | Low priority (future/today, not completed) |

**Priority logic for dot color:**
1. If completed → green (regardless of date)
2. If overdue (date < today) and not completed → red
3. Otherwise → color by priority

---

## State Management & Navigation

```typescript
// app/calendar/page.tsx

const [currentDate, setCurrentDate] = useState(() => getSingaporeNow())
const [todos, setTodos] = useState<Todo[]>([])
const [holidays, setHolidays] = useState<Holiday[]>([])
const [selectedDate, setSelectedDate] = useState<string | null>(null)

const year = currentDate.getFullYear()
const month = currentDate.getMonth() + 1

// Navigate to previous month
function handlePrevMonth() {
  setCurrentDate(prev => {
    const d = new Date(prev)
    d.setMonth(d.getMonth() - 1)
    return d
  })
  setSelectedDate(null)
}

// Navigate to next month
function handleNextMonth() {
  setCurrentDate(prev => {
    const d = new Date(prev)
    d.setMonth(d.getMonth() + 1)
    return d
  })
  setSelectedDate(null)
}

// Jump to today
function handleGoToToday() {
  setCurrentDate(getSingaporeNow())
  setSelectedDate(formatSingaporeDate(getSingaporeNow()))
}

// Get todos for a specific date
function todosForDate(date: string): Todo[] {
  return todos.filter(t => t.due_date === date)
}

// Get holiday for a specific date
function holidayForDate(date: string): Holiday | undefined {
  return holidays.find(h => h.date === date)
}

// Toggle todo completion from calendar
async function handleToggleComplete(todoId: number, completed: boolean) {
  await fetch(`/api/todos/${todoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  })
  await fetchCalendarData()
}
```

---

## Navigation Between Views

### From Todo List → Calendar

```tsx
// app/page.tsx — add link in the toolbar

<a
  href="/calendar"
  className="text-sm px-3 py-1.5 rounded-lg border
             border-indigo-300 text-indigo-600 hover:bg-indigo-50
             dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
>
  Calendar
</a>
```

### From Calendar → Todo List

```tsx
// app/calendar/page.tsx — back link

<a href="/" className="text-blue-500 hover:text-blue-700
                        dark:text-blue-400 dark:hover:text-blue-300">
  ← Back to Todos
</a>
```

### Toolbar Layout (Updated)

```
[+ Manage Tags]  [Templates]  [Export]  [Import]  [Calendar]
```

---

## Holidays

### Seeding Script

```bash
npx tsx scripts/seed-holidays.ts
```

Seeds Singapore public holidays for the current and next year. Key holidays include:

| Date | Holiday |
|------|---------|
| Jan 1 | New Year's Day |
| Jan/Feb | Chinese New Year (2 days) |
| Mar/Apr | Good Friday |
| May 1 | Labour Day |
| May/Jun | Vesak Day |
| Jun/Jul | Hari Raya Haji |
| Aug 9 | National Day |
| Oct/Nov | Deepavali |
| Dec 25 | Christmas Day |

### Holiday Display

- Holiday names appear inside the date cell in small red text
- Holiday date cells have a light red/pink background (`bg-red-50`)
- Holiday emoji (🎉) appears in the date detail panel
- Multiple holidays on the same date: only one per date (UNIQUE constraint)

---

## Calendar Grid Construction

### Algorithm

```typescript
function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay() // 0=Sunday

  const cells: (number | null)[] = []

  // Leading nulls for days before the 1st
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(null)
  }

  // Day numbers
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(day)
  }

  return cells
}
```

**Grid Properties:**
- 7 columns (Sun–Sat)
- 4–6 rows depending on the month
- Leading empty cells for alignment
- Trailing empty cells optional (grid auto-fills)
- Week starts on Sunday

### Date String Formatting

```typescript
function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
```

---

## Edge Cases

### Calendar Navigation

| Scenario | Expected Behavior |
|----------|-------------------|
| Previous month from January | Goes to December of previous year |
| Next month from December | Goes to January of next year |
| "Today" button clicked | Jumps to current month, selects today |
| Month with 28 days (Feb) | Grid shows correct number of days |
| Month with 31 days | Grid shows all 31 days |
| Leap year February | Shows 29 days correctly |
| First day is Sunday | No leading empty cells |
| First day is Saturday | 6 leading empty cells |

### Todo Display

| Scenario | Expected Behavior |
|----------|-------------------|
| Date with 0 todos | No dots shown, panel shows "No todos" |
| Date with 1 todo | 1 dot shown |
| Date with 5 todos | 5 dots shown |
| Date with 6+ todos | 5 dots + "+N" overflow indicator |
| Todo with no due date | Not shown on calendar (no date to place) |
| Completed todo | Green dot |
| Overdue todo | Red dot |
| High priority pending | Red dot |
| Medium priority pending | Yellow dot |
| Low priority pending | Blue dot |

### Holiday Display

| Scenario | Expected Behavior |
|----------|-------------------|
| Date is a holiday | Light red background, holiday name in red text |
| Holiday + todos | Both holiday name and dots shown |
| Holiday on weekend | Still highlighted |
| No holidays in month | No red backgrounds |
| Holiday name too long | Truncated with `truncate` CSS |

### Date Selection

| Scenario | Expected Behavior |
|----------|-------------------|
| Click on a date | Date highlighted, detail panel opens |
| Click on a different date | Previous date unhighlighted, new one selected |
| Click on empty cell (leading) | Nothing happens |
| Click on selected date | Stays selected (no toggle) |
| Navigate to different month | Selection cleared |
| Today button | Current date selected |

### Todo Completion from Calendar

| Scenario | Expected Behavior |
|----------|-------------------|
| Check completed → uncompleted | Dot changes from green, calendar refreshes |
| Check uncompleted → completed | Dot changes to green, calendar refreshes |
| Complete recurring todo | New instance may appear on next due date |
| Complete from detail panel | Updates both dot and panel |

### Responsive Design

| Scenario | Expected Behavior |
|----------|-------------------|
| Desktop (≥768px) | Full calendar grid, all elements visible |
| Mobile (<768px) | Cells shrink, holiday names may truncate |
| Very narrow (<375px) | Grid still usable, minimal padding |

### Dark Mode

| Scenario | Expected Behavior |
|----------|-------------------|
| Dark mode active | Dark backgrounds, light text, appropriate dot colors |
| Today cell in dark mode | Blue tint background (`dark:bg-blue-900/20`) |
| Holiday cell in dark mode | Red tint background (`dark:bg-red-900/10`) |
| Detail panel in dark mode | Dark background, correct badge colors |

---

## Acceptance Criteria

### Calendar Grid

- [ ] Calendar page is accessible at `/calendar`
- [ ] Calendar shows a 7-column grid (Sun–Sat)
- [ ] Weekday headers displayed above the grid
- [ ] Correct number of days shown for each month
- [ ] Leading empty cells align the 1st to the correct weekday
- [ ] Today's date is visually highlighted (blue background)
- [ ] Date cells are clickable
- [ ] Calendar uses Singapore timezone for "today" calculation

### Month Navigation

- [ ] "←" button navigates to the previous month
- [ ] "→" button navigates to the next month
- [ ] Month/year header updates correctly (e.g., "April 2026")
- [ ] "Today" button jumps to the current month
- [ ] Navigation across year boundaries works (Dec → Jan, Jan → Dec)
- [ ] Selected date clears when navigating months
- [ ] Data fetches on month change

### Todo Dots

- [ ] Color-coded dots appear on dates with due todos
- [ ] Green dot for completed todos
- [ ] Red dot for overdue (not completed, past date)
- [ ] Red dot for high priority (not completed, not overdue)
- [ ] Yellow dot for medium priority (not completed, not overdue)
- [ ] Blue dot for low priority (not completed, not overdue)
- [ ] Maximum 5 dots shown per date cell
- [ ] "+N" overflow indicator when > 5 todos
- [ ] Dots have `title` attribute with todo title (hover tooltip)
- [ ] Todos without due dates are not shown on calendar

### Date Detail Panel

- [ ] Clicking a date shows the detail panel below the calendar
- [ ] Panel shows the full formatted date (e.g., "Friday, 10 April 2026")
- [ ] Panel lists all todos due on that date
- [ ] Each todo shows checkbox, title, priority badge, and tags
- [ ] Checkbox toggles todo completion
- [ ] Completed todos show strikethrough text
- [ ] Overdue todos show red text
- [ ] "No todos due on this date" shown when no todos
- [ ] Holiday name shown with 🎉 emoji if the date is a holiday
- [ ] Clicking a different date updates the panel

### Holidays

- [ ] Singapore public holidays are highlighted with red/pink background
- [ ] Holiday name displayed in the date cell (small red text)
- [ ] Holiday names truncate gracefully in small cells
- [ ] Holiday shown in detail panel with emoji
- [ ] Holidays are timezone-aware (Singapore dates)

### Navigation Links

- [ ] "Calendar" link visible on the main todo page
- [ ] "← Back to Todos" link visible on the calendar page
- [ ] Both links navigate correctly
- [ ] Both routes are protected by authentication middleware

### Todo Completion

- [ ] Toggling completion from the detail panel updates the todo
- [ ] Dot color changes after toggling (green ↔ priority color)
- [ ] Calendar data refreshes after toggle

### Dark Mode

- [ ] Calendar grid renders correctly in dark mode
- [ ] Today highlight visible in dark mode
- [ ] Holiday highlight visible in dark mode
- [ ] Detail panel styled for dark mode
- [ ] All text readable in dark mode

### Responsive

- [ ] Calendar is usable on mobile viewports
- [ ] Detail panel works on mobile
- [ ] Navigation controls accessible on mobile

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/10-calendar.spec.ts

import { test, expect } from '@playwright/test'
import { TodoHelper } from './helpers'

test.describe('Calendar View', () => {

  test.beforeEach(async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.login()
  })

  test('should navigate to calendar page', async ({ page }) => {
    await page.click('a:has-text("Calendar")')
    await expect(page).toHaveURL(/\/calendar/)
    await expect(page.locator('text=Sun')).toBeVisible()
    await expect(page.locator('text=Mon')).toBeVisible()
  })

  test('should display current month and year', async ({ page }) => {
    await page.goto('/calendar')

    const now = new Date()
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    const expectedHeader = `${monthNames[now.getMonth()]} ${now.getFullYear()}`

    await expect(page.getByText(expectedHeader)).toBeVisible()
  })

  test('should navigate to previous month', async ({ page }) => {
    await page.goto('/calendar')

    // Click previous
    await page.click('button[aria-label="Previous month"]')

    // Header should change
    // Verify month/year changed (exact value depends on current date)
  })

  test('should navigate to next month', async ({ page }) => {
    await page.goto('/calendar')

    await page.click('button[aria-label="Next month"]')

    // Header should change
  })

  test('should jump to today', async ({ page }) => {
    await page.goto('/calendar')

    // Navigate away first
    await page.click('button[aria-label="Previous month"]')
    await page.click('button[aria-label="Previous month"]')

    // Click Today
    await page.click('button:has-text("Today")')

    // Should be back to current month
    const now = new Date()
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    await expect(page.getByText(`${monthNames[now.getMonth()]} ${now.getFullYear()}`)).toBeVisible()
  })

  test('should show todo dots on dates', async ({ page }) => {
    const helper = new TodoHelper(page)

    // Create a todo with a due date in the current month
    const today = new Date()
    const dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`
    await helper.createTodo('Calendar dot test', { dueDate })

    await page.click('a:has-text("Calendar")')

    // A dot should be visible on the 15th
    const cell = page.locator(`[data-date="${dueDate}"], :has-text("15")`)
    await expect(cell.locator('.rounded-full')).toBeVisible()
  })

  test('should show detail panel when clicking a date', async ({ page }) => {
    const helper = new TodoHelper(page)
    const today = new Date()
    const dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`
    await helper.createTodo('Detail panel test', { dueDate })

    await page.goto('/calendar')

    // Click on the 15th
    await page.click('text=15')

    // Detail panel should show
    await expect(page.getByText('Detail panel test')).toBeVisible()
  })

  test('should show "No todos" for empty dates', async ({ page }) => {
    await page.goto('/calendar')

    // Click on a date unlikely to have todos
    await page.click('text=1')

    await expect(page.getByText('No todos due on this date')).toBeVisible()
  })

  test('should toggle todo completion from calendar', async ({ page }) => {
    const helper = new TodoHelper(page)
    const today = new Date()
    const dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`
    await helper.createTodo('Complete from calendar', { dueDate })

    await page.goto('/calendar')
    await page.click('text=15')

    // Toggle checkbox
    await page.click('input[type="checkbox"]')

    // Todo should show as completed (strikethrough)
    await expect(page.locator('.line-through')).toBeVisible()
  })

  test('should display holiday names', async ({ page }) => {
    await page.goto('/calendar')

    // Navigate to a month with known holidays (e.g., August for National Day)
    // This depends on seeded data
    // Navigate to August
    // await expect(page.getByText('National Day')).toBeVisible()
  })

  test('should highlight today', async ({ page }) => {
    await page.goto('/calendar')

    const today = new Date()
    const todayStr = String(today.getDate())

    // Today's cell should have the highlight class
    const todayCell = page.locator('.bg-blue-50, .dark\\:bg-blue-900\\/20')
    await expect(todayCell).toBeVisible()
  })

  test('should navigate back to todo list', async ({ page }) => {
    await page.goto('/calendar')

    await page.click('a:has-text("Back to Todos")')
    await expect(page).toHaveURL(/\/$/)
  })

  test('should navigate across year boundary', async ({ page }) => {
    await page.goto('/calendar')

    // Navigate to January
    // Then go to previous month (December of previous year)
    // Verify year changes in header
  })

  test('should show priority-colored dots', async ({ page }) => {
    const helper = new TodoHelper(page)
    const today = new Date()
    const dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-20`

    await helper.createTodo('High priority cal', { dueDate, priority: 'high' })

    await page.goto('/calendar')

    // Red dot should appear on the 20th
    const cell = page.locator(':has-text("20")')
    const dot = cell.locator('.bg-red-500')
    await expect(dot).toBeVisible()
  })

  test('should show tag pills in detail panel', async ({ page }) => {
    const helper = new TodoHelper(page)

    await helper.createTag('CalTag', '#10B981')
    await page.click('button:has-text("Close")')

    const today = new Date()
    const dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-18`

    await page.click('button:has-text("CalTag")')
    await helper.createTodo('Tagged calendar todo', { dueDate })

    await page.goto('/calendar')
    await page.click('text=18')

    await expect(page.getByText('CalTag')).toBeVisible()
  })

  test('should handle month with 28 days (February)', async ({ page }) => {
    await page.goto('/calendar')

    // Navigate to February
    // Verify 28 (or 29 in leap year) days shown
    // No day 30 or 31
  })

  test('should overflow with +N for dates with many todos', async ({ page }) => {
    const helper = new TodoHelper(page)
    const today = new Date()
    const dueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-25`

    // Create 6+ todos on the same date
    for (let i = 1; i <= 7; i++) {
      await helper.createTodo(`Overflow todo ${i}`, { dueDate })
    }

    await page.goto('/calendar')

    // Should show dots and +2 overflow
    await expect(page.getByText('+2')).toBeVisible()
  })

  test('should require authentication', async ({ page }) => {
    // Access calendar without login
    await page.goto('/calendar')
    // Should redirect to login
    await expect(page).not.toHaveURL(/\/calendar/)
  })
})
```

### API Tests

```typescript
test('GET /api/calendar returns todos and holidays for month', async () => {
  const todo = await createTestTodo('Calendar API test', { dueDate: '2026-04-10' })

  const res = await fetch('/api/calendar?year=2026&month=4')
  expect(res.status).toBe(200)

  const data = await res.json()
  expect(data.year).toBe(2026)
  expect(data.month).toBe(4)
  expect(Array.isArray(data.todos)).toBe(true)
  expect(Array.isArray(data.holidays)).toBe(true)
  expect(data.todos.some((t: { title: string }) => t.title === 'Calendar API test')).toBe(true)
})

test('GET /api/calendar validates parameters', async () => {
  const res = await fetch('/api/calendar?year=2026&month=13')
  expect(res.status).toBe(400)
})

test('GET /api/calendar returns 401 without auth', async () => {
  const res = await fetch('/api/calendar?year=2026&month=4', { headers: {} })
  expect(res.status).toBe(401)
})

test('GET /api/calendar excludes todos without due dates', async () => {
  await createTestTodo('No due date', {})

  const res = await fetch('/api/calendar?year=2026&month=4')
  const data = await res.json()

  expect(data.todos.every((t: { due_date: string | null }) => t.due_date !== null)).toBe(true)
})

test('GET /api/calendar includes enriched todo data', async () => {
  const todo = await createTestTodo('Enriched cal test', { dueDate: '2026-04-15' })
  const subtask = await addSubtask(todo.id, 'Cal subtask')
  const tag = await createTag('CalTestTag')
  await associateTag(todo.id, tag.id)

  const res = await fetch('/api/calendar?year=2026&month=4')
  const data = await res.json()

  const found = data.todos.find((t: { id: number }) => t.id === todo.id)
  expect(found.subtasks).toHaveLength(1)
  expect(found.tags).toHaveLength(1)
})
```

---

## Out of Scope

These are related features handled by other PRPs or future enhancements:

- Todo CRUD basics (due dates) → **PRP 01**
- Priority system (dot colors) → **PRP 02**
- Recurring todo display → shown if due date falls in month, per **PRP 03**
- Subtask display on calendar → shown in detail panel, per **PRP 05**
- Tag display on calendar → shown in detail panel, per **PRP 06**
- Drag-and-drop to reschedule todos → Future enhancement
- Week view → Future enhancement
- Day view → Future enhancement
- Agenda/list view → Future enhancement
- Multi-day events → Future enhancement
- Calendar event creation (click date to add todo) → Future enhancement
- Export calendar to iCal → Future enhancement
- Google Calendar integration → Future enhancement
- Holiday management UI (add/remove holidays) → Future enhancement

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Calendar API response time | < 200ms |
| Calendar grid render time | < 100ms |
| Month navigation latency | < 300ms (fetch + render) |
| Date alignment accuracy | 100% — days align to correct weekday column |
| Dot color accuracy | 100% — matches todo status and priority |
| Holiday display accuracy | 100% — all seeded holidays shown on correct dates |
| Today highlight accuracy | 100% — correct date highlighted in Singapore timezone |
| Detail panel responsiveness | < 50ms after click |
| Authentication enforcement | 100% — redirects unauthenticated users |
| Dark mode coverage | 100% — all elements properly themed |
| Mobile usability | Functional on 375px viewport |
| E2E test pass rate | 100% |

---

## Implementation Notes

### Project-Specific Patterns

1. **Separate page, not a modal** — the calendar is at `/calendar`, a `'use client'` page component. Not embedded in `app/page.tsx`.
2. **Singapore timezone** — `getSingaporeNow()` determines "today". The `holidays` table stores Singapore-specific dates. All comparisons use `formatSingaporeDate()`.
3. **API endpoint for month data** — `GET /api/calendar?year=&month=` returns both todos and holidays for the month. Client fetches on mount and on month change.
4. **Enriched todos** — the calendar API returns todos with subtasks and tags, same as `GET /api/todos` but filtered to the month.
5. **holidays seeded via script** — `npx tsx scripts/seed-holidays.ts` populates the `holidays` table. The calendar reads from this table.
6. **Dot overflow** — max 5 dots per cell, then `+N` text. Prevents cells from becoming too cluttered.
7. **Detail panel, not modals** — clicking a date shows an inline panel below the calendar, not a modal. Simpler and more intuitive.
8. **Toggle completion from calendar** — users can check/uncheck todos directly from the detail panel, which calls `PUT /api/todos/[id]`.
9. **`params` is async** — not applicable (calendar route has no dynamic params).
10. **Middleware protection** — `middleware.ts` already includes `/calendar` in the matcher, so unauthenticated users are redirected to login.
11. **Immutability** — `setCurrentDate` creates a new `Date` object via `new Date(prev)`, never mutates the previous state.
12. **Week starts on Sunday** — `getDay()` returns 0 for Sunday, which aligns with the grid starting at Sun.

### File Locations

```
app/calendar/page.tsx           # Calendar page (client component)
app/api/calendar/route.ts       # GET — month data (todos + holidays)
lib/db.ts                        # holidayDB object, Holiday interface
scripts/seed-holidays.ts         # Seeds holidays table (pre-existing)
middleware.ts                    # Protects /calendar route (pre-existing)
app/page.tsx                     # "Calendar" link in toolbar
```

### Dependencies

No additional npm packages. Uses:
- `better-sqlite3` for holiday and todo queries
- `Date` API for calendar grid calculations
- Tailwind CSS for grid layout and responsive design
- `lib/timezone.ts` for Singapore timezone handling
