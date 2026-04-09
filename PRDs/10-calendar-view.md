# PRP-10: Calendar View

**Depends on:** PRP-01 (Todo CRUD Operations)
**Feature:** Monthly calendar displaying todos on due dates + Singapore public holidays
**Last updated:** 2026-04-08

---

## 1. Feature Overview

The Calendar View gives users a monthly grid visualisation of their todos organised by due date. Each day cell shows a count badge for todos due on that day, and users can click any day to open a modal listing the specific todos. The view is navigable month by month via Previous/Next/Today controls. The current URL reflects the displayed month so the page is bookmarkable and shareable.

Singapore public holidays are fetched from a dedicated `holidays` table (seeded for 2024–2026) and rendered as red text labels inside the relevant day cells. These provide at-a-glance context for planning. The current day is highlighted with a distinct background. Weekend columns (Saturday and Sunday) use a subtler background tone to distinguish them from weekdays.

All date arithmetic uses `Asia/Singapore` timezone. The calendar grid is computed client-side from the `YYYY-MM` URL parameter: determine the first day of the month, pad left to the preceding Sunday, then fill six rows of seven days. Days outside the current month are rendered in a muted style but are included in the grid for layout completeness. Clicking a day outside the current month navigates to that month and opens the day's modal.

---

## 2. User Stories

**US-01 — View monthly calendar**
As a user, I want to see a monthly calendar grid so that I can understand my todo workload distributed across time.

**US-02 — Navigate months**
As a user, I want to click "Previous" and "Next" buttons to move between months, and a "Today" button to jump back to the current month.

**US-03 — See todos on due dates**
As a user with todos that have due dates, I want to see a count badge on each day so that I immediately know how many todos are due.

**US-04 — Click day to view todos**
As a user, I want to click any day cell to open a modal listing all todos due on that day so that I can see their titles and completion status.

**US-05 — View Singapore public holidays**
As a user, I want to see public holiday names rendered on the relevant calendar days so that I can plan around them.

**US-06 — Distinguish today**
As a user, I want today's date to be clearly highlighted so that I can orient myself at a glance.

**US-07 — Edge: month with no todos**
As a user viewing a month with no todos due, I want an empty grid without errors or empty-state placeholders inside cells, keeping the UI clean.

**US-08 — Edge: multiple todos same day**
As a user with 5 todos due on the same day, I want to see a "5" badge on that day and all 5 listed in the modal.

**US-09 — Edge: todo with no due date**
Todos without a due date do not appear on the calendar. This is expected behaviour, not an error.

---

## 3. Technical Requirements

### 3.1 Architecture Reference

| Concern | Location |
|---------|----------|
| DB operations | `lib/db/holidays.ts` — synchronous (better-sqlite3) |
| API route | `app/api/holidays/route.ts` |
| API client | `lib/api/holidays.ts` — `fetchHolidays(year, month)` |
| Shared types | `lib/types/holiday.ts` |
| TanStack hooks | `lib/hooks/useHolidays.ts`, `lib/hooks/useCalendar.ts` |
| Calendar page | `app/calendar/page.tsx` ('use client') |
| Components | `components/calendar/` |
| Seed script | `scripts/seed-holidays.ts` |
| Timezone helpers | `lib/timezone.ts` — `nowSG()`, `toSGDisplay()`, `toUTC()` |
| Session auth | `lib/auth.ts#getSession()` — route protection via `middleware.ts` |

> **Next.js 16 rule:** Route params are async. Always `const { id } = await params` inside route handlers.
> **better-sqlite3 rule:** All DB calls are synchronous — do NOT `await` them.
> **Timezone rule:** All date comparisons use `Asia/Singapore`. Never compare ISO strings directly — parse them through `lib/timezone.ts`.

### 3.2 Database Schema

```sql
-- Add to lib/db/connection.ts schema initialisation block

CREATE TABLE IF NOT EXISTS holidays (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  date   TEXT    NOT NULL,   -- 'YYYY-MM-DD' in Singapore local date
  name   TEXT    NOT NULL,
  year   INTEGER NOT NULL,
  UNIQUE (date, name)        -- prevents duplicate seeding
);

CREATE INDEX IF NOT EXISTS idx_holidays_year_month ON holidays(year, substr(date, 1, 7));
```

