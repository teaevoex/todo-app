'use client'

import { Badge } from '@/components/ui/badge'
import { REMINDER_OPTIONS } from '@/lib/types'
import type { ReminderMinutes } from '@/lib/types'

interface ReminderBadgeProps {
  reminderMinutes: ReminderMinutes
}

export function ReminderBadge({ reminderMinutes }: ReminderBadgeProps) {
  const label = REMINDER_OPTIONS.find((o) => o.value === reminderMinutes)?.label ?? 'Reminder set'

  return (
    <Badge
      data-testid="reminder-badge"
      variant="outline"
      className="gap-1 text-xs font-medium bg-reminder/15 text-reminder-foreground border-reminder/30"
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">🔔</span>
    </Badge>
  )
}
