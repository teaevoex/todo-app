import type { Priority } from './enums'
import type { ExportTodo, TodoReminder } from './todo'
import type { ExportSubtask } from './subtask'
import type { ExportTag, ExportTodoTag } from './tag'

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

export interface ExportPayload {
  version: number
  exportedAt: string
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

export interface FilterState {
  searchQuery: string
  priorityFilter: Priority | 'all'
  tagFilter: number | 'all'
  completionFilter: 'all' | 'completed' | 'incomplete'
  dateFrom: string | null
  dateTo: string | null
}
