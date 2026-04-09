'use client'

import type { Subtask } from '@/lib/types'

interface SubtaskItemProps {
  subtask: Subtask
  onToggle: (id: number, completed: boolean) => void
  onDelete: (id: number) => void
}

export function SubtaskItem({ subtask, onToggle, onDelete }: SubtaskItemProps) {
  return (
    <li
      data-testid={`subtask-item-${subtask.id}`}
      className="flex items-center gap-2 py-1"
      style={{ minHeight: '2rem' }}
    >
      <input
        type="checkbox"
        checked={subtask.completed}
        onChange={() => onToggle(subtask.id, !subtask.completed)}
        data-testid={`subtask-checkbox-${subtask.id}`}
        aria-label={`Complete subtask: ${subtask.title}`}
        className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-ring/20 focus:ring-offset-0 cursor-pointer"
      />
      <span
        className={`flex-1 text-sm truncate ${
          subtask.completed
            ? 'line-through text-muted-foreground'
            : 'text-foreground'
        }`}
        title={subtask.title}
      >
        {subtask.title}
      </span>
      <button
        onClick={() => onDelete(subtask.id)}
        data-testid={`subtask-delete-${subtask.id}`}
        aria-label={`Delete subtask: ${subtask.title}`}
        className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </li>
  )
}
