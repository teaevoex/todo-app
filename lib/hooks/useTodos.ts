'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { todosApi } from '@/lib/api/todos'
import { queryKeys } from '@/lib/queryKeys'
import type { TodoWithRelations, CreateTodoDto, UpdateTodoDto } from '@/lib/types'

export function useTodos() {
  const queryClient = useQueryClient()

  const todosQuery = useQuery({
    queryKey: queryKeys.todos,
    queryFn: todosApi.fetchTodos,
    staleTime: 30_000,
    gcTime: 300_000,
  })

  const createMutation = useMutation({
    mutationFn: (dto: CreateTodoDto) => todosApi.createTodo(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateTodoDto }) =>
      todosApi.updateTodo(id, dto),
    onMutate: async ({ id, dto }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.todos })
      const previous = queryClient.getQueryData<TodoWithRelations[]>(queryKeys.todos)

      queryClient.setQueryData<TodoWithRelations[]>(queryKeys.todos, (old) => {
        if (!old) return old
        return old.map((todo) =>
          todo.id === id
            ? {
                ...todo,
                ...dto,
                completed:
                  dto.completed !== undefined ? dto.completed : todo.completed,
              }
            : todo
        )
      })

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.todos, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => todosApi.deleteTodo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos })
    },
  })

  return {
    todos: todosQuery.data ?? [],
    isLoading: todosQuery.isLoading,
    error: todosQuery.error,
    createTodo: createMutation.mutate,
    updateTodo: (id: number, dto: UpdateTodoDto) =>
      updateMutation.mutate({ id, dto }),
    deleteTodo: deleteMutation.mutate,
  }
}
