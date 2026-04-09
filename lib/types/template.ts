import type { Priority, RecurrencePattern, ReminderMinutes } from './enums'

export interface TemplateSubtask {
  title: string
  position: number
}

export interface Template {
  id: number
  user_id: number
  name: string
  description: string | null
  category: string | null
  title_template: string
  priority: Priority
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: ReminderMinutes | null
  subtasks_json: string | null
  tag_ids_json: string | null
  due_date_offset_days: number | null
  created_at: string
}

export interface CreateTemplateDto {
  name: string
  description?: string | null
  category?: string | null
  title_template: string
  priority?: Priority
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
  reminder_minutes?: ReminderMinutes | null
  subtasks?: TemplateSubtask[]
  due_date_offset_days?: number | null
  tag_ids?: number[]
}
