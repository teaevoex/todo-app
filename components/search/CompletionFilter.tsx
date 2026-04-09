'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type CompletionFilter = 'all' | 'completed' | 'incomplete'

interface CompletionFilterProps {
  value: CompletionFilter
  onChange: (value: CompletionFilter) => void
}

export function CompletionFilter({ value, onChange }: CompletionFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="completion-filter"
        className="text-xs font-medium text-muted-foreground whitespace-nowrap"
      >
        Status
      </label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as CompletionFilter)}
      >
        <SelectTrigger
          id="completion-filter"
          data-testid="completion-filter"
          aria-label="Filter by completion status"
          className="h-7 text-xs min-w-[110px]"
        >
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="incomplete">Active</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
