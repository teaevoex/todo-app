'use client'

import { useState } from 'react'
import type { Subtask } from '@/lib/types'
import { SubtaskItem } from './SubtaskItem'
import { SubtaskFormConnected } from './SubtaskForm'
import { ProgressBar } from './ProgressBar'
import { useSubtasks } from '@/lib/hooks/useSubtasks'

interface SubtaskListProps {
  todoId: number
  subtasks: Subtask[]
  isExpanded: boolean
  onToggleExpand: () => void
  todoTitle?: string
}

export function SubtaskList({
  todoId,
  subtasks,
  isExpanded,
  onToggleExpand,
  todoTitle,
}: SubtaskListProps) {
  const { createSubtask, updateSubtask, deleteSubtask } = useSubtasks(todoId)
  const completedCount = subtasks.filter((s) => s.completed).length

  function handleAddSubtask(title: string) {
    createSubtask.mutate({ title })
  }

  function handleToggle(id: number, completed: boolean) {
    updateSubtask.mutate({ id, dto: { completed } })
  }

  function handleDelete(id: number) {
    deleteSubtask.mutate(id)
  }

  return (
    <div
      data-testid={`subtask-list-${todoId}`}
      className="flex flex-col gap-1"
      aria-label={todoTitle ? `Subtasks for: ${todoTitle}` : `Subtasks`}
    >
      <button
        onClick={onToggleExpand}
        data-testid={`expand-subtasks-${todoId}`}
        aria-expanded={isExpanded}
        aria-label={`Toggle subtasks for todo ${todoId}`}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
      >
        <svg
          className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Subtasks ({subtasks.length})
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-2 pl-2 border-l border-border">
          {subtasks.length > 0 && (
            <ProgressBar
              completed={completedCount}
              total={subtasks.length}
              todoId={todoId}
            />
          )}

          {subtasks.length > 0 ? (
            <ul role="list" className="flex flex-col">
              {subtasks.map((subtask) => (
                <SubtaskItem
                  key={subtask.id}
                  subtask={subtask}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">No subtasks yet</p>
          )}

          <SubtaskFormConnected
            todoId={todoId}
            onAdd={handleAddSubtask}
            isPending={createSubtask.isPending}
          />
        </div>
      )}
    </div>
  )
}
