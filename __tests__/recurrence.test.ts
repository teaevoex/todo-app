import { describe, it, expect } from 'vitest'
import { calculateNextDueDate } from '@/lib/recurrence'

describe('calculateNextDueDate', () => {
  describe('daily', () => {
    it('advances by 1 calendar day', () => {
      // 2026-01-15 10:00 SGT = 2026-01-15 02:00 UTC
      const result = calculateNextDueDate('2026-01-15T02:00:00.000Z', 'daily')
      expect(result).toBe('2026-01-16T02:00:00.000Z')
    })

    it('rolls over month boundary', () => {
      // 2026-01-31 10:00 SGT = 2026-01-31 02:00 UTC
      const result = calculateNextDueDate('2026-01-31T02:00:00.000Z', 'daily')
      expect(result).toBe('2026-02-01T02:00:00.000Z')
    })

    it('rolls over year boundary', () => {
      // 2026-12-31 10:00 SGT = 2026-12-31 02:00 UTC
      const result = calculateNextDueDate('2026-12-31T02:00:00.000Z', 'daily')
      expect(result).toBe('2027-01-01T02:00:00.000Z')
    })

    it('preserves time-of-day component', () => {
      // 2026-03-10 15:30:45 SGT = 2026-03-10 07:30:45 UTC
      const result = calculateNextDueDate('2026-03-10T07:30:45.000Z', 'daily')
      expect(result).toBe('2026-03-11T07:30:45.000Z')
    })
  })

  describe('weekly', () => {
    it('advances by 7 calendar days', () => {
      const result = calculateNextDueDate('2026-01-15T02:00:00.000Z', 'weekly')
      expect(result).toBe('2026-01-22T02:00:00.000Z')
    })

    it('rolls over month boundary', () => {
      const result = calculateNextDueDate('2026-01-29T02:00:00.000Z', 'weekly')
      expect(result).toBe('2026-02-05T02:00:00.000Z')
    })
  })

  describe('monthly', () => {
    it('advances by 1 month for normal case', () => {
      const result = calculateNextDueDate('2026-01-15T02:00:00.000Z', 'monthly')
      expect(result).toBe('2026-02-15T02:00:00.000Z')
    })

    it('clamps Jan 31 to Feb 28 in non-leap year', () => {
      // 2026 is not a leap year
      const result = calculateNextDueDate('2026-01-31T02:00:00.000Z', 'monthly')
      expect(result).toBe('2026-02-28T02:00:00.000Z')
    })

    it('clamps Jan 31 to Feb 29 in leap year', () => {
      // 2028 is a leap year
      const result = calculateNextDueDate('2028-01-31T02:00:00.000Z', 'monthly')
      expect(result).toBe('2028-02-29T02:00:00.000Z')
    })

    it('rolls December to January of next year', () => {
      const result = calculateNextDueDate('2026-12-15T02:00:00.000Z', 'monthly')
      expect(result).toBe('2027-01-15T02:00:00.000Z')
    })

    it('preserves time-of-day through month boundary', () => {
      const result = calculateNextDueDate('2026-03-15T07:30:45.000Z', 'monthly')
      expect(result).toBe('2026-04-15T07:30:45.000Z')
    })
  })

  describe('yearly', () => {
    it('advances by 1 year for normal case', () => {
      const result = calculateNextDueDate('2026-06-15T02:00:00.000Z', 'yearly')
      expect(result).toBe('2027-06-15T02:00:00.000Z')
    })

    it('clamps Feb 29 to Feb 28 in non-leap year', () => {
      // 2028 is leap, 2029 is not
      const result = calculateNextDueDate('2028-02-29T02:00:00.000Z', 'yearly')
      expect(result).toBe('2029-02-28T02:00:00.000Z')
    })

    it('preserves Feb 29 when next year is also leap (after 8 years)', () => {
      // 2096 is leap, 2097 is not -> clamps
      const result = calculateNextDueDate('2096-02-29T02:00:00.000Z', 'yearly')
      expect(result).toBe('2097-02-28T02:00:00.000Z')
    })
  })
})
