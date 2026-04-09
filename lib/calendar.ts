/**
 * Calendar utility functions for the monthly calendar view.
 * All date arithmetic uses Asia/Singapore timezone.
 */

import { getSingaporeNow } from '@/lib/timezone'
import type { TodoWithRelations, Holiday } from '@/lib/types'

const SG_TIMEZONE = 'Asia/Singapore'

// ============================================================
// Types
// ============================================================

export interface CalendarTodo {
  id: number
  title: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
}

export interface CalendarDay {
  date: string           // 'YYYY-MM-DD' Singapore local date
  dayOfMonth: number
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean     // Saturday (day 6) or Sunday (day 0)
  todos: CalendarTodo[]
  holidays: Holiday[]
}

export interface CalendarMonth {
  year: number
  month: number          // 1-12
  weeks: CalendarDay[][] // 6 rows × 7 columns
}

// ============================================================
// Date helpers
// ============================================================

/**
 * Convert a UTC ISO-8601 due_date to a Singapore local date string 'YYYY-MM-DD'.
 * Uses sv-SE locale which produces YYYY-MM-DD format.
 */
export function toSGDateStr(isoUTC: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: SG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(isoUTC))
}

/**
 * Returns the current Singapore date as 'YYYY-MM-DD'.
 */
export function todaySG(): string {
  return toSGDateStr(getSingaporeNow().toISOString())
}

/**
 * Returns 'YYYY-MM' for the current Singapore month.
 */
export function currentSGMonth(): string {
  return todaySG().slice(0, 7)
}

/**
 * Returns whether a day-of-week index is a weekend.
 * 0 = Sunday, 6 = Saturday.
 */
export function isWeekend(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6
}

/**
 * Returns month bounds for a given year/month (1-indexed).
 */
export function getMonthBounds(
  year: number,
  month: number
): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  // Get last day of month by going to first day of next month minus 1 day
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const lastDay = new Date(
    Date.UTC(nextYear, nextMonth - 1, 1) - 86400000
  )
  const lastDayStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: SG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(lastDay)
  return { start, end: lastDayStr }
}

/**
 * Add a number of days to a YYYY-MM-DD date string and return a new YYYY-MM-DD.
 * Uses UTC arithmetic to avoid DST issues (SG has no DST anyway).
 */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d) + days * 86400000
  const result = new Date(utc)
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(result)
}

/**
 * Get day-of-week (0=Sunday..6=Saturday) for a YYYY-MM-DD date string,
 * treating the date as a Singapore local date.
 */
function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  // Use UTC date directly — since we're working with calendar dates in SG
  // and SG has no DST, we just need the day of week for the calendar date itself.
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * Get day of month from YYYY-MM-DD.
 */
function getDayOfMonth(dateStr: string): number {
  return parseInt(dateStr.split('-')[2], 10)
}

// ============================================================
// Calendar builder
// ============================================================

/**
 * Build a CalendarMonth grid for the given year and month.
 * Grid starts on Sunday and has exactly 6 rows × 7 columns.
 *
 * @param year     4-digit year (e.g. 2026)
 * @param month    1-indexed month (1–12)
 * @param todos    All todos (those without due_date are ignored)
 * @param holidays Holidays for this month
 */
export function buildCalendarMonth(
  year: number,
  month: number,
  todos: TodoWithRelations[],
  holidays: Holiday[]
): CalendarMonth {
  const todaySGStr = todaySG()

  // First day of the month
  const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`
  const firstDayOfWeek = getDayOfWeek(firstDayStr)

  // Grid start: pad back to Sunday
  const gridStartStr = addDays(firstDayStr, -firstDayOfWeek)

  // Build todo lookup by SG date string
  const todosByDate = new Map<string, CalendarTodo[]>()
  for (const todo of todos) {
    if (!todo.due_date) continue
    const sgDate = toSGDateStr(todo.due_date)
    const existing = todosByDate.get(sgDate) ?? []
    todosByDate.set(sgDate, [
      ...existing,
      {
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        priority: todo.priority,
      },
    ])
  }

  // Build holiday lookup by date string
  const holidaysByDate = new Map<string, Holiday[]>()
  for (const holiday of holidays) {
    const existing = holidaysByDate.get(holiday.date) ?? []
    holidaysByDate.set(holiday.date, [...existing, holiday])
  }

  // Generate 6 rows × 7 columns
  const weeks: CalendarDay[][] = []
  let currentDateStr = gridStartStr

  for (let row = 0; row < 6; row++) {
    const week: CalendarDay[] = []
    for (let col = 0; col < 7; col++) {
      const cellMonth = parseInt(currentDateStr.split('-')[1], 10)
      const cellYear = parseInt(currentDateStr.split('-')[0], 10)
      const dayOfWeek = col // 0=Sun..6=Sat (column index = day of week)

      week.push({
        date: currentDateStr,
        dayOfMonth: getDayOfMonth(currentDateStr),
        isCurrentMonth: cellYear === year && cellMonth === month,
        isToday: currentDateStr === todaySGStr,
        isWeekend: isWeekend(dayOfWeek),
        todos: todosByDate.get(currentDateStr) ?? [],
        holidays: holidaysByDate.get(currentDateStr) ?? [],
      })

      currentDateStr = addDays(currentDateStr, 1)
    }
    weeks.push(week)
  }

  return { year, month, weeks }
}
