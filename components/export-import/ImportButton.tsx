'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useImport } from '@/lib/hooks/useExportImport'
import type { ExportPayload, ImportResult } from '@/lib/types'

interface ImportButtonProps {
  onSuccess?: (result: ImportResult) => void
  className?: string
}

export function ImportButton({ onSuccess, className }: ImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const importMutation = useImport()

  function handleButtonClick() {
    setError(null)
    fileInputRef.current?.click()
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    // Reset input so the same file can be re-selected if needed
    event.target.value = ''

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text !== 'string') {
        setError('Failed to read file')
        return
      }

      let payload: ExportPayload
      try {
        payload = JSON.parse(text) as ExportPayload
      } catch {
        setError('Invalid JSON file')
        return
      }

      // Basic client-side validation before sending to server
      if (!payload || typeof payload !== 'object') {
        setError('Invalid JSON structure')
        return
      }

      importMutation.mutate(payload, {
        onSuccess: (result) => {
          setError(null)
          const todosCount = result.imported.todos
          const subtasksCount = result.imported.subtasks
          const tagsCount = result.imported.tags
          const message = `Imported ${todosCount} todos, ${subtasksCount} subtasks, ${tagsCount} tags`
          // Show success notification
          alert(message)
          onSuccess?.(result)
        },
        onError: (err) => {
          setError(err.message ?? 'Import failed')
        },
      })
    }

    reader.onerror = () => {
      setError('Failed to read file')
    }

    reader.readAsText(file)
  }

  const isImporting = importMutation.isPending

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleButtonClick}
        disabled={isImporting}
        aria-busy={isImporting}
        data-testid="import-button"
        className={className}
      >
        <Upload className="mr-1 h-4 w-4" />
        {isImporting ? 'Importing\u2026' : 'Import'}
      </Button>
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        onChange={handleFileChange}
        aria-hidden="true"
        data-testid="import-file-input"
        className="hidden"
      />
      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="text-destructive text-sm mt-1"
          data-testid="import-error"
        >
          {error}
        </p>
      )}
    </div>
  )
}
