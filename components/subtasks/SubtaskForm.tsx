'use client'

import { useState, type KeyboardEvent } from 'react'
import type { Subtask } from '@/lib/types'

interface SubtaskFormProps {
  todoId: number
  onSubmit: (subtask: Subtask) => void
  onAdd?: (subtask: Subtask) => void
  isPending?: boolean
}

export function SubtaskForm({ todoId, onSubmit, onAdd, isPending }: SubtaskFormProps) {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    const trimmed = inputValue.trim()
    if (!trimmed) {
      setError('Title is required')
      return
    }
    if (trimmed.length > 200) {
      setError('Title must be \u2264 200 characters')
      return
    }
    setError(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      data-testid={`subtask-form-${todoId}`}
      className="flex flex-col gap-1 pt-1"
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={handleKeyDown}
          data-testid={`subtask-input-${todoId}`}
          aria-label="Add subtask"
          placeholder="Add a subtask..."
          disabled={isPending}
          className="flex-1 text-sm rounded border border-input px-2 py-1 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring disabled:opacity-50"
        />
        <button
          onClick={() => {
            const trimmed = inputValue.trim()
            if (!trimmed) {
              setError('Title is required')
              return
            }
            if (trimmed.length > 200) {
              setError('Title must be \u2264 200 characters')
              return
            }
            setError(null)
          }}
          data-testid={`subtask-add-btn-${todoId}`}
          disabled={isPending}
          aria-label="Add subtask"
          className="rounded px-2 py-1 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          Add
        </button>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}

// Export a version that takes a submit callback directly for use with useSubtasks
export function SubtaskFormConnected({
  todoId,
  onAdd,
  isPending,
}: {
  todoId: number
  onAdd: (title: string) => void
  isPending?: boolean
}) {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit() {
    const trimmed = inputValue.trim()
    if (!trimmed) {
      setError('Title is required')
      return
    }
    if (trimmed.length > 200) {
      setError('Title must be \u2264 200 characters')
      return
    }
    setError(null)
    onAdd(trimmed)
    setInputValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div
      data-testid={`subtask-form-${todoId}`}
      className="flex flex-col gap-1 pt-1"
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={handleKeyDown}
          data-testid={`subtask-input-${todoId}`}
          aria-label="Add subtask"
          placeholder="Add a subtask..."
          disabled={isPending}
          className="flex-1 text-sm rounded border border-input px-2 py-1 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring disabled:opacity-50"
        />
        <button
          onClick={submit}
          data-testid={`subtask-add-btn-${todoId}`}
          disabled={isPending}
          aria-label="Add subtask"
          className="rounded px-2 py-1 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          Add
        </button>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
