'use client'

import { SearchBar } from './SearchBar'
import { CompletionFilter } from './CompletionFilter'
import { ClearFiltersButton } from './ClearFiltersButton'
import { PriorityFilter } from '@/components/todos/PriorityFilter'
import { TagFilter } from '@/components/tags/TagFilter'
import type { FilterState, Priority, Tag } from '@/lib/types'
import type { PriorityFilterValue } from '@/components/todos/PriorityFilter'

interface FilterBarProps {
  filterState: FilterState
  tags: Tag[]
  activeFilterCount: number
  onSearchChange: (q: string) => void
  onPriorityChange: (p: Priority | 'all') => void
  onTagChange: (tagId: number | 'all') => void
  onCompletionChange: (c: 'all' | 'completed' | 'incomplete') => void
  onClearAll: () => void
}

export function FilterBar({
  filterState,
  tags,
  activeFilterCount,
  onSearchChange,
  onPriorityChange,
  onTagChange,
  onCompletionChange,
  onClearAll,
}: FilterBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Filter todos"
      data-testid="filter-bar"
      className="flex flex-wrap items-center gap-2"
    >
      <SearchBar value={filterState.searchQuery} onChange={onSearchChange} />

      <PriorityFilter
        value={filterState.priorityFilter as PriorityFilterValue}
        onChange={(v) => onPriorityChange(v as Priority | 'all')}
      />

      {tags.length > 0 && (
        <TagFilter
          tags={tags}
          value={filterState.tagFilter}
          onChange={onTagChange}
        />
      )}

      <CompletionFilter
        value={filterState.completionFilter}
        onChange={onCompletionChange}
      />

      {activeFilterCount > 0 && (
        <ClearFiltersButton onClick={onClearAll} />
      )}
    </div>
  )
}
