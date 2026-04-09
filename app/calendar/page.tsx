'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Todo, Priority, Tag, Holiday } from '@/lib/db'

interface EnrichedTodo extends Todo {
  subtasks: { id: number; title: string; completed: number; position: number }[]
  subtask_count: number
  subtask_completed: number
  tags: Tag[]
}

// --- Helper Functions ---

function getSingaporeToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
}

function getSingaporeNowDate(): Date {
  const str = new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' })
  return new Date(str)
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getDotColor(todo: EnrichedTodo, today: string): string {
  if (todo.completed) return 'bg-green-400'
  if (todo.due_date && todo.due_date < today) return 'bg-red-400'
  switch (todo.priority) {
    case 'high': return 'bg-red-500'
    case 'medium': return 'bg-yellow-500'
    case 'low': return 'bg-blue-500'
    default: return 'bg-gray-400'
  }
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const colors: Record<Priority, string> = {
    high: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    medium: 'bg-amber-50 text-amber-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    low: 'bg-sky-50 text-sky-600 dark:bg-blue-900/30 dark:text-blue-400',
  }
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide ${colors[priority]}`}>
      {priority}
    </span>
  )
}

function TagBadge({ tag }: { tag: Tag }) {
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded-full font-medium text-white"
      style={{ backgroundColor: tag.color }}
    >
      {tag.name}
    </span>
  )
}

// --- Main Component ---

export default function CalendarPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Loading calendar...</p></div>}>
      <CalendarPage />
    </Suspense>
  )
}

function CalendarPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [currentDate, setCurrentDate] = useState(() => {
    const monthParam = searchParams.get('month')
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number)
      if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) {
        return new Date(y, m - 1, 1)
      }
    }
    return getSingaporeNowDate()
  })
  const [todos, setTodos] = useState<EnrichedTodo[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionUsername, setSessionUsername] = useState('')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.username) setSessionUsername(data.username) })
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const fetchCalendarData = useCallback(async () => {
    const res = await fetch(`/api/calendar?year=${year}&month=${month}`)
    if (res.ok) {
      const data = await res.json()
      setTodos(data.todos)
      setHolidays(data.holidays)
    }
    setLoading(false)
  }, [year, month])

  useEffect(() => {
    fetchCalendarData()
  }, [fetchCalendarData])

  // Sync URL when month changes
  useEffect(() => {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    router.replace(`/calendar?month=${monthStr}`, { scroll: false })
  }, [year, month, router])

  const today = getSingaporeToday()

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  function handlePrevMonth() {
    setCurrentDate(prev => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() - 1)
      return d
    })
    setSelectedDate(null)
  }

  function handleNextMonth() {
    setCurrentDate(prev => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() + 1)
      return d
    })
    setSelectedDate(null)
  }

  function handleGoToToday() {
    setCurrentDate(getSingaporeNowDate())
    setSelectedDate(getSingaporeToday())
  }

  function todosForDate(date: string): EnrichedTodo[] {
    return todos.filter(t => t.due_date?.substring(0, 10) === date)
  }

  function holidayForDate(date: string): Holiday | undefined {
    return holidays.find(h => h.date === date)
  }

  async function handleToggleComplete(todoId: number, completed: boolean) {
    await fetch(`/api/todos/${todoId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    })
    await fetchCalendarData()
  }

  // Build calendar grid
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(day)
  }

  // Group todos by date
  const todosByDate: Record<string, EnrichedTodo[]> = {}
  for (const todo of todos) {
    if (todo.due_date) {
      const key = todo.due_date.substring(0, 10)
      todosByDate[key] = [...(todosByDate[key] || []), todo]
    }
  }

  // Group holidays by date
  const holidaysByDate: Record<string, Holiday> = {}
  for (const holiday of holidays) {
    holidaysByDate[holiday.date] = holiday
  }

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Navigation */}
      <nav className="mb-4 flex items-center justify-between">
        <a
          href="/"
          className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium transition-colors"
        >
          ← Back to Todos
        </a>
        <div className="flex items-center gap-2">
          {sessionUsername && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {sessionUsername}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded-xl border
                       border-gray-200 text-gray-600 hover:bg-gray-100
                       dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700
                       transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          {monthNames[month - 1]} {year}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-100
                       dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white transition-colors"
          >
            ←
          </button>
          <button
            onClick={handleGoToToday}
            className="px-3 py-1.5 rounded-xl text-sm font-medium text-white
                       bg-gradient-to-r from-indigo-500 to-purple-500
                       hover:from-indigo-600 hover:to-purple-600
                       shadow-md shadow-indigo-500/25 transition-all"
          >
            Today
          </button>
          <button
            onClick={handleNextMonth}
            aria-label="Next month"
            className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-100
                       dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white transition-colors"
          >
            →
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-2xl overflow-hidden border border-gray-200/60 dark:border-gray-600 shadow-sm">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800">
          {weekdays.map(day => (
            <div
              key={day}
              className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, index) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-[80px] border-t border-r border-gray-200 bg-gray-50
                             dark:border-gray-700 dark:bg-gray-900/50 last:border-r-0"
                />
              )
            }

            const dateStr = toDateString(year, month, day)
            const dateTodos = todosByDate[dateStr] || []
            const holiday = holidaysByDate[dateStr]
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate

            return (
              <div
                key={dateStr}
                data-date={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`min-h-[80px] border-t border-r border-gray-200 dark:border-gray-700
                           p-1 cursor-pointer transition-colors
                           ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                           ${holiday && !isToday ? 'bg-red-50 dark:bg-red-900/10' : ''}
                           ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
                           hover:bg-gray-50 dark:hover:bg-gray-800`}
              >
                {/* Day Number */}
                <div className={`text-sm font-medium mb-1
                  ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                  {day}
                </div>

                {/* Holiday Name */}
                {holiday && (
                  <div className="text-[10px] text-red-500 dark:text-red-400 truncate mb-1" title={holiday.name}>
                    {holiday.name}
                  </div>
                )}

                {/* Todo Dots */}
                {dateTodos.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 items-center">
                    {dateTodos.slice(0, 5).map(todo => (
                      <span
                        key={todo.id}
                        className={`w-2 h-2 rounded-full ${getDotColor(todo, today)}`}
                        title={todo.title}
                        data-testid="todo-dot"
                      />
                    ))}
                    {dateTodos.length > 5 && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        +{dateTodos.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Date Detail Panel */}
      {selectedDate && (
        <DateDetailPanel
          date={selectedDate}
          todos={todosForDate(selectedDate)}
          holiday={holidayForDate(selectedDate)}
          today={today}
          onToggleComplete={handleToggleComplete}
        />
      )}
    </div>
  )
}

// --- Date Detail Panel ---

function DateDetailPanel({
  date,
  todos,
  holiday,
  today,
  onToggleComplete,
}: {
  date: string
  todos: EnrichedTodo[]
  holiday: Holiday | undefined
  today: string
  onToggleComplete: (todoId: number, completed: boolean) => void
}) {
  const isOverdue = date < today

  const displayDate = new Date(date + 'T00:00:00+08:00').toLocaleDateString('en-SG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mt-6 glass-card rounded-2xl p-4">
      <h2 className="text-lg font-bold mb-3 dark:text-white">{displayDate}</h2>

      {holiday && (
        <div className="mb-3 px-3 py-2 bg-red-50/60 dark:bg-red-900/20 rounded-xl text-sm text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30">
          🎉 {holiday.name}
        </div>
      )}

      {todos.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">No todos due on this date</p>
      ) : (
        <ul className="space-y-2">
          {todos.map(todo => (
            <li
              key={todo.id}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/40 dark:hover:bg-gray-700/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={!!todo.completed}
                onChange={() => onToggleComplete(todo.id, !todo.completed)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600
                           text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${
                  todo.completed
                    ? 'line-through text-gray-400 dark:text-gray-500'
                    : isOverdue
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-900 dark:text-white'
                }`}>
                  {todo.title}
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  <PriorityBadge priority={todo.priority} />
                  {todo.tags.map(tag => (
                    <TagBadge key={tag.id} tag={tag} />
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
