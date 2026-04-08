import { describe, it, expect } from 'vitest'

/**
 * Progress calculation extracted from ProgressBar component (app/page.tsx).
 * Logic: Math.round((completed / total) * 100)
 */
function calculateProgress(completed: number, total: number): { percentage: number; isComplete: boolean } | null {
  if (total === 0) return null
  const percentage = Math.round((completed / total) * 100)
  return { percentage, isComplete: percentage === 100 }
}

describe('Progress Calculation', () => {
  it('returns null when total is 0', () => {
    expect(calculateProgress(0, 0)).toBeNull()
  })

  it('returns 0% when none completed', () => {
    const result = calculateProgress(0, 5)
    expect(result).toEqual({ percentage: 0, isComplete: false })
  })

  it('returns 100% when all completed', () => {
    const result = calculateProgress(5, 5)
    expect(result).toEqual({ percentage: 100, isComplete: true })
  })

  it('returns 50% for half completed', () => {
    const result = calculateProgress(2, 4)
    expect(result).toEqual({ percentage: 50, isComplete: false })
  })

  it('rounds percentage correctly (1/3 = 33%)', () => {
    const result = calculateProgress(1, 3)
    expect(result).toEqual({ percentage: 33, isComplete: false })
  })

  it('rounds percentage correctly (2/3 = 67%)', () => {
    const result = calculateProgress(2, 3)
    expect(result).toEqual({ percentage: 67, isComplete: false })
  })

  it('handles single subtask completed', () => {
    const result = calculateProgress(1, 1)
    expect(result).toEqual({ percentage: 100, isComplete: true })
  })

  it('handles single subtask not completed', () => {
    const result = calculateProgress(0, 1)
    expect(result).toEqual({ percentage: 0, isComplete: false })
  })

  it('handles large numbers', () => {
    const result = calculateProgress(750, 1000)
    expect(result).toEqual({ percentage: 75, isComplete: false })
  })
})

/**
 * Import ID remapping logic extracted from app/api/todos/import/route.ts.
 * Tags are remapped by name (case-insensitive). Todos/subtasks get fresh IDs.
 */
describe('Import Tag Name Remapping', () => {
  function buildTagNameToId(
    existingTags: { name: string; id: number }[],
    importTags: { name: string; color?: string }[]
  ): { tagNameToId: Record<string, number>; tagsCreated: number } {
    const tagNameToId: Record<string, number> = {}
    let nextId = Math.max(0, ...existingTags.map(t => t.id)) + 1

    for (const tag of existingTags) {
      tagNameToId[tag.name.toLowerCase()] = tag.id
    }

    for (const exportTag of importTags) {
      if (!exportTag.name || typeof exportTag.name !== 'string') continue
      const key = exportTag.name.trim().toLowerCase()
      if (!tagNameToId[key]) {
        tagNameToId[key] = nextId++
      }
    }

    const tagsCreated = Object.keys(tagNameToId).length - existingTags.length
    return { tagNameToId, tagsCreated }
  }

  it('reuses existing tags by name', () => {
    const existing = [{ name: 'work', id: 1 }, { name: 'personal', id: 2 }]
    const imported = [{ name: 'work', color: '#ff0000' }]
    const { tagNameToId, tagsCreated } = buildTagNameToId(existing, imported)
    expect(tagNameToId['work']).toBe(1)
    expect(tagsCreated).toBe(0)
  })

  it('creates new tags for unknown names', () => {
    const existing = [{ name: 'work', id: 1 }]
    const imported = [{ name: 'urgent', color: '#ef4444' }]
    const { tagNameToId, tagsCreated } = buildTagNameToId(existing, imported)
    expect(tagNameToId['work']).toBe(1)
    expect(tagNameToId['urgent']).toBeDefined()
    expect(tagsCreated).toBe(1)
  })

  it('is case-insensitive for tag matching', () => {
    const existing = [{ name: 'Work', id: 5 }]
    const imported = [{ name: 'WORK' }, { name: 'work' }]
    const { tagNameToId, tagsCreated } = buildTagNameToId(existing, imported)
    expect(tagNameToId['work']).toBe(5)
    expect(tagsCreated).toBe(0)
  })

  it('handles empty import tags', () => {
    const existing = [{ name: 'work', id: 1 }]
    const { tagNameToId, tagsCreated } = buildTagNameToId(existing, [])
    expect(Object.keys(tagNameToId)).toEqual(['work'])
    expect(tagsCreated).toBe(0)
  })

  it('handles no existing tags', () => {
    const imported = [{ name: 'new-tag' }, { name: 'another-tag' }]
    const { tagNameToId, tagsCreated } = buildTagNameToId([], imported)
    expect(tagsCreated).toBe(2)
    expect(tagNameToId['new-tag']).toBeDefined()
    expect(tagNameToId['another-tag']).toBeDefined()
  })

  it('skips invalid tag entries', () => {
    const imported = [{ name: '' }, { name: 'valid' }, { name: null as unknown as string }]
    const { tagsCreated } = buildTagNameToId([], imported)
    expect(tagsCreated).toBe(1)
  })

  it('remaps todo tag names to IDs', () => {
    const existing = [{ name: 'work', id: 10 }, { name: 'home', id: 20 }]
    const { tagNameToId } = buildTagNameToId(existing, [])

    const todoTags = ['work', 'home', 'unknown']
    const resolvedIds: number[] = []
    for (const tagName of todoTags) {
      const key = tagName.trim().toLowerCase()
      const tagId = tagNameToId[key]
      if (tagId) resolvedIds.push(tagId)
    }

    expect(resolvedIds).toEqual([10, 20])
  })
})

