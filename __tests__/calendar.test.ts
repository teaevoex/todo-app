import { describe, it, expect, vi } from 'vitest'
import { toSGDateStr, isWeekend, getMonthBounds, buildCalendarMonth } from '@/lib/calendar'
import type { TodoWithRelations, Holiday } from '@/lib/types'

// Mock getSingaporeNow to return a fixed date for deterministic isToday checks
vi.mock('@/lib/timezone', () => ({
  getSingaporeNow: () => new Date('2026-04-09T02:00:00.000Z'), // 2026-04-09 10:00 SGT
}))

describe('toSGDateStr', () => {
  it('converts a UTC ISO string to YYYY-MM-DD in SGT', () => {
    // 2026-01-15 02:00 UTC = 2026-01-15 10:00 SGT
    expect(toSGDateStr('2026-01-15T02:00:00.000Z')).toBe('2026-01-15')
  })

  it('handles date boundary — late UTC becomes next day in SGT', () => {
    // 2026-01-15 20:00 UTC = 2026-01-16 04:00 SGT
    expect(toSGDateStr('2026-01-15T20:00:00.000Z')).toBe('2026-01-16')
  })

  it('handles midnight UTC', () => {
    // 2026-06-01 00:00 UTC = 2026-06-01 08:00 SGT
    expect(toSGDateStr('2026-06-01T00:00:00.000Z')).toBe('2026-06-01')
  })
})

describe('isWeekend', () => {
  it('returns true for Sunday (0)', () => {
    expect(isWeekend(0)).toBe(true)
  })

  it('returns true for Saturday (6)', () => {
    expect(isWeekend(6)).toBe(true)
  })

  it('returns false for Monday (1)', () => {
    expect(isWeekend(1)).toBe(false)
  })

  it('returns false for Friday (5)', () => {
    expect(isWeekend(5)).toBe(false)
  })
})

describe('getMonthBounds', () => {
  it('returns correct bounds for January 2026', () => {
    const bounds = getMonthBounds(2026, 1)
    expect(bounds.start).toBe('2026-01-01')
    expect(bounds.end).toBe('2026-01-31')
  })

  it('returns correct bounds for February 2026 (non-leap)', () => {
    const bounds = getMonthBounds(2026, 2)
    expect(bounds.start).toBe('2026-02-01')
    expect(bounds.end).toBe('2026-02-28')
  })

  it('returns correct bounds for February 2028 (leap year)', () => {
    const bounds = getMonthBounds(2028, 2)
    expect(bounds.start).toBe('2028-02-01')
    expect(bounds.end).toBe('2028-02-29')
  })

  it('returns correct bounds for December 2026', () => {
    const bounds = getMonthBounds(2026, 12)
    expect(bounds.start).toBe('2026-12-01')
    expect(bounds.end).toBe('2026-12-31')
  })
})

describe('buildCalendarMonth', () => {
  const emptyTodos: TodoWithRelations[] = []
  const emptyHolidays: Holiday[] = []

  it('returns 6 weeks x 7 days grid', () => {
    const cal = buildCalendarMonth(2026, 4, emptyTodos, emptyHolidays)
    expect(cal.weeks).toHaveLength(6)
    for (const week of cal.weeks) {
      expect(week).toHaveLength(7)
    }
  })

  it('returns correct year and month', () => {
    const cal = buildCalendarMonth(2026, 4, emptyTodos, emptyHolidays)
    expect(cal.year).toBe(2026)
    expect(cal.month).toBe(4)
  })

  it('first cell is a Sunday', () => {
    const cal = buildCalendarMonth(2026, 4, emptyTodos, emptyHolidays)
    // April 1, 2026 is Wednesday (day 3), so grid starts on March 29 (Sunday)
    const firstDay = cal.weeks[0][0]
    expect(firstDay.isWeekend).toBe(true) // Sunday
    expect(firstDay.date).toBe('2026-03-29')
  })

  it('marks current month days correctly', () => {
    const cal = buildCalendarMonth(2026, 4, emptyTodos, emptyHolidays)
    const firstDay = cal.weeks[0][0] // March 29
    expect(firstDay.isCurrentMonth).toBe(false)

    // April 1 should be in row 0 col 3 (Wednesday)
    const april1 = cal.weeks[0][3]
    expect(april1.date).toBe('2026-04-01')
    expect(april1.isCurrentMonth).toBe(true)
  })

  it('marks isToday correctly for the mocked date (2026-04-09)', () => {
    const cal = buildCalendarMonth(2026, 4, emptyTodos, emptyHolidays)
    let foundToday = false
    for (const week of cal.weeks) {
      for (const day of week) {
        if (day.date === '2026-04-09') {
          expect(day.isToday).toBe(true)
          foundToday = true
        } else {
          expect(day.isToday).toBe(false)
        }
      }
    }
    expect(foundToday).toBe(true)
  })

  it('places todos on correct dates', () => {
    const todos: TodoWithRelations[] = [
      {
        id: 1,
        user_id: 1,
        title: 'Test todo',
        completed: false,
        priority: 'high',
        due_date: '2026-04-15T02:00:00.000Z', // April 15 SGT
        is_recurring: false,
        recurrence_pattern: null,
        reminder_minutes: null,
        last_notification_sent: null,
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: '2026-04-01T00:00:00.000Z',
        subtasks: [],
        tags: [],
      },
    ]
    const cal = buildCalendarMonth(2026, 4, todos, emptyHolidays)

    let foundTodo = false
    for (const week of cal.weeks) {
      for (const day of week) {
        if (day.date === '2026-04-15') {
          expect(day.todos).toHaveLength(1)
          expect(day.todos[0].title).toBe('Test todo')
          foundTodo = true
        }
      }
    }
    expect(foundTodo).toBe(true)
  })

  it('places holidays on correct dates', () => {
    const holidays: Holiday[] = [
      { id: 1, date: '2026-04-10', name: 'Good Friday', year: 2026 },
    ]
    const cal = buildCalendarMonth(2026, 4, emptyTodos, holidays)

    let foundHoliday = false
    for (const week of cal.weeks) {
      for (const day of week) {
        if (day.date === '2026-04-10') {
          expect(day.holidays).toHaveLength(1)
          expect(day.holidays[0].name).toBe('Good Friday')
          foundHoliday = true
        }
      }
    }
    expect(foundHoliday).toBe(true)
  })

  it('marks weekends correctly', () => {
    const cal = buildCalendarMonth(2026, 4, emptyTodos, emptyHolidays)
    for (const week of cal.weeks) {
      // Column 0 = Sunday, Column 6 = Saturday
      expect(week[0].isWeekend).toBe(true)
      expect(week[6].isWeekend).toBe(true)
      expect(week[1].isWeekend).toBe(false)
      expect(week[5].isWeekend).toBe(false)
    }
  })
})
