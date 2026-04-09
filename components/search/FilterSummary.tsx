'use client'

import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { FilterState, Tag } from '@/lib/types'

interface FilterChip {
  key: keyof FilterState
  label: string
}

interface FilterSummaryProps {
  filterState: FilterState
  tags: Tag[]
  onRemoveFilter: (key: keyof FilterState) => void
  onClearAll: () => void
}

export function FilterSummary({
  filterState,
  tags,
  onRemoveFilter,
  onClearAll,
}: FilterSummaryProps) {
  const chips: FilterChip[] = []

  if (filterState.searchQuery) {
    chips.push({ key: 'searchQuery', label: `Search: ${filterState.searchQuery}` })
  }

  if (filterState.priorityFilter !== 'all') {
    const label =
      filterState.priorityFilter.charAt(0).toUpperCase() +
      filterState.priorityFilter.slice(1)
    chips.push({ key: 'priorityFilter', label: `Priority: ${label}` })
  }

  if (filterState.tagFilter !== 'all') {
    const tag = tags.find((t) => t.id === filterState.tagFilter)
    const tagName = tag ? tag.name : String(filterState.tagFilter)
    chips.push({ key: 'tagFilter', label: `Tag: ${tagName}` })
  }

  if (filterState.completionFilter !== 'all') {
    const label =
      filterState.completionFilter === 'completed' ? 'Completed' : 'Active'
    chips.push({ key: 'completionFilter', label: `Status: ${label}` })
  }

  if (filterState.dateFrom) {
    chips.push({ key: 'dateFrom', label: `From: ${filterState.dateFrom}` })
  }

  if (filterState.dateTo) {
    chips.push({ key: 'dateTo', label: `To: ${filterState.dateTo}` })
  }

  if (chips.length === 0) return null

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Active filters"
      data-testid="filter-summary"
    >
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 text-xs rounded-full pr-1"
          data-testid={`filter-chip-${chip.key}`}
        >
          {chip.label}
          <button
            type="button"
            className="ml-1 hover:text-foreground transition-colors inline-flex items-center"
            aria-label={`Remove ${chip.label} filter`}
            onClick={() => onRemoveFilter(chip.key)}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
        data-testid="clear-all-filters"
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  )
}
