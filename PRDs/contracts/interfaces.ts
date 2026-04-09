/**
 * INTEGRATION CONTRACTS — Shared Type Definitions
 *
 * This file is the SINGLE SOURCE OF TRUTH for all cross-feature type contracts.
 * It is owned by Phase 0 (architect agent). Feature agents MUST NOT modify this file.
 *
 * If a feature agent needs a type not defined here:
 *   1. Create a feature-local type in their own module
 *   2. Document the need in their agent memory file
 *   3. Escalate to Phase 0 owner for inclusion in next iteration
 *
 * All implementing agents import from this file to verify interface conformance.
 *
 * @see PRDs/ARCHITECTURE.md Section 7 (Type System) and Section 8 (Integration Contracts)
 */

// ============================================================
// ENUMS & UNIONS
// ============================================================

export type Priority = 'high' | 'medium' | 'low'

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080

export const PRIORITY_VALUES: readonly Priority[] = ['high', 'medium', 'low'] as const

export const RECURRENCE_VALUES: readonly RecurrencePattern[] = [
  'daily', 'weekly', 'monthly', 'yearly',
] as const

export const REMINDER_OPTIONS: readonly { label: string; value: ReminderMinutes }[] = [
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '2 hours before', value: 120 },
  { label: '1 day before', value: 1440 },
  { label: '2 days before', value: 2880 },
  { label: '1 week before', value: 10080 },
] as const

export const REMINDER_LABELS: Record<ReminderMinutes, string> = {
  15: '15m',
  30: '30m',
  60: '1h',
  120: '2h',
  1440: '1d',
  2880: '2d',
  10080: '1w',
}

// ============================================================
// USER & AUTH — Feature 11
// ============================================================

export interface User {
  id: number
  username: string
  created_at: string
}

export interface Session {
  userId: number
  username: string
}

export interface Authenticator {
  id: number
  user_id: number
  credential_id: string                     // base64url-encoded
  credential_public_key: string             // base64url-encoded
  counter: number
  transports: string | null                 // JSON array of transport strings
  created_at: string
}

// ============================================================
// TODO — Feature 01 (foundation, extended by 02, 03, 04)
// ============================================================

export interface Todo {
  id: number
  user_id: number
  title: string
  completed: boolean
  due_date: string | null                   // ISO 8601, Singapore TZ
  priority: Priority                        // Feature 02
  is_recurring: boolean                     // Feature 03
  recurrence_pattern: RecurrencePattern | null // Feature 03
  reminder_minutes: ReminderMinutes | null  // Feature 04
  last_notification_sent: string | null     // Feature 04
  created_at: string
  updated_at: string
}

/**
 * Canonical shape returned by GET /api/todos.
 * Every consumer of todo data depends on this shape.
 */
export interface TodoWithRelations extends Todo {
  subtasks: Subtask[]                       // Feature 05
  tags: Tag[]                               // Feature 06
}

export interface CreateTodoDto {
  title: string
  due_date?: string | null
  priority?: Priority                       // defaults to 'medium'
  is_recurring?: boolean                    // defaults to false
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
  tagIds?: number[]
}

export interface TodoReminder {
  id: number
  title: string
  due_date: string
  reminder_minutes: number
}

// ============================================================
// SUBTASK — Feature 05
// ============================================================

export interface Subtask {
  id: number
  todo_id: number
  title: string
  completed: boolean
  position: number                          // ordering within parent todo
  created_at: string
}

export interface CreateSubtaskDto {
  title: string
}

export interface UpdateSubtaskDto {
  title?: string
  completed?: boolean
}

// ============================================================
// TAG — Feature 06
// ============================================================

export interface Tag {
  id: number
  user_id: number
  name: string
  color: string                             // hex color, e.g. '#3B82F6'
  created_at: string
}

export interface CreateTagDto {
  name: string
  color: string
}

export interface UpdateTagDto {
  name?: string
  color?: string
}

// ============================================================
// TEMPLATE — Feature 07
// ============================================================

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
  subtasks_json: string | null              // JSON string of TemplateSubtask[]
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
  subtasks?: TemplateSubtask[]              // serialized to JSON before DB insert
  due_date_offset_days?: number | null
}

// ============================================================
// HOLIDAY — Feature 10
// ============================================================

export interface Holiday {
  id: number
  date: string                              // YYYY-MM-DD format
  name: string
  year: number
}

// ============================================================
// API RESPONSE WRAPPER — shared across all features
// ============================================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: PaginationMeta
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
}

// ============================================================
// EXPORT/IMPORT — Feature 09
// ============================================================

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

export interface ExportSubtask {
  id: number
  todo_id: number
  title: string
  completed: boolean
  position: number
}

export interface ExportTag {
  id: number
  name: string
  color: string
}

export interface ExportTodoTag {
  todo_id: number
  tag_id: number
}

export interface ExportPayload {
  version: number
  exportedAt: string                        // Singapore ISO timestamp
  todos: ExportTodo[]
  subtasks: ExportSubtask[]
  tags: ExportTag[]
  todoTags: ExportTodoTag[]
}

export interface ImportResult {
  imported: {
    todos: number
    subtasks: number
    tags: number
  }
}

// ============================================================
// SEARCH & FILTER — Feature 08 (client-side state)
// ============================================================

export interface FilterState {
  searchQuery: string
  priorityFilter: Priority | 'all'
  tagFilter: number | 'all'                 // tag ID or 'all'
  completionFilter: 'all' | 'completed' | 'incomplete'
  dateFrom: string | null
  dateTo: string | null
}

