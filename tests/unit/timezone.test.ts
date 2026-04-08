import { describe, it, expect } from 'vitest'
import {
  getSingaporeNow,
  formatSingaporeDate,
  toSingaporeISOString,
  calculateNextDueDate,
  TIMEZONE,
} from '@/lib/timezone'

describe('TIMEZONE constant', () => {
  it('should be Asia/Singapore', () => {
    expect(TIMEZONE).toBe('Asia/Singapore')
  })
})

describe('getSingaporeNow', () => {
  it('returns a Date object', () => {
    const now = getSingaporeNow()
    expect(now).toBeInstanceOf(Date)
  })

  it('returns a reasonable date (not epoch or future)', () => {
    const now = getSingaporeNow()
    const year = now.getFullYear()
    expect(year).toBeGreaterThanOrEqual(2024)
    expect(year).toBeLessThanOrEqual(2030)
  })
})

describe('formatSingaporeDate', () => {
  it('formats a Date with default format', () => {
    const date = new Date('2025-06-15T10:30:00Z')
    const result = formatSingaporeDate(date)
    // Singapore is UTC+8, so 10:30 UTC = 18:30 SGT
    expect(result).toBe('2025-06-15 18:30')
  })

  it('formats a string date', () => {
    const result = formatSingaporeDate('2025-01-01T00:00:00Z')
    // 00:00 UTC = 08:00 SGT
    expect(result).toBe('2025-01-01 08:00')
  })

  it('supports custom format strings', () => {
    const date = new Date('2025-03-20T12:00:00Z')
    const result = formatSingaporeDate(date, 'yyyy-MM-dd')
    expect(result).toBe('2025-03-20')
  })

  it('formats time-only patterns', () => {
    const date = new Date('2025-06-15T10:30:00Z')
    const result = formatSingaporeDate(date, 'HH:mm')
    expect(result).toBe('18:30')
  })
})

describe('toSingaporeISOString', () => {
  it('returns ISO-like string in Singapore timezone', () => {
    const date = new Date('2025-06-15T10:00:00Z')
    const result = toSingaporeISOString(date)
    // 10:00 UTC = 18:00 SGT
    expect(result).toBe('2025-06-15T18:00:00')
  })

  it('handles midnight UTC correctly', () => {
    const date = new Date('2025-01-01T00:00:00Z')
    const result = toSingaporeISOString(date)
    // 00:00 UTC = 08:00 SGT
    expect(result).toBe('2025-01-01T08:00:00')
  })

  it('handles date boundary crossing', () => {
    // 20:00 UTC on Jan 1 = 04:00 SGT on Jan 2
    const date = new Date('2025-01-01T20:00:00Z')
    const result = toSingaporeISOString(date)
    expect(result).toBe('2025-01-02T04:00:00')
  })
})

describe('calculateNextDueDate', () => {
  const baseDate = '2025-06-15T12:00:00.000Z'

  it('calculates daily recurrence', () => {
    const result = calculateNextDueDate(baseDate, 'daily')
    const next = new Date(result)
    const base = new Date(baseDate)
    const diffMs = next.getTime() - base.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    expect(diffDays).toBe(1)
  })

  it('calculates weekly recurrence', () => {
    const result = calculateNextDueDate(baseDate, 'weekly')
    const next = new Date(result)
    const base = new Date(baseDate)
    const diffMs = next.getTime() - base.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    expect(diffDays).toBe(7)
  })

  it('calculates monthly recurrence', () => {
    const result = calculateNextDueDate(baseDate, 'monthly')
    const next = new Date(result)
    expect(next.getMonth()).toBe(6) // July (0-indexed)
    expect(next.getDate()).toBe(15)
  })

  it('calculates yearly recurrence', () => {
    const result = calculateNextDueDate(baseDate, 'yearly')
    const next = new Date(result)
    expect(next.getFullYear()).toBe(2026)
    expect(next.getMonth()).toBe(5) // June
    expect(next.getDate()).toBe(15)
  })

  it('handles month boundary (Jan 31 + monthly)', () => {
    const jan31 = '2025-01-31T12:00:00.000Z'
    const result = calculateNextDueDate(jan31, 'monthly')
    const next = new Date(result)
    // JS Date rolls Jan 31 + 1 month to Mar 3 (Feb has 28 days in 2025)
    expect(next.getMonth()).toBe(2) // March
  })

  it('handles leap year (Feb 29 + yearly)', () => {
    const feb29 = '2024-02-29T12:00:00.000Z'
    const result = calculateNextDueDate(feb29, 'yearly')
    const next = new Date(result)
    expect(next.getFullYear()).toBe(2025)
    // Feb 29 2024 + 1 year = Mar 1 2025 (no Feb 29 in 2025)
    expect(next.getMonth()).toBe(2) // March
  })

  it('returns a valid ISO string', () => {
    const result = calculateNextDueDate(baseDate, 'daily')
    expect(() => new Date(result)).not.toThrow()
    expect(new Date(result).toISOString()).toBe(result)
  })
})
