'use client'

import { CalendarDay } from './CalendarDay'
import type { CalendarMonth, CalendarDay as CalendarDayType } from '@/lib/calendar'

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

interface CalendarGridProps {
  calendarMonth: CalendarMonth
  onDayClick: (day: CalendarDayType) => void
}

export function CalendarGrid({ calendarMonth, onDayClick }: CalendarGridProps) {
  const { year, month, weeks } = calendarMonth

  const caption = new Intl.DateTimeFormat('en-SG', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  }).format(new Date(Date.UTC(year, month - 1, 1)))

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-background">
      <table
        role="grid"
        className="w-full border-collapse"
        data-testid="calendar-grid"
      >
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {WEEKDAY_HEADERS.map((day) => (
              <th
                key={day}
                scope="col"
                className="border-b border-r border-border bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide last:border-r-0"
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((day) => (
                <CalendarDay
                  key={day.date}
                  day={day}
                  onClick={onDayClick}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
