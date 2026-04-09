'use client'

import type { RecurrencePattern } from '@/lib/types'

interface RecurrenceBadgeProps {
  pattern: RecurrencePattern
}

const RECURRENCE_META: Record<RecurrencePattern, { label: string; shortLabel: string }> = {
  daily:   { label: 'Daily',   shortLabel: 'day' },
  weekly:  { label: 'Weekly',  shortLabel: 'wk'  },
  monthly: { label: 'Monthly', shortLabel: 'mo'  },
  yearly:  { label: 'Yearly',  shortLabel: 'yr'  },
}

export function RecurrenceBadge({ pattern }: RecurrenceBadgeProps) {
  const meta = RECURRENCE_META[pattern]

  return (
    <span
      data-testid={`recurrence-badge-${pattern}`}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-recurrence/15 text-recurrence-foreground border-recurrence/30"
      aria-label={`Repeats ${meta.label}`}
      title={`Repeats ${meta.label}`}
    >
      <span aria-hidden="true">🔄</span>
      {meta.shortLabel}
    </span>
  )
}