// ============================================================
// TANSTACK QUERY KEYS — shared cache key contract
// ============================================================

export const queryKeys = {
  todos: ['todos'] as const,
  todo: (id: number) => ['todos', id] as const,
  tags: ['tags'] as const,
  templates: ['templates'] as const,
  holidays: (year: number, month: number) => ['holidays', year, month] as const,
  user: ['auth', 'me'] as const,
  notifications: ['notifications'] as const,
} as const

// ============================================================
// DB MODULE CONTRACTS — method signatures each domain DB must implement
// ============================================================

/**
 * Contract for lib/db/todos.ts
 * Feature 01 implements base; Features 02, 03, 04 extend via migrations
 */
export interface TodoDBContract {
  create(userId: number, dto: CreateTodoDto): Todo
  findAll(userId: number): TodoWithRelations[]
  findById(id: number, userId: number): TodoWithRelations | null
  update(id: number, userId: number, dto: UpdateTodoDto): Todo
  delete(id: number, userId: number): void
  findDueReminders(userId: number): TodoReminder[]
  updateLastNotificationSent(id: number, timestamp: string): void
}

/**
 * Contract for lib/db/subtasks.ts
 * Feature 05 implements
 */
export interface SubtaskDBContract {
  create(todoId: number, dto: CreateSubtaskDto): Subtask
  findByTodoId(todoId: number): Subtask[]
  update(id: number, dto: UpdateSubtaskDto): Subtask
  delete(id: number): void
}

/**
 * Contract for lib/db/tags.ts
 * Feature 06 implements
 */
export interface TagDBContract {
  create(userId: number, dto: CreateTagDto): Tag
  findAll(userId: number): Tag[]
  findById(id: number, userId: number): Tag | null
  update(id: number, userId: number, dto: UpdateTagDto): Tag
  delete(id: number, userId: number): void
  getTagsForTodo(todoId: number): Tag[]
  assignTag(todoId: number, tagId: number): void
  removeTag(todoId: number, tagId: number): void
}

/**
 * Contract for lib/db/templates.ts
 * Feature 07 implements
 */
export interface TemplateDBContract {
  create(userId: number, dto: CreateTemplateDto): Template
  findAll(userId: number): Template[]
  findById(id: number, userId: number): Template | null
  update(id: number, userId: number, dto: Partial<CreateTemplateDto>): Template
  delete(id: number, userId: number): void
}

/**
 * Contract for lib/db/users.ts
 * Feature 11 implements
 */
export interface UserDBContract {
  create(username: string): User
  findByUsername(username: string): User | null
  findById(id: number): User | null
}

/**
 * Contract for lib/db/holidays.ts
 * Feature 10 implements
 */
export interface HolidayDBContract {
  findByMonth(year: number, month: number): Holiday[]
  findByYear(year: number): Holiday[]
}

// ============================================================
// API CLIENT CONTRACTS — method signatures each API client must implement
// ============================================================

export interface TodosApiContract {
  fetchTodos(): Promise<TodoWithRelations[]>
  createTodo(dto: CreateTodoDto): Promise<Todo>
  updateTodo(id: number, dto: UpdateTodoDto): Promise<Todo>
  deleteTodo(id: number): Promise<void>
}

export interface SubtasksApiContract {
  createSubtask(todoId: number, dto: CreateSubtaskDto): Promise<Subtask>
  updateSubtask(id: number, dto: UpdateSubtaskDto): Promise<Subtask>
  deleteSubtask(id: number): Promise<void>
}

export interface TagsApiContract {
  fetchTags(): Promise<Tag[]>
  createTag(dto: CreateTagDto): Promise<Tag>
  updateTag(id: number, dto: UpdateTagDto): Promise<Tag>
  deleteTag(id: number): Promise<void>
  assignTag(todoId: number, tagIds: number[]): Promise<void>
  removeTag(todoId: number, tagIds: number[]): Promise<void>
}

export interface TemplatesApiContract {
  fetchTemplates(): Promise<Template[]>
  createTemplate(dto: CreateTemplateDto): Promise<Template>
  useTemplate(id: number, dueDate?: string): Promise<Todo>
  updateTemplate(id: number, dto: Partial<CreateTemplateDto>): Promise<Template>
  deleteTemplate(id: number): Promise<void>
}

export interface NotificationsApiContract {
  checkNotifications(): Promise<TodoReminder[]>
}

export interface HolidaysApiContract {
  fetchHolidays(year: number, month?: number): Promise<Holiday[]>
}

export interface ExportImportApiContract {
  exportTodos(): Promise<ExportPayload>
  importTodos(payload: ExportPayload): Promise<ImportResult>
}

// ============================================================
// RECURRENCE CONTRACT — Feature 03
// ============================================================

/**
 * Calculates the next due date based on the current due date and recurrence pattern.
 * All date calculations MUST use Singapore timezone (Asia/Singapore).
 *
 * Rules:
 * - daily:   add 1 day
 * - weekly:  add 7 days
 * - monthly: add 1 month (same day; if day > month length, use last day of month)
 * - yearly:  add 1 year (handle Feb 29 → Feb 28 in non-leap years)
 */
export type CalculateNextDueDate = (
  currentDueDate: string,
  pattern: RecurrencePattern,
) => string

// ============================================================
// PROGRESS CONTRACT — Feature 05
// ============================================================

/**
 * Client-side progress computation for subtasks.
 *
 * progressPercent = subtasks.length === 0
 *   ? 0
 *   : Math.round((subtasks.filter(s => s.completed).length / subtasks.length) * 100)
 */
export type ComputeProgress = (subtasks: Subtask[]) => number
