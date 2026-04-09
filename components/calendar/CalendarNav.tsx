'use client'

import { Button } from '@/components/ui/button'

interface CalendarNavProps {
  currentMonth: string   // 'YYYY-MM'
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function CalendarNav({
  currentMonth,
  onPrev,
  onNext,
  onToday,
}: CalendarNavProps) {
  const [yearStr, monthStr] = currentMonth.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  const monthLabel = new Intl.DateTimeFormat('en-SG', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  }).format(new Date(Date.UTC(year, month - 1, 1)))

  return (
    <div
      className="flex items-center justify-between gap-2 mb-4"
      data-testid="calendar-nav"
    >
      <div className="flex items-center gap-2">
        <Button
          onClick={onPrev}
          variant="outline"
          size="sm"
          aria-label="Previous month"
          data-testid="calendar-prev-btn"
        >
          ‹
        </Button>
        <span
          className="text-foreground font-semibold text-lg min-w-[160px] text-center"
          data-testid="calendar-month-label"
        >
          {monthLabel}
        </span>
        <Button
          onClick={onNext}
          variant="outline"
          size="sm"
          aria-label="Next month"
          data-testid="calendar-next-btn"
        >
          ›
        </Button>
      </div>
      <Button
        onClick={onToday}
        variant="default"
        size="sm"
        aria-label="Go to current month"
        data-testid="calendar-today-btn"
      >
        Today
      </Button>
    </div>
  )
}
