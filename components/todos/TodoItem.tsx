'use client'

import { useState } from 'react'
import { getSingaporeNow, formatSingaporeDate } from '@/lib/timezone'
import { TodoBadges } from './TodoBadges'
import { SubtaskList } from '@/components/subtasks/SubtaskList'
import { ProgressBar } from '@/components/subtasks/ProgressBar'
import type { TodoWithRelations } from '@/lib/types'

interface TodoItemProps {
  todo: TodoWithRelations
  onToggle: (id: number, completed: boolean) => void
  onEdit: (todo: TodoWithRelations) => void
  onDelete: (id: number) => void
  onTagClick?: (tagId: number) => void
  onSaveAsTemplate?: (todo: TodoWithRelations) => void
}

function getDueDateDisplay(dueDate: string | null): { label: string; colorClass: string } | null {
  if (!dueDate) return null

  const now = getSingaporeNow()
  const due = new Date(dueDate)
  const diffMs = due.getTime() - now.getTime()

  if (diffMs < 0) {
    const absMs = Math.abs(diffMs)
    const hours = Math.floor(absMs / 3_600_000)
    const mins = Math.floor((absMs % 3_600_000) / 60_000)
    const label = hours > 0 ? `${hours}h overdue` : `${mins}m overdue`
    return { label, colorClass: 'text-destructive' }
  }

  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000)
    return { label: `in ${mins}m`, colorClass: 'text-destructive' }
  }

  if (diffMs < 86_400_000) {
    const hours = Math.floor(diffMs / 3_600_000)
    return { label: `in ${hours}h`, colorClass: 'text-warning' }
  }

  if (diffMs < 604_800_000) {
    const days = Math.floor(diffMs / 86_400_000)
    return { label: `in ${days}d`, colorClass: 'text-info' }
  }

  return {
    label: formatSingaporeDate(dueDate, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    colorClass: 'text-info',
  }
}

export function TodoItem({ todo, onToggle, onEdit, onDelete, onTagClick, onSaveAsTemplate }: TodoItemProps) {
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false)
  const dueDateDisplay = getDueDateDisplay(todo.due_date)
  const subtasks = todo.subtasks ?? []
  const completedCount = subtasks.filter((s) => s.completed).length

  return (
    <div
      data-testid={`todo-item-${todo.id}`}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo.id, !todo.completed)}
          data-testid={`todo-checkbox-${todo.id}`}
          aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'}
          className="h-4 w-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
        />

        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <span
            className={
              todo.completed
                ? 'line-through text-muted-foreground text-sm'
                : 'text-foreground text-sm font-medium'
            }
          >
            {todo.title}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <TodoBadges todo={todo} onTagClick={onTagClick} />
            {dueDateDisplay && (
              <span className={`text-xs ${dueDateDisplay.colorClass}`}>
                {dueDateDisplay.label}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onSaveAsTemplate && (
            <button
              onClick={() => onSaveAsTemplate(todo)}
              data-testid={`save-as-template-${todo.id}`}
              aria-label="Save as template"
              title="Save as template"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
            </button>
          )}

          <button
            onClick={() => onEdit(todo)}
            data-testid={`todo-edit-${todo.id}`}
            aria-label="Edit todo"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>

          <button
            onClick={() => onDelete(todo.id)}
            data-testid={`todo-delete-${todo.id}`}
            aria-label="Delete todo"
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {subtasks.length > 0 && !isSubtasksExpanded && (
        <div className="pl-7">
          <ProgressBar
            completed={completedCount}
            total={subtasks.length}
            todoId={todo.id}
          />
        </div>
      )}

      <div className="pl-7">
        <SubtaskList
          todoId={todo.id}
          subtasks={subtasks}
          isExpanded={isSubtasksExpanded}
          onToggleExpand={() => setIsSubtasksExpanded((prev) => !prev)}
          todoTitle={todo.title}
        />
      </div>
    </div>
  )
}
