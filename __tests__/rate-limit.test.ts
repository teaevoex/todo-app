import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkRateLimit } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('allows requests within the limit', () => {
    const result = checkRateLimit('test-key-1', 5, 60_000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('tracks remaining requests', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit('test-key-2', 5, 60_000)
    }
    const result = checkRateLimit('test-key-2', 5, 60_000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('blocks requests exceeding the limit', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-key-3', 5, 60_000)
    }
    const result = checkRateLimit('test-key-3', 5, 60_000)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets after the window expires', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-key-4', 5, 60_000)
    }
    const blocked = checkRateLimit('test-key-4', 5, 60_000)
    expect(blocked.allowed).toBe(false)

    vi.advanceTimersByTime(61_000)

    const allowed = checkRateLimit('test-key-4', 5, 60_000)
    expect(allowed.allowed).toBe(true)
    expect(allowed.remaining).toBe(4)
  })

  it('isolates different keys', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('key-a', 5, 60_000)
    }
    const resultA = checkRateLimit('key-a', 5, 60_000)
    expect(resultA.allowed).toBe(false)

    const resultB = checkRateLimit('key-b', 5, 60_000)
    expect(resultB.allowed).toBe(true)
  })

  it('returns resetAt timestamp', () => {
    const now = Date.now()
    const result = checkRateLimit('test-key-5', 5, 60_000)
    expect(result.resetAt).toBeGreaterThanOrEqual(now)
    expect(result.resetAt).toBeLessThanOrEqual(now + 60_000)
  })
})
