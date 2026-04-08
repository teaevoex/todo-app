import { toZonedTime, format } from 'date-fns-tz'

const TIMEZONE = 'Asia/Singapore'

export function getSingaporeNow(): Date {
  return toZonedTime(new Date(), TIMEZONE)
}

export function formatSingaporeDate(
  date: Date | string,
  fmt: string = 'yyyy-MM-dd HH:mm'
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(toZonedTime(d, TIMEZONE), fmt, { timeZone: TIMEZONE })
}

export function toSingaporeISOString(date: Date): string {
  return formatSingaporeDate(date, "yyyy-MM-dd'T'HH:mm:ss")
}

export type RecurrencePatternType = 'daily' | 'weekly' | 'monthly' | 'yearly'

export function calculateNextDueDate(
  currentDueDate: string,
  pattern: RecurrencePatternType
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

export { TIMEZONE }
