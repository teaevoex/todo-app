/**
 * Recurrence date calculation for recurring todos.
 * All arithmetic uses Singapore timezone (Asia/Singapore, UTC+8).
 * Singapore does not observe DST, so UTC+8 is constant.
 */

import type { RecurrencePattern } from '@/lib/types'

const SG_OFFSET_MS = 8 * 60 * 60 * 1000 // UTC+8 in milliseconds

/**
 * Converts a UTC Date to Singapore local date components (year, month, day, hours, minutes, seconds).
 */
function toSGComponents(utcDate: Date): {
  year: number
  month: number  // 1-based
  day: number
  hours: number
  minutes: number
  seconds: number
  ms: number
} {
  const sgMs = utcDate.getTime() + SG_OFFSET_MS
  const sgDate = new Date(sgMs)
  return {
    year: sgDate.getUTCFullYear(),
    month: sgDate.getUTCMonth() + 1,  // convert to 1-based
    day: sgDate.getUTCDate(),
    hours: sgDate.getUTCHours(),
    minutes: sgDate.getUTCMinutes(),
    seconds: sgDate.getUTCSeconds(),
    ms: sgDate.getUTCMilliseconds(),
  }
}

/**
 * Converts Singapore local date components back to a UTC Date.
 */
function fromSGComponents(
  year: number,
  month: number,  // 1-based
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  ms: number
): Date {
  const sgMs = Date.UTC(year, month - 1, day, hours, minutes, seconds, ms)
  return new Date(sgMs - SG_OFFSET_MS)
}

/**
 * Returns the number of days in a given month (1-based) of a year.
 */
function daysInMonth(year: number, month: number): number {
  // Month is 1-based; Day 0 of next month = last day of this month
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Calculates the next due date given a current due date and recurrence pattern.
 *
 * All date arithmetic is performed in Singapore timezone (UTC+8) to preserve
 * wall-clock time and handle calendar boundaries correctly.
 *
 * - daily:   advance by 1 calendar day in SGT
 * - weekly:  advance by 7 calendar days in SGT
 * - monthly: advance by 1 month in SGT; clamp to last day if target day > month length
 *            (e.g., Jan 31 → Feb 28/29)
 * - yearly:  advance by 1 year in SGT; clamp Feb 29 to Feb 28 in non-leap years
 *
 * @param currentDueDate - UTC ISO-8601 string (as stored in DB)
 * @param pattern - recurrence pattern
 * @returns UTC ISO-8601 string for the next due date
 */
export function calculateNextDueDate(
  currentDueDate: string,
  pattern: RecurrencePattern
): string {
  const utcDate = new Date(currentDueDate)
  const sg = toSGComponents(utcDate)

  let nextYear = sg.year
  let nextMonth = sg.month
  let nextDay = sg.day

  switch (pattern) {
    case 'daily': {
      // Add 1 day using UTC-based arithmetic on the SG date components
      const sgMs = Date.UTC(sg.year, sg.month - 1, sg.day + 1, sg.hours, sg.minutes, sg.seconds, sg.ms)
      const nextSgDate = new Date(sgMs)
      nextYear = nextSgDate.getUTCFullYear()
      nextMonth = nextSgDate.getUTCMonth() + 1
      nextDay = nextSgDate.getUTCDate()
      break
    }

    case 'weekly': {
      // Add 7 days
      const sgMs = Date.UTC(sg.year, sg.month - 1, sg.day + 7, sg.hours, sg.minutes, sg.seconds, sg.ms)
      const nextSgDate = new Date(sgMs)
      nextYear = nextSgDate.getUTCFullYear()
      nextMonth = nextSgDate.getUTCMonth() + 1
      nextDay = nextSgDate.getUTCDate()
      break
    }

    case 'monthly': {
      // Advance month by 1, preserving the same day; clamp if needed
      nextMonth = sg.month + 1
      if (nextMonth > 12) {
        nextMonth = 1
        nextYear = sg.year + 1
      }
      const maxDay = daysInMonth(nextYear, nextMonth)
      nextDay = Math.min(sg.day, maxDay)
      break
    }

    case 'yearly': {
      // Advance year by 1, preserving month+day; clamp Feb 29 on non-leap years
      nextYear = sg.year + 1
      const maxDay = daysInMonth(nextYear, sg.month)
      nextDay = Math.min(sg.day, maxDay)
      break
    }

    default: {
      const _exhaustive: never = pattern
      throw new Error(`Unknown recurrence pattern: ${String(_exhaustive)}`)
    }
  }

  const nextUtcDate = fromSGComponents(nextYear, nextMonth, nextDay, sg.hours, sg.minutes, sg.seconds, sg.ms)
  return nextUtcDate.toISOString()
}
