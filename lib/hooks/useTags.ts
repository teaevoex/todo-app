'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tagsApi } from '@/lib/api/tags'
import { queryKeys } from '@/lib/queryKeys'
import type { Tag, CreateTagDto, UpdateTagDto } from '@/lib/types'

export function useTags() {
  const queryClient = useQueryClient()

  const tagsQuery = useQuery({
    queryKey: queryKeys.tags,
    queryFn: tagsApi.fetchTags,
    staleTime: 60_000,
    gcTime: 300_000,
  })

  const createTag = useMutation({
    mutationFn: (dto: CreateTagDto) => tagsApi.createTag(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags })
    },
  })

  const updateTag = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateTagDto }) =>
      tagsApi.updateTag(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      queryClient.invalidateQueries({ queryKey: queryKeys.todos })
    },
  })

  const deleteTag = useMutation({
    mutationFn: (id: number) => tagsApi.deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      queryClient.invalidateQueries({ queryKey: queryKeys.todos })
    },
  })

  const assignTag = useMutation({
    mutationFn: ({ todoId, tagIds }: { todoId: number; tagIds: number[] }) =>
      tagsApi.assignTag(todoId, tagIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos })
    },
  })

  const removeTag = useMutation({
    mutationFn: ({ todoId, tagIds }: { todoId: number; tagIds: number[] }) =>
      tagsApi.removeTag(todoId, tagIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos })
    },
  })

  const tags: Tag[] = tagsQuery.data ?? []

  return {
    tags,
    isLoading: tagsQuery.isLoading,
    error: tagsQuery.error,
    tagsQuery,
    createTag,
    updateTag,
    deleteTag,
    assignTag,
    removeTag,
  }
}
