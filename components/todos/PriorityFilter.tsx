'use client'

import type { Priority } from '@/lib/types'

export type PriorityFilterValue = Priority | 'all'

interface PriorityFilterProps {
  value: PriorityFilterValue
  onChange: (value: PriorityFilterValue) => void
}

export function PriorityFilter({ value, onChange }: PriorityFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="priority-filter"
        className="text-xs font-medium text-muted-foreground whitespace-nowrap"
      >
        Filter by priority
      </label>
      <select
        id="priority-filter"
        data-testid="priority-filter"
        value={value}
        onChange={(e) => onChange(e.target.value as PriorityFilterValue)}
        className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="all">All priorities</option>
        <option value="high">High only</option>
        <option value="medium">Medium only</option>
        <option value="low">Low only</option>
      </select>
    </div>
  )
}
