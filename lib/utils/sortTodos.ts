import type { Todo } from '@/lib/types'

const PRIORITY_ORDER: Record<string, number> = {
  high: 1,
  medium: 2,
  low: 3,
}

/**
 * Sorts todos by priority (high → medium → low) then by due_date ASC (nulls last).
 * Returns a new array — does not mutate the input.
 */
export function sortByPriorityThenDueDate<T extends Pick<Todo, 'priority' | 'due_date'>>(
  todos: T[]
): T[] {
  return [...todos].sort((a, b) => {
    const pA = PRIORITY_ORDER[a.priority] ?? 2
    const pB = PRIORITY_ORDER[b.priority] ?? 2
    const pDiff = pA - pB
    if (pDiff !== 0) return pDiff

    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })
}
