import { apiClient } from './client'
import type { Template, CreateTemplateDto, Todo } from '@/lib/types'

export const templatesApi = {
  fetchTemplates(): Promise<Template[]> {
    return apiClient.get<Template[]>('/api/templates')
  },

  createTemplate(dto: CreateTemplateDto): Promise<Template> {
    return apiClient.post<Template>('/api/templates', dto)
  },

  useTemplate(id: number, dueDate?: string): Promise<Todo> {
    return apiClient.post<Todo>(`/api/templates/${id}/use`, { dueDate })
  },

  updateTemplate(id: number, dto: Partial<CreateTemplateDto>): Promise<Template> {
    return apiClient.put<Template>(`/api/templates/${id}`, dto)
  },

  deleteTemplate(id: number): Promise<void> {
    return apiClient.delete<void>(`/api/templates/${id}`)
  },
}
