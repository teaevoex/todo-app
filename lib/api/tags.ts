import { apiClient } from './client'
import type { Tag, CreateTagDto, UpdateTagDto } from '@/lib/types'

export const tagsApi = {
  fetchTags(): Promise<Tag[]> {
    return apiClient.get<Tag[]>('/api/tags')
  },

  createTag(dto: CreateTagDto): Promise<Tag> {
    return apiClient.post<Tag>('/api/tags', dto)
  },

  updateTag(id: number, dto: UpdateTagDto): Promise<Tag> {
    return apiClient.put<Tag>(`/api/tags/${id}`, dto)
  },

  deleteTag(id: number): Promise<void> {
    return apiClient.delete<void>(`/api/tags/${id}`)
  },

  assignTag(todoId: number, tagIds: number[]): Promise<void> {
    return apiClient.post<void>(`/api/todos/${todoId}/tags`, { tagIds })
  },

  removeTag(todoId: number, tagIds: number[]): Promise<void> {
    return apiClient.delete<void>(`/api/todos/${todoId}/tags`, { tagIds })
  },
}
