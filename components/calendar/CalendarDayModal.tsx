'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CalendarDay, CalendarTodo } from '@/lib/calendar'

interface CalendarDayModalProps {
  day: CalendarDay | null
  open: boolean
  onClose: () => void
}

interface CalendarTodoItemProps {
  todo: CalendarTodo
}

function CalendarTodoItem({ todo }: CalendarTodoItemProps) {
  const priorityVariant = {
    high: 'destructive',
    medium: 'secondary',
    low: 'outline',
  } as const

  return (
    <div
      className="flex items-center gap-3 py-2 border-b border-border last:border-0"
      data-testid={`calendar-todo-item-${todo.id}`}
    >
      {/* Completion indicator */}
      <span
        className={cn(
          'flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center',
          todo.completed
            ? 'bg-primary border-primary'
            : 'border-muted-foreground'
        )}
        aria-hidden="true"
      >
        {todo.completed && (
          <svg
            className="w-2.5 h-2.5 text-primary-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>

      {/* Title */}
      <span
        className={cn('flex-1 text-sm', {
          'text-muted-foreground line-through': todo.completed,
          'text-foreground': !todo.completed,
        })}
      >
        {todo.title}
      </span>

      {/* Priority badge */}
      <Badge
        variant={priorityVariant[todo.priority]}
        className="capitalize text-xs"
      >
        {todo.priority}
      </Badge>
    </div>
  )
}

export function CalendarDayModal({ day, open, onClose }: CalendarDayModalProps) {
  if (!day) return null

  const formattedDate = new Intl.DateTimeFormat('en-SG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  }).format(new Date(day.date + 'T00:00:00+08:00'))

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-[480px]"
        data-testid="calendar-day-modal"
      >
        <DialogHeader>
          <DialogTitle>{formattedDate}</DialogTitle>
        </DialogHeader>

        {/* Holiday callout */}
        {day.holidays.length > 0 && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {day.holidays.map((h) => (
              <p key={`${h.id}-${h.date}`} className="font-medium">
                {h.name}
              </p>
            ))}
          </div>
        )}

        {/* Todo list */}
        <div className="min-h-[60px]">
          {day.todos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No todos due on this day.
            </p>
          ) : (
            <div>
              {day.todos.map((todo) => (
                <CalendarTodoItem key={todo.id} todo={todo} />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="calendar-modal-close-btn"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
