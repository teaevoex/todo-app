'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTodos } from '@/lib/hooks/useTodos'
import { useTags } from '@/lib/hooks/useTags'
import { useFilters } from '@/lib/hooks/useFilters'
import { TodoForm } from '@/components/todos/TodoForm'
import { TodoList } from '@/components/todos/TodoList'
import { TodoEditModal } from '@/components/todos/TodoEditModal'
import { ConfirmDialog } from '@/components/todos/ConfirmDialog'
import { TagManager } from '@/components/tags/TagManager'
import { TemplateManager } from '@/components/templates/TemplateManager'
import { SaveTemplateModal } from '@/components/templates/SaveTemplateModal'
import { FilterBar } from '@/components/search/FilterBar'
import { FilterSummary } from '@/components/search/FilterSummary'
import { ExportButton } from '@/components/export-import/ExportButton'
import { ImportButton } from '@/components/export-import/ImportButton'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { Button } from '@/components/ui/button'
import type { TodoWithRelations, CreateTodoDto, UpdateTodoDto, FilterState } from '@/lib/types'

export default function HomePage() {
  const { todos, isLoading, createTodo, updateTodo, deleteTodo } = useTodos()
  const { tags } = useTags()
  const {
    filters,
    filterTodos,
    activeFilterCount,
    setSearch,
    setPriority,
    setTag,
    setCompletion,
    setDateFrom,
    setDateTo,
    clearAllFilters,
  } = useFilters()

  const [editingTodo, setEditingTodo] = useState<TodoWithRelations | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false)
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false)
  const [savingAsTodoTemplate, setSavingAsTodoTemplate] = useState<TodoWithRelations | null>(null)

  const filteredTodos = useMemo(
    () => filterTodos(todos),
    [todos, filterTodos]
  )

  function handleCreate(dto: CreateTodoDto) {
    createTodo(dto)
  }

  function handleToggle(id: number, completed: boolean) {
    updateTodo(id, { completed })
  }

  function handleEdit(todo: TodoWithRelations) {
    setEditingTodo(todo)
  }

  function handleEditSubmit(id: number, dto: UpdateTodoDto) {
    updateTodo(id, dto)
  }

  function handleDeleteRequest(id: number) {
    setDeletingId(id)
  }

  function handleDeleteConfirm() {
    if (deletingId !== null) {
      deleteTodo(deletingId)
    }
  }

  function handleTagClick(tagId: number) {
    setTag(tagId)
  }

  function handleRemoveFilter(key: keyof FilterState) {
    switch (key) {
      case 'searchQuery':
        setSearch('')
        break
      case 'priorityFilter':
        setPriority('all')
        break
      case 'tagFilter':
        setTag('all')
        break
      case 'completionFilter':
        setCompletion('all')
        break
      case 'dateFrom':
        setDateFrom(null)
        break
      case 'dateTo':
        setDateTo(null)
        break
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Todos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Stay organised and on top of your tasks
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/calendar">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="calendar-link-button"
              >
                Calendar
              </Button>
            </Link>
            <ExportButton />
            <ImportButton />
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="manage-templates-button"
              onClick={() => setIsTemplateManagerOpen(true)}
            >
              Templates
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="manage-tags-button"
              onClick={() => setIsTagManagerOpen(true)}
            >
              Manage Tags
            </Button>
            <LogoutButton />
          </div>
        </header>

        <div className="mb-6">
          <TodoForm onSubmit={handleCreate} />
        </div>

        <div className="mb-4 space-y-3">
          <FilterBar
            filterState={filters}
            tags={tags}
            activeFilterCount={activeFilterCount}
            onSearchChange={setSearch}
            onPriorityChange={setPriority}
            onTagChange={setTag}
            onCompletionChange={setCompletion}
            onClearAll={clearAllFilters}
          />
          {activeFilterCount > 0 && (
            <FilterSummary
              filterState={filters}
              tags={tags}
              onRemoveFilter={handleRemoveFilter}
              onClearAll={clearAllFilters}
            />
          )}
        </div>

        <TodoList
          todos={filteredTodos}
          isLoading={isLoading}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
          onTagClick={handleTagClick}
          onSaveAsTemplate={setSavingAsTodoTemplate}
          isFiltered={activeFilterCount > 0}
        />
      </div>

      <TodoEditModal
        todo={editingTodo}
        isOpen={editingTodo !== null}
        onClose={() => setEditingTodo(null)}
        onSubmit={handleEditSubmit}
      />

      <ConfirmDialog
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Todo"
        message="Are you sure you want to delete this todo? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      <TagManager
        isOpen={isTagManagerOpen}
        onClose={() => setIsTagManagerOpen(false)}
      />

      <TemplateManager
        isOpen={isTemplateManagerOpen}
        onClose={() => setIsTemplateManagerOpen(false)}
      />

      {savingAsTodoTemplate && (
        <SaveTemplateModal
          isOpen={true}
          onClose={() => setSavingAsTodoTemplate(null)}
          sourceTodo={savingAsTodoTemplate}
        />
      )}
    </main>
  )
}
