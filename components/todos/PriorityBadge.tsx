'use client'

import { cn } from '@/lib/utils'
import type { Priority } from '@/lib/types'

interface PriorityMeta {
  label: string
  className: string
}

const PRIORITY_META: Record<Priority, PriorityMeta> = {
  high: {
    label: 'High',
    className: 'bg-priority-high/15 text-priority-high-foreground border-priority-high/30',
  },
  medium: {
    label: 'Medium',
    className: 'bg-priority-medium/15 text-priority-medium-foreground border-priority-medium/30',
  },
  low: {
    label: 'Low',
    className: 'bg-priority-low/15 text-priority-low-foreground border-priority-low/30',
  },
}

interface PriorityBadgeProps {
  priority: Priority
  size?: 'sm' | 'md'
}

export function PriorityBadge({ priority, size = 'sm' }: PriorityBadgeProps) {
  const meta = PRIORITY_META[priority]

  return (
    <span
      data-testid={`priority-badge-${priority}`}
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 font-medium',
        size === 'sm' ? 'text-xs' : 'text-sm',
        meta.className
      )}
      aria-label={`Priority: ${meta.label}`}
    >
      {meta.label}
    </span>
  )
}
