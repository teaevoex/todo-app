'use client'

interface HolidayBadgeProps {
  name: string
}

export function HolidayBadge({ name }: HolidayBadgeProps) {
  return (
    <span
      className="block truncate text-xs text-destructive leading-tight"
      aria-label={`Public holiday: ${name}`}
      data-testid="holiday-badge"
      title={name}
    >
      {name}
    </span>
  )
}
