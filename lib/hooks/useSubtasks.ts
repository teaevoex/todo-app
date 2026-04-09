'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { subtasksApi } from '@/lib/api/subtasks'
import { queryKeys } from '@/lib/queryKeys'
import type { CreateSubtaskDto, UpdateSubtaskDto, TodoWithRelations } from '@/lib/types'

export function useSubtasks(todoId: number) {
  const queryClient = useQueryClient()

  const createSubtask = useMutation({
    mutationFn: (dto: CreateSubtaskDto) => subtasksApi.createSubtask(todoId, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.todos }),
  })

  const updateSubtask = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateSubtaskDto }) =>
      subtasksApi.updateSubtask(id, dto),
    onMutate: async ({ id, dto }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.todos })
      const previous = queryClient.getQueryData(queryKeys.todos)
      queryClient.setQueryData(queryKeys.todos, (old: TodoWithRelations[] | undefined) =>
        (old ?? []).map((todo) =>
          todo.id === todoId
            ? {
                ...todo,
                subtasks: (todo.subtasks ?? []).map((s) =>
                  s.id === id ? { ...s, ...dto } : s
                ),
              }
            : todo
        )
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.todos, ctx.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.todos }),
  })

  const deleteSubtask = useMutation({
    mutationFn: (id: number) => subtasksApi.deleteSubtask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.todos }),
  })

  return { createSubtask, updateSubtask, deleteSubtask }
}
