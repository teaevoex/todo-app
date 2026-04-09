export interface Tag {
  id: number
  user_id: number
  name: string
  color: string
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

export interface ExportTag {
  id: number
  name: string
  color: string
}

export interface ExportTodoTag {
  todo_id: number
  tag_id: number
}
