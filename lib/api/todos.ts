import { apiClient } from './client'
import type { Todo, TodoWithRelations, CreateTodoDto, UpdateTodoDto } from '@/lib/types'

export const todosApi = {
  fetchTodos(): Promise<TodoWithRelations[]> {
    return apiClient.get<TodoWithRelations[]>('/api/todos')
  },

  createTodo(dto: CreateTodoDto): Promise<Todo> {
    return apiClient.post<Todo>('/api/todos', dto)
  },

  updateTodo(id: number, dto: UpdateTodoDto): Promise<Todo> {
    return apiClient.put<Todo>(`/api/todos/${id}`, dto)
  },

  deleteTodo(id: number): Promise<void> {
    return apiClient.delete<void>(`/api/todos/${id}`)
  },
}
