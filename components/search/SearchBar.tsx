'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative flex-1 min-w-[200px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4 pointer-events-none" />
      <Input
        type="search"
        className="pl-9 h-9 pr-9"
        placeholder="Search todos and tags…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search todos"
        role="searchbox"
        data-testid="search-bar"
      />
      {value.length > 0 && (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onChange('')}
          aria-label="Clear search"
          data-testid="search-clear"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
