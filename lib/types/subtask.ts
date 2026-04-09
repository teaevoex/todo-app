export interface Subtask {
  id: number
  todo_id: number
  title: string
  completed: boolean
  position: number
  created_at: string
}

export interface CreateSubtaskDto {
  title: string
}

export interface UpdateSubtaskDto {
  title?: string
  completed?: boolean
}

export interface ExportSubtask {
  id: number
  todo_id: number
  title: string
  completed: boolean
  position: number
}
