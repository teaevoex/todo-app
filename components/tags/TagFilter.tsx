'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Tag } from '@/lib/types'

interface TagFilterProps {
  tags: Tag[]
  value: number | 'all'
  onChange: (value: number | 'all') => void
}

export function TagFilter({ tags, value, onChange }: TagFilterProps) {
  function handleChange(raw: string) {
    if (raw === 'all') {
      onChange('all')
    } else {
      onChange(parseInt(raw, 10))
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="tag-filter"
        className="text-xs font-medium text-muted-foreground whitespace-nowrap"
      >
        Filter by tag
      </label>
      <Select
        value={String(value)}
        onValueChange={handleChange}
      >
        <SelectTrigger
          id="tag-filter"
          data-testid="tag-filter"
          aria-label="Filter by tag"
          className="h-7 text-xs min-w-[120px]"
        >
          <SelectValue placeholder="All tags" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All tags</SelectItem>
          {tags.map((tag) => (
            <SelectItem key={tag.id} value={String(tag.id)}>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