**Holiday record example:**
```sql
INSERT OR IGNORE INTO holidays (date, name, year) VALUES
  ('2026-01-01', 'New Year''s Day',       2026),
  ('2026-01-29', 'Chinese New Year',      2026),
  ('2026-01-30', 'Chinese New Year',      2026),
  ('2026-04-03', 'Good Friday',           2026),
  ('2026-05-01', 'Labour Day',            2026),
  ('2026-05-12', 'Hari Raya Puasa',       2026),
  ('2026-05-26', 'Vesak Day',             2026),
  ('2026-07-19', 'Hari Raya Haji',        2026),
  ('2026-08-09', 'National Day',          2026),
  ('2026-10-20', 'Deepavali',             2026),
  ('2026-12-25', 'Christmas Day',         2026);
```

### 3.3 API Endpoints

#### `GET /api/holidays?year=YYYY&month=MM`

Returns all public holidays for the given Singapore year and month.

**Request headers:** `Cookie: session=<token>`

**Query parameters:**
- `year`: required, 4-digit integer (2024–2030)
- `month`: required, 2-digit integer (01–12)

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "date": "2026-08-09", "name": "National Day", "year": 2026 },
    ...
  ]
}
```

**Error `400 Bad Request` (invalid year/month):**
```json
{
  "success": false,
  "error": "Invalid year or month parameter"
}
```

**Error `401 Unauthorized`:**
```json
{ "success": false, "error": "Unauthorized" }
```

### 3.4 TypeScript Types

```typescript
// lib/types/holiday.ts

export interface Holiday {
  id: number
  date: string   // 'YYYY-MM-DD' in Singapore local date
  name: string
  year: number
}

export interface HolidaysResponse {
  success: true
  data: Holiday[]
}
```

```typescript
// lib/types/calendar.ts  (new file)

export interface CalendarDay {
  date: string           // 'YYYY-MM-DD' Singapore local date
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean     // Saturday (day 6) or Sunday (day 0)
  todos: CalendarTodo[]
  holidays: Holiday[]
}

export interface CalendarTodo {
  id: number
  title: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
}

export interface CalendarMonth {
  year: number
  month: number          // 1-12
  weeks: CalendarDay[][] // 6 rows × 7 columns
}
```

---

## 4. React Components

### 4.1 Component Tree ASCII

```
app/calendar/page.tsx  ('use client')
└── AppShell
    └── main
        ├── CalendarNav          (prev/next/today + month label)
        └── CalendarGrid         (6 × 7 day grid)
            └── CalendarDay[]    (individual day cell)
                ├── HolidayBadge (holiday name in red — 0 or more per day)
                └── (todo count badge — rendered inline in CalendarDay)

CalendarDay (on click)
└── CalendarDayModal             (modal listing todos for that day)
    └── CalendarTodoItem[]       (todo title + completion status)
