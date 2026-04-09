'use client'

import { cn } from '@/lib/utils'
import { HolidayBadge } from './HolidayBadge'
import type { CalendarDay as CalendarDayType } from '@/lib/calendar'

interface CalendarDayProps {
  day: CalendarDayType
  onClick: (day: CalendarDayType) => void
}

export function CalendarDay({ day, onClick }: CalendarDayProps) {
  const { date, dayOfMonth, isCurrentMonth, isToday, isWeekend, todos, holidays } = day

  const todoCount = todos.length
  const holidayNames = holidays.map((h) => h.name).join(', ')
  const ariaLabel = [
    new Intl.DateTimeFormat('en-SG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Singapore',
    }).format(new Date(date + 'T00:00:00+08:00')),
    todoCount > 0 ? `${todoCount} todo${todoCount === 1 ? '' : 's'}` : null,
    holidayNames || null,
  ]
    .filter(Boolean)
    .join(': ')

  const cellClass = cn(
    'relative min-h-[80px] p-1 text-sm cursor-pointer border-b border-r border-border transition-colors',
    {
      'bg-primary text-primary-foreground': isToday,
      'bg-muted text-muted-foreground': isWeekend && !isToday,
      'bg-background text-muted-foreground/40': !isCurrentMonth && !isToday,
      'bg-card text-card-foreground hover:bg-accent': isCurrentMonth && !isToday && !isWeekend,
      'hover:bg-accent/70': isWeekend && !isToday,
    }
  )

  return (
    <td
      role="gridcell"
      className="p-0"
      data-testid={`calendar-day-${date}`}
    >
      <button
        type="button"
        className={cellClass + ' w-full h-full text-left'}
        onClick={() => onClick(day)}
        aria-label={ariaLabel}
        aria-current={isToday ? 'date' : undefined}
      >
        {/* Day number + todo count badge */}
        <div className="flex items-start justify-between">
          <span
            className={cn('font-medium text-sm leading-none', {
              'text-primary-foreground': isToday,
            })}
          >
            {dayOfMonth}
          </span>
          {todoCount > 0 && (
            <span
              className={cn(
                'inline-flex items-center justify-center rounded-full text-xs leading-none px-1.5 py-0.5',
                isToday
                  ? 'bg-primary-foreground text-primary'
                  : 'bg-primary text-primary-foreground'
              )}
              data-testid={`todo-count-badge-${date}`}
            >
              {todoCount}
            </span>
          )}
        </div>

        {/* Holiday badges */}
        <div className="mt-1 space-y-0.5">
          {holidays.map((holiday) => (
            <HolidayBadge key={`${holiday.id}-${holiday.date}`} name={holiday.name} />
          ))}
        </div>
      </button>
    </td>
  )
}
