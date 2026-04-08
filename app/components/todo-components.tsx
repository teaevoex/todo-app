import type { Priority, RecurrencePattern, Subtask, Tag, Todo } from '@/lib/db'

// --- Extended Todo type with enriched subtask data ---

export interface EnrichedTodo extends Todo {
  subtasks: Subtask[]
  subtask_count: number
  subtask_completed: number
  tags: Tag[]
}

// --- Constants ---

export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

export const PRIORITY_COLORS: Record<Priority, { bg: string; text: string; border: string }> = {
  high: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-800' },
  low: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
}

export const REMINDER_LABELS: Record<number, string> = {
  15: '15m',
  30: '30m',
  60: '1h',
  120: '2h',
  1440: '1d',
  2880: '2d',
  10080: '1w',
}

export const TAG_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280', '#14B8A6',
]

// --- Helpers ---

export function getSingaporeNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' }))
}

export function formatDueDate(dueDate: string): { text: string; color: string } {
  const now = getSingaporeNow()
  const due = new Date(dueDate)
  const diffMs = due.getTime() - now.getTime()
  const diffMinutes = diffMs / (1000 * 60)
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffMs < 0) {
    const absDays = Math.abs(Math.floor(diffDays))
    const absHours = Math.abs(Math.floor(diffHours))
    const absMinutes = Math.abs(Math.floor(diffMinutes))
    if (absDays >= 1) {
      return { text: `${absDays} day${absDays > 1 ? 's' : ''} overdue`, color: 'text-red-600 dark:text-red-400' }
    } else if (absHours >= 1) {
      return { text: `${absHours} hour${absHours > 1 ? 's' : ''} overdue`, color: 'text-red-600 dark:text-red-400' }
    } else {
      return { text: `${absMinutes} minute${absMinutes > 1 ? 's' : ''} overdue`, color: 'text-red-600 dark:text-red-400' }
    }
  } else if (diffMinutes < 60) {
    return { text: `Due in ${Math.round(diffMinutes)} minutes`, color: 'text-red-600 dark:text-red-400' }
  } else if (diffHours < 24) {
    return { text: `Due in ${Math.round(diffHours)} hours`, color: 'text-orange-500 dark:text-orange-400' }
  } else if (diffDays < 7) {
    return { text: `Due in ${Math.round(diffDays)} days`, color: 'text-yellow-600 dark:text-yellow-400' }
  } else {
    const formatted = due.toLocaleDateString('en-SG', {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    return { text: formatted, color: 'text-blue-500 dark:text-blue-400' }
  }
}

export function sortTodos<T extends Todo>(todos: T[]): T[] {
  return [...todos].sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (pDiff !== 0) return pDiff

    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    }
    if (a.due_date) return -1
    if (b.due_date) return 1

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export function classifyTodos<T extends Todo>(todos: T[]) {
  const now = getSingaporeNow()

  const overdue = todos.filter(
    t => !t.completed && t.due_date && new Date(t.due_date) < now
  )
  const pending = todos.filter(
    t => !t.completed && (!t.due_date || new Date(t.due_date) >= now)
  )
  const completed = todos.filter(t => !!t.completed)

  return {
    overdue: sortTodos(overdue),
    pending: sortTodos(pending),
    completed: completed.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
  }
}

// --- Badge Components ---

export function PriorityBadge({ priority }: { priority: Priority }) {
  const colors = PRIORITY_COLORS[priority]
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  )
}

export function RecurrenceBadge({ pattern }: { pattern: RecurrencePattern }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full border bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800">
      🔄 {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
    </span>
  )
}

export function ReminderBadge({ minutes }: { minutes: number }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800">
      🔔 {REMINDER_LABELS[minutes] ?? `${minutes}m`}
    </span>
  )
}

export function ProgressBar({ completed, total }: { completed: number; total: number }) {
  if (total === 0) return null

  const percentage = Math.round((completed / total) * 100)
  const isComplete = percentage === 100

  return (
    <div className="mt-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {completed}/{total} subtasks
        </span>
      </div>
    </div>
  )
}

