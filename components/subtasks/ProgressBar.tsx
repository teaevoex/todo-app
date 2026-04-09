'use client'

import { calculateProgress } from '@/lib/utils/progress'

interface ProgressBarProps {
  completed: number
  total: number
  todoId?: number
}

export function ProgressBar({ completed, total, todoId }: ProgressBarProps) {
  if (total === 0) return null

  const percent = calculateProgress(completed, total)
  const fillColor = percent === 100 ? 'hsl(var(--success))' : 'hsl(var(--primary))'
  const testId = todoId !== undefined ? `progress-bar-${todoId}` : 'progress-bar'

  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Subtask progress"
        data-testid={testId}
        className="flex-1 h-2 rounded-full bg-muted overflow-hidden"
      >
        <div
          data-testid="progress-bar-fill"
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percent}%`, backgroundColor: fillColor }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {completed}/{total} completed ({percent}%)
      </span>
    </div>
  )
}
