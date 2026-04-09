'use client'

import { useState, useMemo, useCallback } from 'react'
import { useSearch } from './useSearch'
import type { TodoWithRelations, Priority, FilterState } from '@/lib/types'

type CompletionFilter = 'all' | 'completed' | 'incomplete'

const DEFAULT_FILTERS: FilterState = {
  searchQuery: '',
  priorityFilter: 'all',
  tagFilter: 'all',
  completionFilter: 'all',
  dateFrom: null,
  dateTo: null,
}

export interface UseFiltersReturn {
  filters: FilterState
  filterTodos: (todos: TodoWithRelations[]) => TodoWithRelations[]
  activeFilterCount: number
  setSearch: (q: string) => void
  setPriority: (p: Priority | 'all') => void
  setTag: (tagId: number | 'all') => void
  setCompletion: (c: CompletionFilter) => void
  setDateFrom: (d: string | null) => void
  setDateTo: (d: string | null) => void
  clearAllFilters: () => void
}

export function useFilters(): UseFiltersReturn {
  const { searchQuery, debouncedQuery, setSearchQuery, clearSearch } = useSearch()
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [tagFilter, setTagFilter] = useState<number | 'all'>('all')
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all')
  const [dateFrom, setDateFrom] = useState<string | null>(null)
  const [dateTo, setDateTo] = useState<string | null>(null)

  const filters: FilterState = useMemo(
    () => ({
      searchQuery,
      priorityFilter,
      tagFilter,
      completionFilter,
      dateFrom,
      dateTo,
    }),
    [searchQuery, priorityFilter, tagFilter, completionFilter, dateFrom, dateTo]
  )

  const filterTodos = useCallback(
    (todos: TodoWithRelations[]): TodoWithRelations[] => {
      const query = debouncedQuery.toLowerCase().trim()

      return todos.filter((todo) => {
        // 1. Text search: match title OR any tag name (case-insensitive)
        if (query) {
          const titleMatch = todo.title.toLowerCase().includes(query)
          const tagMatch = (todo.tags ?? []).some((t) =>
            t.name.toLowerCase().includes(query)
          )
          if (!titleMatch && !tagMatch) return false
        }

        // 2. Priority filter
        if (priorityFilter !== 'all' && todo.priority !== priorityFilter) return false

        // 3. Tag filter
        if (tagFilter !== 'all' && !(todo.tags ?? []).some((t) => t.id === tagFilter)) return false

        // 4. Completion filter
        if (completionFilter === 'completed' && !todo.completed) return false
        if (completionFilter === 'incomplete' && todo.completed) return false

        // 5. Date range filter
        if (dateFrom && todo.due_date && todo.due_date < dateFrom) return false
        if (dateTo && todo.due_date && todo.due_date > dateTo) return false

        return true
      })
    },
    [debouncedQuery, priorityFilter, tagFilter, completionFilter, dateFrom, dateTo]
  )

  const activeFilterCount = [
    debouncedQuery ? 1 : 0,
    priorityFilter !== 'all' ? 1 : 0,
    tagFilter !== 'all' ? 1 : 0,
    completionFilter !== 'all' ? 1 : 0,
    dateFrom ? 1 : 0,
    dateTo ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  function clearAllFilters() {
    clearSearch()
    setPriorityFilter('all')
    setTagFilter('all')
    setCompletionFilter('all')
    setDateFrom(null)
    setDateTo(null)
  }

  return {
    filters,
    filterTodos,
    activeFilterCount,
    setSearch: setSearchQuery,
    setPriority: setPriorityFilter,
    setTag: setTagFilter,
    setCompletion: setCompletionFilter,
    setDateFrom,
    setDateTo,
    clearAllFilters,
  }
}
