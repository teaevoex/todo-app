'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { exportTodos, importTodos } from '@/lib/api/export-import'
import { queryKeys } from '@/lib/queryKeys'
import type { ExportPayload, ImportResult } from '@/lib/types'

export function useExport() {
  return useMutation<Blob, Error, void>({
    mutationFn: exportTodos,
  })
}

export function useImport() {
  const queryClient = useQueryClient()

  return useMutation<ImportResult, Error, ExportPayload>({
    mutationFn: importTodos,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todos })
      queryClient.invalidateQueries({ queryKey: queryKeys.tags })
    },
  })
}