export function TagBadge({ tag, onClick }: { tag: Tag; onClick?: () => void }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border font-medium${onClick ? ' cursor-pointer hover:opacity-80' : ''}`}
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        borderColor: `${tag.color}40`,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      {tag.name}
    </span>
  )
}

// --- TodoItem Component ---

export function TodoItem({
  todo,
  onToggle,
  onEdit,
  onDelete,
  onTagFilter,
  isExpanded,
  onToggleExpand,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  subtaskTitle,
  onSubtaskTitleChange,
}: {
  todo: EnrichedTodo
  onToggle: (todo: EnrichedTodo) => void
  onEdit: (todo: EnrichedTodo) => void
  onDelete: (id: number) => void
  onTagFilter?: (tagId: number) => void
  isExpanded: boolean
  onToggleExpand: () => void
  onAddSubtask: () => void
  onToggleSubtask: (subtaskId: number, completed: boolean) => void
  onDeleteSubtask: (subtaskId: number) => void
  subtaskTitle: string
  onSubtaskTitleChange: (value: string) => void
}) {
  const dueInfo = todo.due_date ? formatDueDate(todo.due_date) : null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={!!todo.completed}
          onChange={() => onToggle(todo)}
          aria-label={`Mark "${todo.title}" as ${todo.completed ? 'incomplete' : 'complete'}`}
          className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600
                     text-blue-500 focus:ring-blue-500 cursor-pointer"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              data-testid="todo-title"
              className={`text-sm font-medium ${todo.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}
            >
              {todo.title}
            </span>
            <PriorityBadge priority={todo.priority} />
            {todo.is_recurring === 1 && todo.recurrence_pattern && (
              <RecurrenceBadge pattern={todo.recurrence_pattern} />
            )}
            {todo.reminder_minutes != null && (
              <ReminderBadge minutes={todo.reminder_minutes} />
            )}
            {todo.tags.map(tag => (
              <TagBadge key={tag.id} tag={tag} onClick={onTagFilter ? () => onTagFilter(tag.id) : undefined} />
            ))}
          </div>
          {dueInfo && !todo.completed && (
            <p className={`text-xs mt-1 ${dueInfo.color}`}>
              {dueInfo.text}
            </p>
          )}
          {todo.subtask_count > 0 && (
            <ProgressBar completed={todo.subtask_completed} total={todo.subtask_count} />
          )}
        </div>

        <div className="flex gap-1 shrink-0">
          <button
            onClick={onToggleExpand}
            className="text-xs px-2 py-1 rounded border
                       border-gray-300 dark:border-gray-600
                       text-gray-600 dark:text-gray-400
                       hover:bg-gray-100 dark:hover:bg-gray-700
                       transition-colors"
          >
            {isExpanded ? '▼ Subtasks' : '▶ Subtasks'}
          </button>
          <button
            onClick={() => onEdit(todo)}
            className="text-xs px-2 py-1 rounded border
                       border-gray-300 dark:border-gray-600
                       text-gray-600 dark:text-gray-400
                       hover:bg-gray-100 dark:hover:bg-gray-700
                       transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(todo.id)}
            className="text-xs px-2 py-1 rounded border
                       border-red-300 dark:border-red-700
                       text-red-600 dark:text-red-400
                       hover:bg-red-50 dark:hover:bg-red-900/20
                       transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 ml-7 space-y-2">
          {todo.subtasks.map(subtask => (
            <div key={subtask.id} className="flex items-center gap-2 group">
              <input
                type="checkbox"
                checked={!!subtask.completed}
                onChange={() => onToggleSubtask(subtask.id, !subtask.completed)}
                className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600
                           text-blue-500 focus:ring-blue-500 cursor-pointer"
              />
              <span
                className={`text-sm flex-1 ${subtask.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}
              >
                {subtask.title}
              </span>
              <button
                onClick={() => onDeleteSubtask(subtask.id)}
                className="text-xs text-red-500 dark:text-red-400 opacity-0 group-hover:opacity-100
                           hover:text-red-700 dark:hover:text-red-300 transition-opacity px-1"
              >
                ✕
              </button>
            </div>
          ))}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              onAddSubtask()
            }}
            className="flex gap-2 mt-2"
          >
            <input
              type="text"
              value={subtaskTitle}
              onChange={(e) => onSubtaskTitleChange(e.target.value)}
              placeholder="Add subtask..."
              className="flex-1 border rounded-lg px-3 py-1.5 text-sm
                         border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-700
                         text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!subtaskTitle.trim()}
              className="px-3 py-1.5 text-xs rounded-lg bg-blue-500 text-white font-medium
                         hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                         dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
            >
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
