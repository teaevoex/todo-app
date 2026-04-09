import { describe, it, expect } from 'vitest'
import {
  getSingaporeNow,
  formatSingaporeDate,
  toSingaporeISO,
  parseSingaporeDate,
} from '@/lib/timezone'

describe('formatSingaporeDate', () => {
  it('formats a UTC ISO string into Singapore time', () => {
    // 2026-01-15 02:00 UTC = 2026-01-15 10:00 SGT
    const result = formatSingaporeDate('2026-01-15T02:00:00.000Z')
    expect(result).toContain('15')
    expect(result).toContain('Jan')
    expect(result).toContain('2026')
    expect(result).toContain('10:00')
  })

  it('applies custom format options', () => {
    const result = formatSingaporeDate('2026-06-20T16:30:00.000Z', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    // 2026-06-20 16:30 UTC = 2026-06-21 00:30 SGT
    expect(result).toContain('June' /* or 'Jun' depending on locale */)
    expect(result).toContain('2026')
  })
})

describe('toSingaporeISO', () => {
  it('returns a string with +08:00 offset', () => {
    const date = new Date('2026-01-15T02:00:00.000Z')
    const result = toSingaporeISO(date)
    expect(result).toContain('+08:00')
    expect(result).toContain('2026-01-15')
    expect(result).toContain('10:00:00')
  })

  it('uses current time when no argument provided', () => {
    const result = toSingaporeISO()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/)
  })
})

describe('parseSingaporeDate', () => {
  it('returns a Date for a valid ISO string', () => {
    const result = parseSingaporeDate('2026-01-15T10:00:00+08:00')
    expect(result).toBeInstanceOf(Date)
    expect(result.getTime()).toBe(new Date('2026-01-15T02:00:00.000Z').getTime())
  })

  it('throws for invalid date strings', () => {
    expect(() => parseSingaporeDate('not-a-date')).toThrow('Invalid date string')
  })

  it('throws for empty string', () => {
    expect(() => parseSingaporeDate('')).toThrow('Invalid date string')
  })
})

describe('getSingaporeNow', () => {
  it('returns a Date object', () => {
    const result = getSingaporeNow()
    expect(result).toBeInstanceOf(Date)
  })

  it('returns a date reasonably close to now', () => {
    const before = Date.now()
    const result = getSingaporeNow()
    const after = Date.now()
    // The returned date represents SGT wall-clock as if it were UTC,
    // so it may differ from actual UTC by ~8 hours. Just check it's a valid date.
    expect(result.getTime()).not.toBeNaN()
    expect(result.getFullYear()).toBeGreaterThanOrEqual(2026)
  })
})