```

### 4.2 Component Specs

---

#### `CalendarNav`

**File:** `components/calendar/CalendarNav.tsx`
**Purpose:** Month title display with Previous, Next, and Today navigation controls.

**Props:**
```typescript
interface CalendarNavProps {
  currentMonth: string   // 'YYYY-MM'
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}
```

**Derived display:** Format `currentMonth` as `'April 2026'` using `Intl.DateTimeFormat('en-SG', { month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' })`.

**Implementation:** Uses shadcn `Button` from `@/components/ui/button`:
```tsx
import { Button } from '@/components/ui/button'

<Button onClick={onPrev} variant="outline" size="sm" aria-label="Previous month" data-testid="calendar-prev-btn">‹</Button>
<span className="text-foreground font-semibold" data-testid="calendar-month-label">{monthLabel}</span>
<Button onClick={onNext} variant="outline" size="sm" aria-label="Next month" data-testid="calendar-next-btn">›</Button>
<Button onClick={onToday} variant="default" size="sm" aria-label="Go to current month" data-testid="calendar-today-btn">Today</Button>
```

**Design tokens:** uses shadcn classes — `bg-primary text-primary-foreground` (Today button), `variant="outline"` (Prev/Next), `text-foreground font-semibold` (month label), `rounded-md`

**Accessibility:**
- "Previous month" button: `aria-label="Previous month"`
- "Next month" button: `aria-label="Next month"`
- "Today" button: `aria-label="Go to current month"`
- `data-testid="calendar-nav"`, `data-testid="calendar-prev-btn"`, `data-testid="calendar-next-btn"`, `data-testid="calendar-today-btn"`, `data-testid="calendar-month-label"`

---

#### `CalendarGrid`

**File:** `components/calendar/CalendarGrid.tsx`
**Purpose:** Renders the 7-column × 6-row monthly grid with weekday headers.

**Props:**
```typescript
interface CalendarGridProps {
  calendarMonth: CalendarMonth
  onDayClick: (day: CalendarDay) => void
}
```

**Render:**
- First row: weekday headers `['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']`
- Then 6 rows of `CalendarDay` components from `calendarMonth.weeks`

**Design tokens:** uses shadcn classes — `border-border` for grid lines, `bg-background` for grid background, `text-muted-foreground` for weekday header text, no gap (borders handle visual separation)

**Accessibility:**
- Rendered as `<table role="grid">` with `<caption>` set to month name
- Weekday headers in `<thead>` with `<th scope="col">`
- `data-testid="calendar-grid"`

---

#### `CalendarDay`

**File:** `components/calendar/CalendarDay.tsx`
**Purpose:** Single calendar day cell with date number, holiday names, and todo count badge.

**Props:**
```typescript
interface CalendarDayProps {
  day: CalendarDay
  onClick: (day: CalendarDay) => void
}
```

**Visual variants (applied via shadcn classes):**

| Condition | Tailwind classes |
|-----------|-----------------|
| Today | `bg-primary text-primary-foreground` |
| Weekend | `bg-muted text-muted-foreground` |
| Other month | `bg-background text-muted-foreground/40` |
| Normal weekday | `bg-card text-card-foreground hover:bg-accent` |

**Todo count badge:** Rendered as a small rounded pill using `bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5` in the top-right corner of the cell. Hidden when `day.todos.length === 0`.

**Design tokens (additional):** `text-destructive` for holiday name text, `hover:bg-accent` for day cell hover, `rounded-sm` for count badge

**Accessibility:**
- Cell is a `<td role="gridcell">` wrapped in a `<button>` for click handling
- Button `aria-label="{date}: {N} todos, {holiday names}"` — e.g. `"August 9, 2026: 2 todos, National Day"`
- Today: `aria-current="date"`
- `data-testid="calendar-day-{YYYY-MM-DD}"`

---

#### `HolidayBadge`

**File:** `components/calendar/HolidayBadge.tsx`
**Purpose:** Renders a holiday name in red text inside a day cell. Multiple badges stack vertically.

**Props:**
```typescript
interface HolidayBadgeProps {
  name: string
}
```

**Design tokens:** uses shadcn classes — `text-destructive` for red text color, `text-xs` for small text

**Accessibility:**
- `aria-label="Public holiday: {name}"`
- `data-testid="holiday-badge"`

---

#### `CalendarDayModal`

**File:** `components/calendar/CalendarDayModal.tsx`
**Purpose:** Modal displayed when a day cell is clicked, listing all todos due that day.

**Props:**
```typescript
interface CalendarDayModalProps {
  day: CalendarDay | null
  open: boolean
  onClose: () => void
}
```

**Render:**
- Modal title: formatted date, e.g. `'Sunday, 9 August 2026'`
- Holiday names (if any) in a `text-destructive` callout at the top
- List of `CalendarTodoItem` for each todo
- If `day.todos.length === 0`: "No todos due on this day."
- Footer: Close button

**Implementation:** Uses shadcn `Dialog` from `@/components/ui/dialog`:
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

<Dialog open={open} onOpenChange={open => !open && onClose()}>
  <DialogContent className="max-w-[480px]" data-testid="calendar-day-modal">
    <DialogHeader>
      <DialogTitle>{formattedDate}</DialogTitle>
    </DialogHeader>
    {/* holiday callout + todo list */}
    <DialogFooter>
      <Button variant="outline" onClick={onClose} data-testid="calendar-modal-close-btn">Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Design tokens:** uses shadcn Dialog defaults — `bg-background shadow-lg rounded-lg p-6`; `text-destructive` for holiday callout

**Accessibility:**
- `<dialog>` element (or `<div role="dialog" aria-modal="true">`)
- `aria-labelledby` pointing to modal title `<h2>`
- Focus moves to modal on open; returns to clicked day cell on close
- Closes on Escape key and backdrop click
- `data-testid="calendar-day-modal"`, `data-testid="calendar-modal-close-btn"`

---

#### `CalendarTodoItem` (sub-component of CalendarDayModal)

**File:** `components/calendar/CalendarDayModal.tsx` (defined inline or extracted)
**Purpose:** A single todo row inside the calendar modal.

**Props:**
```typescript
interface CalendarTodoItemProps {
  todo: CalendarTodo
}
```

**Render:** Checkbox icon (read-only, reflects `completed`) + title + priority badge.
**Completed todos:** Title in `text-muted-foreground line-through`.

**Accessibility:**
- `data-testid="calendar-todo-item-{todo.id}"`

---

## 5. TanStack Query Hooks

**File:** `lib/hooks/useHolidays.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { fetchHolidays } from '@/lib/api/holidays'
import type { Holiday } from '@/lib/types/holiday'

export const holidayKeys = {
  all:    () => ['holidays'] as const,
  byMonth: (year: number, month: number) => ['holidays', year, month] as const,
}

export function useHolidays(year: number, month: number) {
  return useQuery({
    queryKey: holidayKeys.byMonth(year, month),
    queryFn:  () => fetchHolidays(year, month),
    staleTime: 86_400_000,   // 24 hours — holidays change infrequently
    gcTime:    604_800_000,  // 7 days
    enabled:   year > 0 && month > 0,
  })
}
```

**File:** `lib/hooks/useCalendar.ts`

```typescript
import { useMemo } from 'react'
import { useTodos } from './useTodos'
import { useHolidays } from './useHolidays'
import { buildCalendarMonth } from '@/lib/calendar'
import type { CalendarMonth } from '@/lib/types/calendar'

/**
 * Composes todo data + holiday data into a CalendarMonth grid.
 * @param monthStr 'YYYY-MM'
 */
export function useCalendar(monthStr: string): {
  calendarMonth: CalendarMonth | null
  isLoading: boolean
  isError: boolean
} {
  const [yearStr, monthNum] = monthStr.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthNum, 10)

  const todosQuery = useTodos()
  const holidaysQuery = useHolidays(year, month)

  const calendarMonth = useMemo(() => {
    if (!todosQuery.data || !holidaysQuery.data) return null
    const allTodos = [
      ...todosQuery.data.data.overdue,
      ...todosQuery.data.data.pending,
      ...todosQuery.data.data.completed,
    ]
    return buildCalendarMonth(year, month, allTodos, holidaysQuery.data.data)
  }, [year, month, todosQuery.data, holidaysQuery.data])

  return {
    calendarMonth,
    isLoading: todosQuery.isLoading || holidaysQuery.isLoading,
    isError:   todosQuery.isError   || holidaysQuery.isError,
  }
}
```

**Hook configuration:**
| Hook | Query key | Stale Time | Cache Time | Optimistic | Invalidates |
|------|-----------|-----------|-----------|-----------|-------------|
| `useHolidays(year, month)` | `['holidays', year, month]` | 24 h | 7 days | No | None |
| `useCalendar(monthStr)` | (composed from useTodos + useHolidays) | inherits | inherits | No | None |

---

## 6. State Management

| State | Type | Location | Notes |
|-------|------|----------|-------|
| Current month | URL state | `?month=YYYY-MM` | Parsed in `app/calendar/page.tsx` via `useSearchParams()` |
| Selected day (modal) | Local UI | `app/calendar/page.tsx` | `useState<CalendarDay | null>` |
| Holiday data | Server state | TanStack Query `holidayKeys.byMonth()` | Long stale time (24h) |
| Todo data | Server state | TanStack Query `todoKeys.lists()` | Shared with main page |
| Auth user | Context | `AuthContext` | Read to ensure user is logged in |

**URL state:** `?month=YYYY-MM`
- Default (no param): current month in Singapore timezone, e.g. `?month=2026-04`
- On Prev/Next: `router.push('/calendar?month=YYYY-MM')`
- On Today: `router.push('/calendar?month=' + currentSGMonth)`

**Contexts read:**
- `AuthContext` — user must be authenticated (enforced by `middleware.ts`)

**Contexts written:** None.

---

## 7. Test Specifications

### 7.1 E2E Tests (Playwright)

**File:** `tests/11-calendar-view.spec.ts`

#### Test: Calendar renders current month

```
Setup:
- Log in with test user

Steps:
1. Navigate to /calendar
2. Wait for [data-testid="calendar-grid"] to be visible

Assertions:
- [data-testid="calendar-month-label"] text matches current SG month/year, e.g. "April 2026"
- [data-testid="calendar-grid"] contains 7 column headers (Sun–Sat)
- [data-testid="calendar-grid"] contains between 28 and 42 day cells (4–6 rows × 7)
```

#### Test: Todo count badge appears on due date

```
Setup:
- Create a todo with due_date = '2026-08-09T02:00:00.000Z' (Aug 9 in SG time) via API

Steps:
1. Navigate to /calendar?month=2026-08
2. Wait for calendar to load

Assertions:
- [data-testid="calendar-day-2026-08-09"] contains a visible count badge with text "1"
```

#### Test: Click day opens modal with todos

```
Setup:
- Create 2 todos both due on 2026-08-09 via API

Steps:
1. Navigate to /calendar?month=2026-08
2. Click [data-testid="calendar-day-2026-08-09"]

Assertions:
- [data-testid="calendar-day-modal"] is visible
- Modal contains 2 [data-testid^="calendar-todo-item-"] elements
- Both todo titles are visible in the modal
```

#### Test: Holiday name renders in red on correct day

```
Setup:
- Holidays are seeded (seed-holidays.ts has been run)

Steps:
1. Navigate to /calendar?month=2026-08

Assertions:
- [data-testid="calendar-day-2026-08-09"] contains [data-testid="holiday-badge"] with text "National Day"
- The holiday badge has CSS color matching `text-destructive` (computed style check or class check)
```

#### Test: Navigate to previous month

```
Steps:
1. Navigate to /calendar?month=2026-04
2. Click [data-testid="calendar-prev-btn"]

Assertions:
- URL changes to /calendar?month=2026-03
- [data-testid="calendar-month-label"] shows "March 2026"
```

#### Test: Navigate to next month

```
Steps:
1. Navigate to /calendar?month=2026-04
2. Click [data-testid="calendar-next-btn"]

Assertions:
- URL changes to /calendar?month=2026-05
- [data-testid="calendar-month-label"] shows "May 2026"
```

#### Test: Today button returns to current month

```
Steps:
1. Navigate to /calendar?month=2025-01
2. Click [data-testid="calendar-today-btn"]

Assertions:
- URL changes to current month (e.g., /calendar?month=2026-04)
- [data-testid="calendar-month-label"] matches current SG month
```

#### Test: Today's date is highlighted

```
Steps:
1. Navigate to /calendar (no month param)
2. Compute today's SG date string (YYYY-MM-DD)

Assertions:
- [data-testid="calendar-day-{today}"] has aria-current="date"
```

#### Test: Day with no todos shows no badge

```
Steps:
1. Navigate to /calendar?month=2026-04 (assume no todos seeded for April 1)

Assertions:
- [data-testid="calendar-day-2026-04-01"] does not contain a count badge
```

### 7.2 Unit Tests

**File:** `lib/calendar.test.ts`

| Function | Input | Expected Output |
|----------|-------|-----------------|
| `buildCalendarMonth` | year=2026, month=4 (April) | `weeks` has exactly 6 rows of 7 days |
| `buildCalendarMonth` | year=2026, month=4 | First cell is 2026-03-29 (Sunday before Apr 1) |
| `buildCalendarMonth` | year=2026, month=4 | Apr 1 is `isCurrentMonth: true` |
| `buildCalendarMonth` | year=2026, month=4, 1 todo due Apr 10 | CalendarDay for 2026-04-10 has `todos.length === 1` |
| `buildCalendarMonth` | year=2026, month=8, 1 holiday on Aug 9 | CalendarDay for 2026-08-09 has `holidays.length === 1` |
| `buildCalendarMonth` | a todo with `due_date = null` | No day cell contains that todo |
| `getMonthBounds` | year=2026, month=2 | `{ start: '2026-02-01', end: '2026-02-28' }` |
| `isWeekend` | date=`new Date('2026-04-05')` (Sunday) | `true` |
| `isWeekend` | date=`new Date('2026-04-06')` (Monday) | `false` |

**File:** `lib/db/holidays.test.ts`

| Function | Input | Expected |
|----------|-------|----------|
| `getHolidaysByMonth` | year=2026, month=8 | Array containing `{ name: 'National Day', date: '2026-08-09' }` |
| `getHolidaysByMonth` | year=2025, month=3 | Empty array (no March 2025 holidays in seed) |
| `getHolidaysByMonth` | year=9999, month=1 | Empty array (no data, no error) |

### 7.3 Integration Tests

**File:** `app/api/holidays/route.test.ts`

```
GET /api/holidays?year=2026&month=8
- authenticated → 200, array with National Day (Aug 9)
- authenticated, month with no holidays → 200, empty array
- unauthenticated → 401
- missing year param → 400, "Invalid year or month parameter"
- missing month param → 400, "Invalid year or month parameter"
- year=abc (non-numeric) → 400
- month=13 (out of range) → 400
```

---

## 8. Acceptance Criteria

1. Navigating to `/calendar` renders a monthly grid with 7 columns (Sun–Sat) and 4–6 rows.
2. The displayed month defaults to the current Singapore month when no `?month=` param is present.
3. The `?month=YYYY-MM` URL parameter controls the displayed month; changing it via Prev/Next/Today updates the URL and re-renders the grid.
4. Day cells show the Singapore local date number in the correct position.
5. Days outside the displayed month are rendered in muted style but are present in the grid.
6. Today's cell has `aria-current="date"` and a visually distinct background.
7. Saturday and Sunday columns have a distinct background different from weekdays.
8. A day with todos due on it shows a count badge with the correct number.
9. Clicking a day cell opens `CalendarDayModal` listing all todos due that day.
10. Todos in the modal show title and completion status; completed todos are visually struck through.
11. The modal closes on Escape key press and backdrop click.
12. Singapore public holidays appear as `HolidayBadge` components (red text) on the correct day cells.
13. `GET /api/holidays` returns `401` for unauthenticated requests.
14. `GET /api/holidays?year=abc` returns `400` with "Invalid year or month parameter".
15. Todos with `due_date = null` do not appear on any calendar day.
16. `useHolidays` caches holiday data for 24 hours to minimise redundant API calls.
17. The calendar grid is computed entirely in Singapore timezone — a todo with `due_date='2026-04-09T16:00:00Z'` (midnight Apr 10 SG) appears on April 10, not April 9.
18. Navigating to a day in a different month from the "other month" cells changes the URL month and opens the modal for that day.
19. The seed script (`scripts/seed-holidays.ts`) must be idempotent — running it multiple times does not create duplicate rows (enforced by `UNIQUE(date, name)`).

---

## 9. Integration Points

### 9.1 What This Feature Consumes

| Dependency | Location | Usage |
|------------|----------|-------|
| `todos` table / `useTodos` hook | `lib/hooks/useTodos.ts` | All todos with `due_date` are grouped into calendar days |
| `todoKeys.lists()` | `lib/hooks/useTodos.ts` | `useCalendar` reads from existing cache; does not invalidate |
| `Todo` type | `lib/types/todo.ts` | Mapped to `CalendarTodo` (subset of fields) |
| `getSession()` | `lib/auth.ts` | Holidays API route verifies auth |
| `middleware.ts` | Root | `/calendar` route is protected — unauthenticated users redirect to `/login` |
| `lib/timezone.ts` | Shared utility | All date arithmetic uses `nowSG()`, `toSGDisplay()` |

### 9.2 What This Feature Exposes

| Export | Downstream Consumers |
|--------|---------------------|
| `Holiday` type | None currently |
| `CalendarDay`, `CalendarMonth` types | None currently |
| `useHolidays(year, month)` hook | Could be reused by reminder features or future agenda view |
| `GET /api/holidays` | Could be consumed by any feature needing holiday awareness |
| `buildCalendarMonth()` utility | Pure function — testable independently |

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| `?month=` param is malformed (e.g., `?month=bad`) | Parse fails → fall back to current SG month; no error shown |
| `?month=2026-13` (invalid month) | Clamp to valid range or fall back to current SG month |
| Todo `due_date` is UTC midnight (crosses date boundary in SG) | Always convert to SG local date before bucketing — `2026-04-09T16:00:00Z` = `2026-04-10 00:00 SGT` → appears on Apr 10 |
| No todos in month | Calendar renders normally with no count badges; clicking any day opens modal with "No todos due on this day." |
| All todos completed | Completed todos still appear on calendar days (with strikethrough in modal) |
| Holiday API fails | `useHolidays` returns error state; calendar renders without holiday badges and shows no error banner (graceful degradation) |
| Todos API fails | `useCalendar` returns `isError: true`; calendar page shows `<ErrorBanner>` |
| Month boundary: Feb in leap year | `buildCalendarMonth` uses `Intl.DateTimeFormat` or native `Date` to compute last day — handles leap years correctly |
| February 2026 (28 days, starts Sunday) | Grid still has 6 rows (last row mostly "other month" days) |
| User changes timezone in OS mid-session | Cached calendar grid is stale; next navigation to `/calendar` recomputes via `nowSG()` |
| `seed-holidays.ts` run on empty DB | Inserts all holiday rows; `UNIQUE` constraint prevents re-insertion on re-run |
| Clicking "other month" day | `onDayClick` detects `!day.isCurrentMonth` → navigate to that month URL then open modal for that day |
| More than 3 holidays on one day | All rendered as stacked `HolidayBadge` components; cell height expands (no truncation) |

---

## 11. Out of Scope

- Week view or agenda/list view (monthly grid only)
- Dragging todos between days
- Creating a new todo by clicking a calendar day (link to main page with date pre-filled is acceptable)
- Editing or completing todos from within the calendar modal (read-only view)
- Holidays for years beyond 2026 (seed script covers 2024–2026; extending requires updating the script)
- Custom user-defined holidays or blocked dates
- Timezone selector UI (app uses Asia/Singapore exclusively)
- Printing or exporting the calendar view
- Public holiday data for countries other than Singapore

---

## 12. Singapore Timezone Considerations

All calendar computations MUST use `Asia/Singapore` (UTC+8, no DST).

```typescript
// lib/calendar.ts

import { nowSG } from '@/lib/timezone'

/**
 * Convert a UTC ISO-8601 due_date to a Singapore local date string 'YYYY-MM-DD'.
 * Used to bucket todos into calendar day cells.
 */
export function toSGDateStr(isoUTC: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Singapore',
    year:  'numeric',
    month: '2-digit',
    day:   '2-digit',
  }).format(new Date(isoUTC))
  // 'sv-SE' locale produces 'YYYY-MM-DD' format
}

/**
 * Returns the current Singapore date as 'YYYY-MM-DD'.
 * Used for highlighting today.
 */
export function todaySG(): string {
  return toSGDateStr(nowSG().toISOString())
}

/**
 * Returns 'YYYY-MM' for the current Singapore month.
 * Used as the default URL parameter.
 */
export function currentSGMonth(): string {
  return todaySG().slice(0, 7)
}
```

**Critical rule:** Never compare `due_date` (UTC) directly with a `'YYYY-MM-DD'` string. Always convert `due_date` to SG local date first using `toSGDateStr()`.

**playwright.config.ts:** Set `TZ=Asia/Singapore` environment variable and use `use: { timezoneId: 'Asia/Singapore' }` in the Playwright config so all E2E tests run with the correct timezone.

```typescript
// playwright.config.ts (relevant snippet)
export default defineConfig({
  use: {
    timezoneId: 'Asia/Singapore',
  },
})
```

**Seed script timezone note:** The `scripts/seed-holidays.ts` script stores holiday dates as Singapore local dates (`'YYYY-MM-DD'`) — this is correct because Singapore public holidays are defined by Singapore calendar date, not UTC.
