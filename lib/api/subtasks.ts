import { apiClient } from './client'
import type { Subtask, CreateSubtaskDto, UpdateSubtaskDto } from '@/lib/types'

export const subtasksApi = {
  createSubtask(todoId: number, dto: CreateSubtaskDto): Promise<Subtask> {
    return apiClient.post<Subtask>(`/api/todos/${todoId}/subtasks`, dto)
  },

  updateSubtask(id: number, dto: UpdateSubtaskDto): Promise<Subtask> {
    return apiClient.put<Subtask>(`/api/subtasks/${id}`, dto)
  },

  deleteSubtask(id: number): Promise<void> {
    return apiClient.delete<void>(`/api/subtasks/${id}`)
  },
}
