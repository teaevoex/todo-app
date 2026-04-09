import { describe, it, expect } from 'vitest'
import { queryKeys } from '@/lib/queryKeys'

describe('queryKeys', () => {
  it('returns static todos key', () => {
    expect(queryKeys.todos).toEqual(['todos'])
  })

  it('returns parameterized todo key', () => {
    expect(queryKeys.todo(42)).toEqual(['todos', 42])
  })

  it('returns static tags key', () => {
    expect(queryKeys.tags).toEqual(['tags'])
  })

  it('returns static templates key', () => {
    expect(queryKeys.templates).toEqual(['templates'])
  })

  it('returns parameterized holidays key', () => {
    expect(queryKeys.holidays(2026, 4)).toEqual(['holidays', 2026, 4])
  })

  it('returns static user key', () => {
    expect(queryKeys.user).toEqual(['auth', 'me'])
  })

  it('returns static notifications key', () => {
    expect(queryKeys.notifications).toEqual(['notifications'])
  })
})
