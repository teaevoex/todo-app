'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RecurrenceCheckbox } from './RecurrenceCheckbox'
import { RecurrencePatternSelect } from './RecurrencePatternSelect'
import { ReminderSelect } from './ReminderSelect'
import { TagSelector } from '@/components/tags/TagSelector'
import { useTags } from '@/lib/hooks/useTags'
import { getSingaporeNow } from '@/lib/timezone'
import type { TodoWithRelations, UpdateTodoDto, Priority, RecurrencePattern, ReminderMinutes } from '@/lib/types'

interface TodoEditModalProps {
  todo: TodoWithRelations | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (id: number, dto: UpdateTodoDto) => void
}

interface FormErrors {
  title?: string
  dueDate?: string
}

function isoToDatetimeLocal(isoString: string | null): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  const localDate = new Date(date.getTime() - offset)
  return localDate.toISOString().slice(0, 16)
}

export function TodoEditModal({ todo, isOpen, onClose, onSubmit }: TodoEditModalProps) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('weekly')
  const [reminderMinutes, setReminderMinutes] = useState<ReminderMinutes | null>(null)
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const { tags } = useTags()

  useEffect(() => {
    if (todo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync form state from prop when todo changes
      setTitle(todo.title)
      setDueDate(isoToDatetimeLocal(todo.due_date))
      setPriority(todo.priority)
      setIsRecurring(todo.is_recurring)
      setRecurrencePattern(todo.recurrence_pattern ?? 'weekly')
      setReminderMinutes((todo.reminder_minutes as ReminderMinutes) ?? null)
      setSelectedTagIds((todo.tags ?? []).map((t) => t.id))
      setErrors({})
    }
  }, [todo])

  if (!todo) return null

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

    const trimmed = title.trim()
    if (!trimmed) {
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

    if (!validate() || !todo) return

    const effectiveDueDate = dueDate ? new Date(dueDate).toISOString() : null

    const dto: UpdateTodoDto = {
      title: title.trim(),
      priority,
      is_recurring: isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern : null,
      due_date: effectiveDueDate,
      reminder_minutes: effectiveDueDate ? reminderMinutes : null,
      tagIds: selectedTagIds,
    }

    onSubmit(todo.id, dto)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent data-testid="todo-edit-modal">
        <DialogHeader>
          <DialogTitle>Edit Todo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="edit-todo-title" className="mb-1 block text-sm font-medium text-muted-foreground">
              Title
            </label>
            <input
              id="edit-todo-title"
              data-testid="todo-title-input"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }))
              }}
              maxLength={500}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {errors.title && (
              <p role="alert" aria-live="polite" className="mt-1 text-xs text-destructive">
                {errors.title}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="edit-todo-priority" className="mb-1 block text-sm font-medium text-muted-foreground">
              Priority
            </label>
            <select
              id="edit-todo-priority"
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

          <div>
            <label htmlFor="edit-todo-due-date" className="mb-1 block text-sm font-medium text-muted-foreground">
              Due date
            </label>
            <input
              id="edit-todo-due-date"
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
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Tags
            </label>
            <TagSelector
              selectedTagIds={selectedTagIds}
              onChange={setSelectedTagIds}
              tags={tags}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
