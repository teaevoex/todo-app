import { describe, it, expect } from 'vitest'
import { sortByPriorityThenDueDate } from '@/lib/utils/sortTodos'

type TestTodo = { priority: 'high' | 'medium' | 'low'; due_date: string | null }

describe('sortByPriorityThenDueDate', () => {
  it('sorts high before medium before low', () => {
    const todos: TestTodo[] = [
      { priority: 'low', due_date: null },
      { priority: 'high', due_date: null },
      { priority: 'medium', due_date: null },
    ]
    const sorted = sortByPriorityThenDueDate(todos)
    expect(sorted.map((t) => t.priority)).toEqual(['high', 'medium', 'low'])
  })

  it('sorts by due_date ascending within same priority', () => {
    const todos: TestTodo[] = [
      { priority: 'high', due_date: '2026-03-15T00:00:00.000Z' },
      { priority: 'high', due_date: '2026-01-15T00:00:00.000Z' },
      { priority: 'high', due_date: '2026-02-15T00:00:00.000Z' },
    ]
    const sorted = sortByPriorityThenDueDate(todos)
    expect(sorted.map((t) => t.due_date)).toEqual([
      '2026-01-15T00:00:00.000Z',
      '2026-02-15T00:00:00.000Z',
      '2026-03-15T00:00:00.000Z',
    ])
  })

  it('places null due_dates last within same priority', () => {
    const todos: TestTodo[] = [
      { priority: 'medium', due_date: null },
      { priority: 'medium', due_date: '2026-01-15T00:00:00.000Z' },
    ]
    const sorted = sortByPriorityThenDueDate(todos)
    expect(sorted[0].due_date).toBe('2026-01-15T00:00:00.000Z')
    expect(sorted[1].due_date).toBeNull()
  })

  it('returns a new array (does not mutate input)', () => {
    const todos: TestTodo[] = [
      { priority: 'low', due_date: null },
      { priority: 'high', due_date: null },
    ]
    const sorted = sortByPriorityThenDueDate(todos)
    expect(sorted).not.toBe(todos)
    expect(todos[0].priority).toBe('low') // original unchanged
  })

  it('returns empty array for empty input', () => {
    const result = sortByPriorityThenDueDate([])
    expect(result).toEqual([])
  })

  it('handles single element', () => {
    const todos: TestTodo[] = [{ priority: 'medium', due_date: null }]
    const sorted = sortByPriorityThenDueDate(todos)
    expect(sorted).toHaveLength(1)
    expect(sorted[0].priority).toBe('medium')
  })
})
