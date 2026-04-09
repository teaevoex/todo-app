import { describe, it, expect } from 'vitest'
import { calculateProgress } from '@/lib/utils/progress'

describe('calculateProgress', () => {
  it('returns 0 when total is 0', () => {
    expect(calculateProgress(0, 0)).toBe(0)
  })

  it('returns 0 when no items completed', () => {
    expect(calculateProgress(0, 5)).toBe(0)
  })

  it('returns 100 when all items completed', () => {
    expect(calculateProgress(5, 5)).toBe(100)
  })

  it('returns 60 for 3 of 5 completed', () => {
    expect(calculateProgress(3, 5)).toBe(60)
  })

  it('rounds correctly for 1 of 3 (33.33... -> 33)', () => {
    expect(calculateProgress(1, 3)).toBe(33)
  })

  it('rounds correctly for 2 of 3 (66.66... -> 67)', () => {
    expect(calculateProgress(2, 3)).toBe(67)
  })
})
