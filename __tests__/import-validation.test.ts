import { describe, it, expect } from 'vitest'
import { validatePayload } from '@/lib/validation/import'

describe('validatePayload', () => {
  it('returns true for a valid minimal payload', () => {
    const payload = { version: 1, todos: [], subtasks: [], tags: [], todoTags: [] }
    expect(validatePayload(payload)).toBe(true)
  })

  it('returns true for a payload with todos', () => {
    const payload = {
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      todos: [{ id: 1, title: 'Test', completed: false }],
      subtasks: [],
      tags: [],
      todoTags: [],
    }
    expect(validatePayload(payload)).toBe(true)
  })

  it('returns false for null', () => {
    expect(validatePayload(null)).toBe(false)
  })

  it('returns false for non-object', () => {
    expect(validatePayload('string')).toBe(false)
  })

  it('throws for missing version field', () => {
    expect(() => validatePayload({ todos: [] })).toThrow('Missing required field: version')
  })

  it('throws for non-number version', () => {
    expect(() => validatePayload({ version: '1', todos: [] })).toThrow(
      "Field 'version' must be a number"
    )
  })

  it('throws for unsupported version', () => {
    expect(() => validatePayload({ version: 2, todos: [] })).toThrow(
      'Unsupported export version: 2'
    )
  })

  it('throws for missing todos array', () => {
    expect(() => validatePayload({ version: 1 })).toThrow(
      "Invalid JSON structure: missing required field 'todos'"
    )
  })

  it('throws when todos is not an array', () => {
    expect(() => validatePayload({ version: 1, todos: 'not-array' })).toThrow(
      "Invalid JSON structure: missing required field 'todos'"
    )
  })
})