describe('Import Validation', () => {
  function validateImportFormat(body: unknown): { valid: boolean; error?: string } {
    if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid format' }
    const b = body as Record<string, unknown>
    if (!b.version || !Array.isArray(b.todos)) return { valid: false, error: 'Invalid import format' }
    if (b.version !== 1) return { valid: false, error: 'Unsupported export version' }
    return { valid: true }
  }

  function validateTodo(todo: Record<string, unknown>): boolean {
    return !!todo.title && typeof todo.title === 'string' && !!todo.title.trim()
  }

  function validatePriority(priority: unknown): string {
    const valid = ['high', 'medium', 'low']
    return valid.includes(priority as string) ? (priority as string) : 'medium'
  }

  it('rejects missing version', () => {
    expect(validateImportFormat({ todos: [] })).toEqual({ valid: false, error: 'Invalid import format' })
  })

  it('rejects missing todos array', () => {
    expect(validateImportFormat({ version: 1 })).toEqual({ valid: false, error: 'Invalid import format' })
  })

  it('rejects unsupported version', () => {
    expect(validateImportFormat({ version: 2, todos: [] })).toEqual({ valid: false, error: 'Unsupported export version' })
  })

  it('accepts valid format', () => {
    expect(validateImportFormat({ version: 1, todos: [] })).toEqual({ valid: true })
  })

  it('rejects empty title', () => {
    expect(validateTodo({ title: '' })).toBe(false)
    expect(validateTodo({ title: '   ' })).toBe(false)
  })

  it('accepts valid title', () => {
    expect(validateTodo({ title: 'Buy groceries' })).toBe(true)
  })

  it('rejects non-string title', () => {
    expect(validateTodo({ title: 123 as unknown })).toBe(false)
  })

  it('defaults invalid priority to medium', () => {
    expect(validatePriority('invalid')).toBe('medium')
    expect(validatePriority(undefined)).toBe('medium')
    expect(validatePriority(null)).toBe('medium')
  })

  it('accepts valid priorities', () => {
    expect(validatePriority('high')).toBe('high')
    expect(validatePriority('medium')).toBe('medium')
    expect(validatePriority('low')).toBe('low')
  })
})
