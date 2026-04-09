'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { templatesApi } from '@/lib/api/templates'
import { queryKeys } from '@/lib/queryKeys'
import type { Template, CreateTemplateDto } from '@/lib/types'

interface UseTemplateArgs {
  id: number
  dueDate?: string
}

export function useTemplates() {
  const queryClient = useQueryClient()

  const templatesQuery = useQuery({
    queryKey: queryKeys.templates,
    queryFn: templatesApi.fetchTemplates,
    staleTime: 60_000,
    gcTime: 300_000,
  })

  const createTemplate = useMutation({
    mutationFn: (dto: CreateTemplateDto) => templatesApi.createTemplate(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates })
    },
  })

  const updateTemplate = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateTemplateDto> }) =>
      templatesApi.updateTemplate(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates })
    },
  })

  const deleteTemplate = useMutation({
    mutationFn: (id: number) => templatesApi.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates })
    },
  })

  const useTemplateMutation = useMutation({
    mutationFn: ({ id, dueDate }: UseTemplateArgs) =>
      templatesApi.useTemplate(id, dueDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos })
    },
  })

  return {
    templates: (templatesQuery.data ?? []) as Template[],
    isLoading: templatesQuery.isLoading,
    error: templatesQuery.error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    useTemplateMutation,
  }
}
