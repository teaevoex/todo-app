import type { Priority, RecurrencePattern, ReminderMinutes } from './enums'
import type { Subtask } from './subtask'
import type { Tag } from './tag'

export interface Todo {
  id: number
  user_id: number
  title: string
  completed: boolean
  due_date: string | null
  priority: Priority
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: ReminderMinutes | null
  last_notification_sent: string | null
  created_at: string
  updated_at: string
}

export interface TodoWithRelations extends Todo {
  subtasks: Subtask[]
  tags: Tag[]
}

export interface CreateTodoDto {
  title: string
  due_date?: string | null
  priority?: Priority
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
  reminder_minutes?: ReminderMinutes | null
  tagIds?: number[]
}

export interface UpdateTodoDto {
  title?: string
  completed?: boolean
  due_date?: string | null
  priority?: Priority
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
  reminder_minutes?: ReminderMinutes | null
  last_notification_sent?: string | null
  tagIds?: number[]
}

export interface TodoReminder {
  id: number
  title: string
  due_date: string
  reminder_minutes: number
}

export interface ExportTodo {
  id: number
  title: string
  completed: boolean
  due_date: string | null
  priority: Priority
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: ReminderMinutes | null
  created_at: string
}
