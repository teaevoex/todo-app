import type { ExportPayload, ImportResult } from '@/lib/types'

export async function exportTodos(): Promise<Blob> {
  const response = await fetch('/api/todos/export', {
    method: 'GET',
    credentials: 'include',
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized')
    }
    throw new Error(`Export failed: ${response.statusText}`)
  }

  return response.blob()
}

export async function importTodos(payload: ExportPayload): Promise<ImportResult> {
  const response = await fetch('/api/todos/import', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const json = await response.json()

  if (!json.success) {
    throw new Error(json.error ?? 'Import failed')
  }

  return json.data as ImportResult
}
