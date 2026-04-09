'use client'

import type { RecurrencePattern } from '@/lib/types'

interface RecurrencePatternSelectProps {
  value: RecurrencePattern
  onChange: (pattern: RecurrencePattern) => void
}

export function RecurrencePatternSelect({ value, onChange }: RecurrencePatternSelectProps) {
  return (
    <div>
      <label htmlFor="todo-recurrence-pattern" className="mb-1 block text-xs font-medium text-muted-foreground">
        Repeat every
      </label>
      <select
        id="todo-recurrence-pattern"
        data-testid="todo-recurrence-select"
        value={value}
        onChange={(e) => onChange(e.target.value as RecurrencePattern)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="daily">Day</option>
        <option value="weekly">Week</option>
        <option value="monthly">Month</option>
        <option value="yearly">Year</option>
      </select>
    </div>
  )
}
