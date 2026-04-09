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
  high: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
  medium: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  low: { bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-800' },
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
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${colors.bg} ${colors.text} ${colors.border} uppercase tracking-wide`}>
      {priority}
    </span>
  )
}

export function RecurrenceBadge({ pattern }: { pattern: RecurrencePattern }) {
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md border bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800 uppercase tracking-wide">
      🔄 {pattern}
    </span>
  )
}

export function ReminderBadge({ minutes }: { minutes: number }) {
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md border bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 uppercase tracking-wide">
      🔔 {REMINDER_LABELS[minutes] ?? `${minutes}m`}
    </span>
  )
}

export function ProgressBar({ completed, total }: { completed: number; total: number }) {
  if (total === 0) return null

  const percentage = Math.round((completed / total) * 100)
  const isComplete = percentage === 100

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${isComplete ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-indigo-400 to-purple-500'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap tabular-nums">
          {completed}/{total}
        </span>
      </div>
    </div>
  )
}

export function TagBadge({ tag, onClick }: { tag: Tag; onClick?: () => void }) {
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border${onClick ? ' cursor-pointer hover:opacity-75 hover:shadow-sm' : ''}`}
      style={{
        backgroundColor: `${tag.color}15`,
        color: tag.color,
        borderColor: `${tag.color}30`,
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
    <div className="glass-card rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all stagger-item animate-fade-in">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={!!todo.completed}
          onChange={() => onToggle(todo)}
          aria-label={`Mark "${todo.title}" as ${todo.completed ? 'incomplete' : 'complete'}`}
          className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600
                     cursor-pointer"
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

        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={onToggleExpand}
            className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg
                       text-gray-500 dark:text-gray-400
                       hover:bg-gray-100 dark:hover:bg-gray-700/50
                       transition-all"
          >
            {isExpanded ? '▼ Subtasks' : '▶ Subtasks'}
          </button>
          <button
            onClick={() => onEdit(todo)}
            className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg
                       text-gray-500 dark:text-gray-400
                       hover:bg-gray-100 dark:hover:bg-gray-700/50
                       transition-all"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(todo.id)}
            className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg
                       text-red-400 dark:text-red-400
                       hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600
                       transition-all"
          >
            Delete
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 ml-7 space-y-1.5 animate-fade-in">
          {todo.subtasks.map(subtask => (
            <div key={subtask.id} className="flex items-center gap-2 group py-1 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <input
                type="checkbox"
                checked={!!subtask.completed}
                onChange={() => onToggleSubtask(subtask.id, !subtask.completed)}
                className="h-3.5 w-3.5 rounded border-gray-300 dark:border-gray-600
                           cursor-pointer"
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
                         border-gray-200 dark:border-gray-600
                         bg-white/60 dark:bg-gray-800/60
                         text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
            <button
              type="submit"
              disabled={!subtaskTitle.trim()}
              className="px-3 py-1.5 text-xs rounded-lg font-semibold
                         bg-indigo-500 text-white
                         hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed
                         dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-all"
            >
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
