'use client'

import { getSingaporeNow } from '@/lib/timezone'
import { Spinner } from '@/components/todos/Spinner'
import { EmptyState } from '@/components/todos/EmptyState'
import { TodoSection } from './TodoSection'
import { TodoItem } from './TodoItem'
import type { TodoWithRelations } from '@/lib/types'

interface TodoListProps {
  todos: TodoWithRelations[]
  isLoading: boolean
  onToggle: (id: number, completed: boolean) => void
  onEdit: (todo: TodoWithRelations) => void
  onDelete: (id: number) => void
  onTagClick?: (tagId: number) => void
  onSaveAsTemplate?: (todo: TodoWithRelations) => void
  isFiltered?: boolean
}

export function TodoList({
  todos,
  isLoading,
  onToggle,
  onEdit,
  onDelete,
  onTagClick,
  onSaveAsTemplate,
  isFiltered = false,
}: TodoListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (todos.length === 0) {
    return (
      <EmptyState
        message={
          isFiltered
            ? 'No todos match your filters'
            : 'No todos yet. Add your first one above!'
        }
      />
    )
  }

  const now = getSingaporeNow()

  const overdue = todos.filter(
    (t) => !t.completed && t.due_date !== null && new Date(t.due_date) < now
  )
  const pending = todos.filter(
    (t) =>
      !t.completed &&
      (t.due_date === null || new Date(t.due_date) >= now)
  )
  const completed = todos.filter((t) => t.completed)

  return (
    <div>
      <TodoSection title="Overdue" count={overdue.length} variant="danger">
        {overdue.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onTagClick={onTagClick}
            onSaveAsTemplate={onSaveAsTemplate}
          />
        ))}
      </TodoSection>

      <TodoSection title="Active" count={pending.length} variant="default">
        {pending.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onTagClick={onTagClick}
            onSaveAsTemplate={onSaveAsTemplate}
          />
        ))}
      </TodoSection>

      <TodoSection title="Completed" count={completed.length} variant="muted">
        {completed.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onTagClick={onTagClick}
            onSaveAsTemplate={onSaveAsTemplate}
          />
        ))}
      </TodoSection>
    </div>
  )
}
