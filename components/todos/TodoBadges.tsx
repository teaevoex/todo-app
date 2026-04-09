'use client'

import { PriorityBadge } from './PriorityBadge'
import { RecurrenceBadge } from './RecurrenceBadge'
import { ReminderBadge } from './ReminderBadge'
import { TagBadge } from '@/components/tags/TagBadge'
import type { Todo, TodoWithRelations, ReminderMinutes } from '@/lib/types'

const MAX_VISIBLE_TAGS = 5

interface TodoBadgesProps {
  todo: Todo | TodoWithRelations
  onTagClick?: (tagId: number) => void
}

export function TodoBadges({ todo, onTagClick }: TodoBadgesProps) {
  const tags = 'tags' in todo ? (todo.tags ?? []) : []
  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS)
  const extraCount = tags.length - MAX_VISIBLE_TAGS

  return (
    <div
      data-testid={`todo-badges-${todo.id}`}
      className="flex flex-wrap items-center gap-1"
    >
      <PriorityBadge priority={todo.priority} />

      {todo.is_recurring && todo.recurrence_pattern && (
        <RecurrenceBadge pattern={todo.recurrence_pattern} />
      )}

      {todo.reminder_minutes != null && (
        <ReminderBadge reminderMinutes={todo.reminder_minutes as ReminderMinutes} />
      )}

      {visibleTags.map((tag) => (
        <TagBadge
          key={tag.id}
          tag={tag}
          onClick={onTagClick ? () => onTagClick(tag.id) : undefined}
        />
      ))}

      {extraCount > 0 && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border">
          +{extraCount} more
        </span>
      )}
    </div>
  )
}
