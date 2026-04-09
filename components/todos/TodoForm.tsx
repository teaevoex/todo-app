'use client'

import { useState } from 'react'
import { getSingaporeNow } from '@/lib/timezone'
import { Button } from '@/components/ui/button'
import { RecurrenceCheckbox } from './RecurrenceCheckbox'
import { RecurrencePatternSelect } from './RecurrencePatternSelect'
import { ReminderSelect } from './ReminderSelect'
import { TagSelector } from '@/components/tags/TagSelector'
import { useTags } from '@/lib/hooks/useTags'
import type { CreateTodoDto, Priority, RecurrencePattern, ReminderMinutes } from '@/lib/types'

interface TodoFormProps {
  onSubmit: (dto: CreateTodoDto) => void
  isLoading?: boolean
}

interface FormErrors {
  title?: string
  dueDate?: string
}

export function TodoForm({ onSubmit, isLoading }: TodoFormProps) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('weekly')
  const [reminderMinutes, setReminderMinutes] = useState<ReminderMinutes | null>(null)
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const { tags } = useTags()

  function handleDueDateChange(value: string) {
    setDueDate(value)
    if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: undefined }))
    if (!value) {
      if (isRecurring) setIsRecurring(false)
      if (reminderMinutes !== null) setReminderMinutes(null)
    }
  }

  function validate(): boolean {
    const newErrors: FormErrors = {}

    if (!title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (dueDate) {
      const dueDateObj = new Date(dueDate)
      const nowPlus60 = new Date(getSingaporeNow().getTime() + 60_000)
      if (isNaN(dueDateObj.getTime()) || dueDateObj < nowPlus60) {
        newErrors.dueDate = 'Due date must be at least 1 minute in the future'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!validate()) return

    const dto: CreateTodoDto = {
      title: title.trim(),
      priority,
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern : null,
      reminder_minutes: dueDate ? reminderMinutes : null,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    }

    if (dueDate) {
      dto.due_date = new Date(dueDate).toISOString()
    }

    onSubmit(dto)
    setTitle('')
    setDueDate('')
    setPriority('medium')
    setIsRecurring(false)
    setRecurrencePattern('weekly')
    setReminderMinutes(null)
    setSelectedTagIds([])
    setErrors({})
  }

  return (
    <form
      data-testid="todo-form"
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="todo-title" className="sr-only">
            Todo title
          </label>
          <input
            id="todo-title"
            data-testid="todo-title-input"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }))
            }}
            placeholder="What needs to be done?"
            maxLength={500}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {errors.title && (
            <p role="alert" aria-live="polite" className="mt-1 text-xs text-destructive">
              {errors.title}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-40">
            <label htmlFor="todo-priority" className="mb-1 block text-xs font-medium text-muted-foreground">
              Priority
            </label>
            <select
              id="todo-priority"
              data-testid="todo-priority-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex-1 min-w-52">
            <label htmlFor="todo-due-date" className="mb-1 block text-xs font-medium text-muted-foreground">
              Due date (optional)
            </label>
            <input
              id="todo-due-date"
              data-testid="todo-due-date"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => handleDueDateChange(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {errors.dueDate && (
              <p role="alert" aria-live="polite" className="mt-1 text-xs text-destructive">
                {errors.dueDate}
              </p>
            )}
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              data-testid="todo-submit-btn"
              disabled={isLoading}
              aria-busy={isLoading}
            >
              {isLoading ? 'Adding...' : 'Add Todo'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <ReminderSelect
            value={reminderMinutes}
            onChange={setReminderMinutes}
            disabled={!dueDate}
          />
          <RecurrenceCheckbox
            checked={isRecurring}
            onChange={setIsRecurring}
            disabled={!dueDate}
          />
          {isRecurring && (
            <RecurrencePatternSelect
              value={recurrencePattern}
              onChange={setRecurrencePattern}
            />
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Tags (optional)
          </label>
          <TagSelector
            selectedTagIds={selectedTagIds}
            onChange={setSelectedTagIds}
            tags={tags}
          />
        </div>
      </div>
    </form>
  )
}
