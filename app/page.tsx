'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Priority, RecurrencePattern, Subtask, Tag, Template, TemplateSubtask } from '@/lib/db'
import { useNotifications } from '@/lib/hooks/useNotifications'
import {
  EnrichedTodo,
  PRIORITY_ORDER,
  PRIORITY_COLORS,
  REMINDER_LABELS,
  TAG_COLORS,
  getSingaporeNow,
  formatDueDate,
  sortTodos,
  classifyTodos,
  PriorityBadge,
  RecurrenceBadge,
  ReminderBadge,
  ProgressBar,
  TagBadge,
  TodoItem,
} from './components/todo-components'

// --- Main Component ---

export default function HomePage() {
  const [todos, setTodos] = useState<EnrichedTodo[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionUsername, setSessionUsername] = useState('')

  // Create form state
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<Priority>('medium')
  const [newDueDate, setNewDueDate] = useState('')
  const [newIsRecurring, setNewIsRecurring] = useState(false)
  const [newRecurrencePattern, setNewRecurrencePattern] = useState<RecurrencePattern>('daily')
  const [newReminderMinutes, setNewReminderMinutes] = useState<number | null>(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')

  // Error state
  const [createError, setCreateError] = useState('')
  const [editError, setEditError] = useState('')

  // Edit modal state
  const [editingTodo, setEditingTodo] = useState<EnrichedTodo | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPriority, setEditPriority] = useState<Priority>('medium')
  const [editDueDate, setEditDueDate] = useState('')
  const [editIsRecurring, setEditIsRecurring] = useState(false)
  const [editRecurrencePattern, setEditRecurrencePattern] = useState<RecurrencePattern>('daily')
  const [editReminderMinutes, setEditReminderMinutes] = useState<number | null>(null)

  // Notifications
  const { permission, requestPermission, isEnabled } = useNotifications()

  // Subtask state
  const [expandedTodos, setExpandedTodos] = useState<Set<number>>(new Set())
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<Record<number, string>>({})

  // Tag state
  const [tags, setTags] = useState<Tag[]>([])
  const [tagFilter, setTagFilter] = useState<string>('')
  const [showTagModal, setShowTagModal] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3B82F6')
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [editTagName, setEditTagName] = useState('')
  const [editTagColor, setEditTagColor] = useState('')
  const [tagError, setTagError] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [editSelectedTagIds, setEditSelectedTagIds] = useState<number[]>([])

  // Template state
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [templateTitle, setTemplateTitle] = useState('')
  const [templatePriority, setTemplatePriority] = useState<Priority>('medium')
  const [templateCategory, setTemplateCategory] = useState('')
  const [templateOffset, setTemplateOffset] = useState('')
  const [templateSubtaskInput, setTemplateSubtaskInput] = useState('')
  const [templateSubtasks, setTemplateSubtasks] = useState<TemplateSubtask[]>([])
  const [templateError, setTemplateError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // --- Session ---

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.username) setSessionUsername(data.username) })
  }, [])

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  // --- Data Fetching ---

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch('/api/todos')
      if (res.ok) {
        const data = await res.json()
        setTodos(data)
      }
    } catch {
      // Network error — silently retry on next action
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags')
      if (res.ok) {
        const data = await res.json()
        setTags(data)
      }
    } catch {
      // Network error — silently retry on next action
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch {
      // Network error — silently retry on next action
    }
  }, [])

  useEffect(() => {
    fetchTodos()
    fetchTags()
    fetchTemplates()
  }, [fetchTodos, fetchTags, fetchTemplates])

  // --- Handlers ---

  async function handleAddTodo(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreateError('')

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          priority: newPriority,
          due_date: newDueDate || null,
          is_recurring: newIsRecurring,
          recurrence_pattern: newIsRecurring ? newRecurrencePattern : null,
          reminder_minutes: newDueDate ? newReminderMinutes : null,
        }),
      })

      if (res.ok) {
        const createdTodo = await res.json()

        // Set tags on the newly created todo
        if (selectedTagIds.length > 0) {
          await fetch(`/api/todos/${createdTodo.id}/tags`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tagIds: selectedTagIds }),
          })
        }

        setNewTitle('')
        setNewPriority('medium')
        setNewDueDate('')
        setNewIsRecurring(false)
        setNewRecurrencePattern('daily')
        setNewReminderMinutes(null)
        setSelectedTagIds([])
        await fetchTodos()
      } else {
        const data = await res.json()
        setCreateError(data.error || 'Failed to create todo')
      }
    } catch {
      setCreateError('Network error. Please try again.')
    }
  }

  async function handleToggleComplete(todo: EnrichedTodo) {
    const previousTodos = todos
    setTodos(prev => prev.map(t =>
      t.id === todo.id ? { ...t, completed: t.completed ? 0 : 1 } : t
    ))
    try {
      await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !todo.completed }),
      })
      await fetchTodos()
    } catch {
      setTodos(previousTodos)
    }
  }

  async function handleDeleteTodo(id: number) {
    if (!window.confirm('Are you sure you want to delete this todo? This will also delete its subtasks.')) {
      return
    }
    const previousTodos = todos
    setTodos(prev => prev.filter(t => t.id !== id))
    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' })
      await fetchTodos()
    } catch {
      setTodos(previousTodos)
    }
  }

  function openEditModal(todo: EnrichedTodo) {
    setEditingTodo(todo)
    setEditTitle(todo.title)
    setEditPriority(todo.priority)
    setEditDueDate(todo.due_date ?? '')
    setEditIsRecurring(!!todo.is_recurring)
    setEditRecurrencePattern(todo.recurrence_pattern ?? 'daily')
    setEditReminderMinutes(todo.reminder_minutes ?? null)
    setEditSelectedTagIds(todo.tags.map(t => t.id))
    setEditError('')
  }

  async function handleUpdateTodo() {
    if (!editingTodo || !editTitle.trim()) return
    setEditError('')

    try {
      const res = await fetch(`/api/todos/${editingTodo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          priority: editPriority,
          due_date: editDueDate || null,
          is_recurring: editIsRecurring,
          recurrence_pattern: editIsRecurring ? editRecurrencePattern : null,
          reminder_minutes: editDueDate ? editReminderMinutes : null,
        }),
      })

      if (res.ok) {
        // Update tags
        await fetch(`/api/todos/${editingTodo.id}/tags`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagIds: editSelectedTagIds }),
        })

        setEditingTodo(null)
        await fetchTodos()
      } else {
        const data = await res.json()
        setEditError(data.error || 'Failed to update todo')
      }
    } catch {
      setEditError('Network error. Please try again.')
    }
  }

  // --- Subtask Handlers ---

  function toggleSubtaskExpansion(todoId: number) {
    setExpandedTodos(prev => {
      const next = new Set(prev)
      if (next.has(todoId)) {
        next.delete(todoId)
      } else {
        next.add(todoId)
      }
      return next
    })
  }

  async function handleAddSubtask(todoId: number) {
    const title = newSubtaskTitle[todoId]?.trim()
    if (!title) return

    try {
      await fetch(`/api/todos/${todoId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      setNewSubtaskTitle(prev => ({ ...prev, [todoId]: '' }))
      await fetchTodos()
    } catch {
      // Failed — will reflect on next fetch
    }
  }

  async function toggleSubtask(subtaskId: number, completed: boolean) {
    try {
      await fetch(`/api/subtasks/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      })
      await fetchTodos()
    } catch {
      // Failed — will reflect on next fetch
    }
  }

  async function deleteSubtask(subtaskId: number) {
    try {
      await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' })
      await fetchTodos()
    } catch {
      // Failed — will reflect on next fetch
    }
  }

  // --- Tag Handlers ---

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault()
    if (!newTagName.trim()) return
    setTagError('')

    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      })

      if (res.ok) {
        setNewTagName('')
        setNewTagColor('#3B82F6')
        await fetchTags()
      } else {
        const data = await res.json()
        setTagError(data.error || 'Failed to create tag')
      }
    } catch {
      setTagError('Network error. Please try again.')
    }
  }

  async function handleUpdateTag() {
    if (!editingTag || !editTagName.trim()) return
    setTagError('')

    try {
      const res = await fetch(`/api/tags/${editingTag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editTagName.trim(), color: editTagColor }),
      })

      if (res.ok) {
        setEditingTag(null)
        await fetchTags()
        await fetchTodos()
      } else {
        const data = await res.json()
        setTagError(data.error || 'Failed to update tag')
      }
    } catch {
      setTagError('Network error. Please try again.')
    }
  }

  async function handleDeleteTag(tagId: number) {
    try {
      await fetch(`/api/tags/${tagId}`, { method: 'DELETE' })
      setSelectedTagIds(prev => prev.filter(id => id !== tagId))
      setEditSelectedTagIds(prev => prev.filter(id => id !== tagId))
      await fetchTags()
      await fetchTodos()
    } catch {
      // Failed — will reflect on next fetch
    }
  }

  function toggleTagSelection(tagId: number, isEdit: boolean) {
    const setter = isEdit ? setEditSelectedTagIds : setSelectedTagIds
    setter(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  // --- Template Handlers ---

  function resetTemplateForm() {
    setTemplateTitle('')
    setTemplatePriority('medium')
    setTemplateCategory('')
    setTemplateOffset('')
    setTemplateSubtaskInput('')
    setTemplateSubtasks([])
    setTemplateError('')
  }

  function handleAddTemplateSubtask() {
    if (!templateSubtaskInput.trim()) return
    setTemplateSubtasks(prev => [
      ...prev,
      { title: templateSubtaskInput.trim(), position: prev.length },
    ])
    setTemplateSubtaskInput('')
  }

  function handleRemoveTemplateSubtask(index: number) {
    setTemplateSubtasks(prev =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, position: i }))
    )
  }

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!templateTitle.trim()) return
    setTemplateError('')

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: templateTitle.trim(),
          priority: templatePriority,
          category: templateCategory.trim() || undefined,
          due_date_offset: templateOffset ? Number(templateOffset) : undefined,
          subtasks: templateSubtasks,
        }),
      })

      if (res.ok) {
        resetTemplateForm()
        await fetchTemplates()
      } else {
        const data = await res.json()
        setTemplateError(data.error || 'Failed to create template')
      }
    } catch {
      setTemplateError('Network error. Please try again.')
    }
  }

  function startEditTemplate(template: Template) {
    const subtasks: TemplateSubtask[] = JSON.parse(template.subtasks)
    setEditingTemplate(template)
    setTemplateTitle(template.title)
    setTemplatePriority(template.priority)
    setTemplateCategory(template.category ?? '')
    setTemplateOffset(template.due_date_offset !== null ? String(template.due_date_offset) : '')
    setTemplateSubtasks(subtasks)
    setTemplateError('')
  }

  async function handleUpdateTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTemplate || !templateTitle.trim()) return
    setTemplateError('')

    try {
      const res = await fetch(`/api/templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: templateTitle.trim(),
          priority: templatePriority,
          category: templateCategory.trim() || null,
          due_date_offset: templateOffset ? Number(templateOffset) : null,
          subtasks: templateSubtasks,
        }),
      })

      if (res.ok) {
        setEditingTemplate(null)
        resetTemplateForm()
        await fetchTemplates()
      } else {
        const data = await res.json()
        setTemplateError(data.error || 'Failed to update template')
      }
    } catch {
      setTemplateError('Network error. Please try again.')
    }
  }

  async function handleDeleteTemplate(templateId: number) {
    try {
      await fetch(`/api/templates/${templateId}`, { method: 'DELETE' })
      await fetchTemplates()
    } catch {
      // Failed — will reflect on next fetch
    }
  }

  async function handleUseTemplate(templateId: number) {
    try {
      const res = await fetch(`/api/templates/${templateId}/use`, {
        method: 'POST',
      })

      if (res.ok) {
        setShowTemplateModal(false)
        await fetchTodos()
      }
    } catch {
      // Failed — will reflect on next fetch
    }
  }

  // --- Filter & Classify ---

  const filteredTodos = todos.filter(todo => {
    // Text search filter — matches title, subtask title, or tag names (debounced)
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase()
      const titleMatch = todo.title.toLowerCase().includes(query)
      const subtaskMatch = todo.subtasks?.some(
        (s: { title: string }) => s.title.toLowerCase().includes(query)
      )
      const tagMatch = todo.tags?.some(
        (t: { name: string }) => t.name.toLowerCase().includes(query)
      )
      if (!titleMatch && !subtaskMatch && !tagMatch) return false
    }

    // Priority filter
    if (priorityFilter && todo.priority !== priorityFilter) return false

    // Tag filter
    if (tagFilter && !todo.tags?.some((t: { id: number }) => t.id === Number(tagFilter))) return false

    return true
  })

  const { overdue, pending, completed } = classifyTodos(filteredTodos)

  // --- Export/Import ---

  async function handleExport() {
    const res = await fetch('/api/todos/export')
    if (!res.ok) return

    const data = await res.json()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const now = new Date()
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
    const filename = `todos-export-${dateStr}.json`

    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const res = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const result = await res.json()
        setImportMessage({
          type: 'success',
          text: `Successfully imported ${result.imported} todos and ${result.tags_created} new tags`,
        })
        await fetchTodos()
        await fetchTags()
      } else {
        const error = await res.json()
        setImportMessage({
          type: 'error',
          text: error.error || 'Import failed',
        })
      }
    } catch {
      setImportMessage({
        type: 'error',
        text: 'Invalid file format. Please use a previously exported JSON file.',
      })
    }

    setTimeout(() => setImportMessage(null), 5000)
  }

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20">
              <span className="text-lg">✏️</span>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">
                My Todos
              </h1>
              {sessionUsername && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Welcome, {sessionUsername}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded-lg
                       text-gray-500 hover:text-gray-700 hover:bg-gray-100
                       dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800
                       transition-all"
          >
            Logout
          </button>
        </div>
        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                       glass-card text-gray-600 dark:text-gray-300
                       hover:shadow-md hover:-translate-y-0.5
                       active:translate-y-0 transition-all"
          >
            <span>📤</span> Export
          </button>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                       glass-card text-gray-600 dark:text-gray-300
                       hover:shadow-md hover:-translate-y-0.5
                       active:translate-y-0 transition-all"
          >
            <span>📥</span> Import
          </button>
          <button
            onClick={() => { setShowTemplateModal(true); resetTemplateForm(); setEditingTemplate(null) }}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                       glass-card text-gray-600 dark:text-gray-300
                       hover:shadow-md hover:-translate-y-0.5
                       active:translate-y-0 transition-all"
          >
            <span>📋</span> Templates
          </button>
          <a
            href="/calendar"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                       glass-card text-gray-600 dark:text-gray-300
                       hover:shadow-md hover:-translate-y-0.5
                       active:translate-y-0 transition-all"
          >
            <span>📅</span> Calendar
          </a>
          {typeof Notification !== 'undefined' && (
          isEnabled ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full
                             bg-emerald-50 text-emerald-600 font-medium border border-emerald-200
                             dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
              🔔 Notifications On
            </span>
          ) : (
            <button
              onClick={requestPermission}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full
                         bg-amber-50 text-amber-600 font-medium border border-amber-200
                         hover:bg-amber-100 cursor-pointer
                         dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800
                         dark:hover:bg-amber-900/30 transition-all"
            >
              🔔 Enable Notifications
            </button>
          )
        )}
        </div>
      </div>

      {/* Import Message */}
      {importMessage && (
        <div className={`mb-4 p-3 rounded-xl text-sm animate-slide-up ${
          importMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
            : 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
        }`}>
          {importMessage.text}
        </div>
      )}

      {/* Create Form */}
      <form onSubmit={handleAddTodo} aria-label="Create new todo" className="mb-8 glass-card rounded-2xl shadow-lg shadow-gray-200/40 dark:shadow-none p-5">
        {createError && (
          <div role="alert" className="mb-3 px-3 py-2 text-sm rounded-xl bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50 animate-fade-in">
            {createError}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="What needs to be done?"
            aria-label="Todo title"
            className="w-full border rounded-xl px-4 py-3 text-sm font-medium
                       border-gray-200 dark:border-gray-600
                       bg-white/60 dark:bg-gray-800/60
                       text-gray-900 dark:text-white
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
          <div className="flex gap-2 items-center">
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as Priority)}
              aria-label="Priority"
              className="border rounded-xl px-3 py-2.5 text-sm
                         border-gray-200 dark:border-gray-600
                         bg-white/60 dark:bg-gray-800/60
                         text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input
              type="datetime-local"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              aria-label="Due date"
              className="flex-1 border rounded-xl px-3 py-2.5 text-sm
                         border-gray-200 dark:border-gray-600
                         bg-white/60 dark:bg-gray-800/60
                         text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold
                         bg-gradient-to-r from-indigo-600 to-purple-600 text-white
                         shadow-md shadow-indigo-500/20
                         hover:shadow-lg hover:shadow-indigo-500/30 hover:from-indigo-500 hover:to-purple-500
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                         active:scale-[0.97] transition-all"
            >
              Add
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newIsRecurring}
                onChange={(e) => setNewIsRecurring(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600
                           text-purple-500 focus:ring-purple-500"
              />
              🔄 Repeat
            </label>
            {newIsRecurring && (
              <select
                value={newRecurrencePattern}
                onChange={(e) => setNewRecurrencePattern(e.target.value as RecurrencePattern)}
                className="border rounded-xl px-3 py-2 text-sm
                           border-gray-200 dark:border-gray-600
                           bg-white/60 dark:bg-gray-800/60
                           text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
            <select
              value={newReminderMinutes ?? ''}
              onChange={(e) => setNewReminderMinutes(e.target.value ? Number(e.target.value) : null)}
              disabled={!newDueDate}
              className="border rounded-xl px-3 py-2 text-sm
                         border-gray-200 dark:border-gray-600
                         bg-white/60 dark:bg-gray-800/60
                         text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="">🔔 None</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="120">2 hours before</option>
              <option value="1440">1 day before</option>
              <option value="2880">2 days before</option>
              <option value="10080">1 week before</option>
            </select>
          </div>
          {/* Tag Selection */}
          {tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">🏷️</span>
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTagSelection(tag.id, false)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    selectedTagIds.includes(tag.id)
                      ? 'ring-2 ring-offset-1 ring-blue-400'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    borderColor: `${tag.color}40`,
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </form>

      {/* Filter Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-2.5" role="search" aria-label="Filter todos">
        {/* Search input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search todos..."
            aria-label="Search todos"
            className="w-full border rounded-xl px-3 py-2.5 pl-9 text-sm
                       border-gray-200 dark:border-gray-600
                       bg-white/80 dark:bg-gray-800/80
                       text-gray-900 dark:text-white
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600
                         dark:hover:text-gray-300 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        <select
          data-testid="priority-filter"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label="Filter by priority"
          className="border rounded-xl px-3 py-2.5 text-sm
                     border-gray-200 dark:border-gray-600
                     bg-white/80 dark:bg-gray-800/80
                     text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
        >
          <option value="">All Priorities</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>
        <select
          data-testid="tag-filter"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          aria-label="Filter by tag"
          className="border rounded-xl px-3 py-2.5 text-sm
                     border-gray-200 dark:border-gray-600
                     bg-white/80 dark:bg-gray-800/80
                     text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
        >
          <option value="">All Tags</option>
          {tags.map(tag => (
            <option key={tag.id} value={tag.id}>
              🏷️ {tag.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => { setShowTagModal(true); setTagError('') }}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-xl
                     glass-card text-gray-600 dark:text-gray-300
                     hover:shadow-md hover:-translate-y-0.5
                     active:translate-y-0 transition-all"
        >
          🏷️ Tags
        </button>
      </div>

      {/* No results empty state */}
      {filteredTodos.length === 0 && (searchQuery || priorityFilter || tagFilter) && (
        <div className="text-center py-12 animate-fade-in">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-base font-medium text-gray-500 dark:text-gray-400">No todos match your filters</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try adjusting your search or filter criteria</p>
          <button
            onClick={() => {
              setSearchQuery('')
              setPriorityFilter('')
              setTagFilter('')
            }}
            className="mt-4 text-sm font-medium text-indigo-500 hover:text-indigo-600
                       dark:text-indigo-400 dark:hover:text-indigo-300
                       transition-colors"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Overdue Section */}
      {overdue.length > 0 && (
        <section className="mb-6 animate-slide-up">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">⚠️</span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-500 dark:text-red-400">
              Overdue
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {overdue.length}
            </span>
          </div>
          <div className="rounded-2xl bg-red-50/60 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-3 space-y-2">
            {overdue.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={handleToggleComplete}
                onEdit={openEditModal}
                onDelete={handleDeleteTodo}
                onTagFilter={(tagId) => setTagFilter(String(tagId))}
                isExpanded={expandedTodos.has(todo.id)}
                onToggleExpand={() => toggleSubtaskExpansion(todo.id)}
                onAddSubtask={() => handleAddSubtask(todo.id)}
                onToggleSubtask={toggleSubtask}
                onDeleteSubtask={deleteSubtask}
                subtaskTitle={newSubtaskTitle[todo.id] ?? ''}
                onSubtaskTitleChange={(v) => setNewSubtaskTitle(prev => ({ ...prev, [todo.id]: v }))}
              />
            ))}
          </div>
        </section>
      )}

      {/* Pending Section */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Active
          </h2>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            {pending.length}
          </span>
        </div>
        {pending.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-3xl mb-2">✨</div>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No pending todos. Add one above!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={handleToggleComplete}
                onEdit={openEditModal}
                onDelete={handleDeleteTodo}
                onTagFilter={(tagId) => setTagFilter(String(tagId))}
                isExpanded={expandedTodos.has(todo.id)}
                onToggleExpand={() => toggleSubtaskExpansion(todo.id)}
                onAddSubtask={() => handleAddSubtask(todo.id)}
                onToggleSubtask={toggleSubtask}
                onDeleteSubtask={deleteSubtask}
                subtaskTitle={newSubtaskTitle[todo.id] ?? ''}
                onSubtaskTitleChange={(v) => setNewSubtaskTitle(prev => ({ ...prev, [todo.id]: v }))}
              />
            ))}
          </div>
        )}
      </section>

      {/* Completed Section */}
      {completed.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Completed
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              {completed.length}
            </span>
          </div>
          <div className="space-y-2 opacity-60">
            {completed.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={handleToggleComplete}
                onEdit={openEditModal}
                onDelete={handleDeleteTodo}
                onTagFilter={(tagId) => setTagFilter(String(tagId))}
                isExpanded={expandedTodos.has(todo.id)}
                onToggleExpand={() => toggleSubtaskExpansion(todo.id)}
                onAddSubtask={() => handleAddSubtask(todo.id)}
                onToggleSubtask={toggleSubtask}
                onDeleteSubtask={deleteSubtask}
                subtaskTitle={newSubtaskTitle[todo.id] ?? ''}
                onSubtaskTitleChange={(v) => setNewSubtaskTitle(prev => ({ ...prev, [todo.id]: v }))}
              />
            ))}
          </div>
        </section>
      )}

      {/* Edit Modal */}
      {editingTodo && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setEditingTodo(null)}
        >
          <div
            className="glass-card rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Edit Todo</h3>

            {editError && (
              <div className="mb-4 px-3 py-2 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                {editError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm
                             bg-white/50 dark:bg-gray-700/50
                             border border-gray-200 dark:border-gray-600
                             text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Priority
                </label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as Priority)}
                  className="w-full rounded-xl px-3 py-2 text-sm
                             bg-white/50 dark:bg-gray-700/50
                             border border-gray-200 dark:border-gray-600
                             text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Due Date
                </label>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="flex-1 rounded-xl px-3 py-2 text-sm
                               bg-white/50 dark:bg-gray-700/50
                               border border-gray-200 dark:border-gray-600
                               text-gray-900 dark:text-white
                               focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                  />
                  {editDueDate && (
                    <button
                      type="button"
                      onClick={() => setEditDueDate('')}
                      className="px-3 py-2 text-xs rounded-xl border
                                 border-gray-200 dark:border-gray-600
                                 text-gray-600 dark:text-gray-400
                                 hover:bg-gray-100 dark:hover:bg-gray-700
                                 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsRecurring}
                    onChange={(e) => setEditIsRecurring(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600
                               text-purple-500 focus:ring-purple-500"
                  />
                  🔄 Repeat
                </label>
                {editIsRecurring && (
                  <select
                    value={editRecurrencePattern}
                    onChange={(e) => setEditRecurrencePattern(e.target.value as RecurrencePattern)}
                    className="mt-2 w-full rounded-xl px-3 py-2 text-sm
                               bg-white/50 dark:bg-gray-700/50
                               border border-gray-200 dark:border-gray-600
                               text-gray-900 dark:text-white
                               focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Reminder
                </label>
                <select
                  value={editReminderMinutes ?? ''}
                  onChange={(e) => setEditReminderMinutes(e.target.value ? Number(e.target.value) : null)}
                  disabled={!editDueDate}
                  className="w-full rounded-xl px-3 py-2 text-sm
                             bg-white/50 dark:bg-gray-700/50
                             border border-gray-200 dark:border-gray-600
                             text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-indigo-400/50
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">🔔 None</option>
                  <option value="15">15 minutes before</option>
                  <option value="30">30 minutes before</option>
                  <option value="60">1 hour before</option>
                  <option value="120">2 hours before</option>
                  <option value="1440">1 day before</option>
                  <option value="2880">2 days before</option>
                  <option value="10080">1 week before</option>
                </select>
              </div>
              {/* Tags */}
              {tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Tags
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTagSelection(tag.id, true)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          editSelectedTagIds.includes(tag.id)
                            ? 'ring-2 ring-offset-1 ring-blue-400'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                          borderColor: `${tag.color}40`,
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setEditingTodo(null)}
                className="px-4 py-2 text-sm rounded-xl border
                           border-gray-200 dark:border-gray-600
                           text-gray-700 dark:text-gray-300
                           hover:bg-gray-100 dark:hover:bg-gray-700
                           transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTodo}
                disabled={!editTitle.trim()}
                className="px-4 py-2 text-sm rounded-xl font-medium text-white
                           bg-gradient-to-r from-indigo-500 to-purple-500
                           hover:from-indigo-600 hover:to-purple-600
                           shadow-md shadow-indigo-500/25
                           disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Management Modal */}
      {showTagModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setShowTagModal(false)}
        >
          <div
            className="glass-card rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Manage Tags</h3>

            {tagError && (
              <div className="mb-4 px-3 py-2 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                {tagError}
              </div>
            )}

            {/* Create tag form */}
            <form onSubmit={handleCreateTag} className="mb-4">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="New tag name..."
                  className="flex-1 rounded-xl px-3 py-2 text-sm
                             bg-white/50 dark:bg-gray-700/50
                             border border-gray-200 dark:border-gray-600
                             text-gray-900 dark:text-white
                             placeholder-gray-400 dark:placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                />
                <button
                  type="submit"
                  disabled={!newTagName.trim()}
                  className="px-3 py-2 text-sm rounded-xl font-medium text-white
                             bg-gradient-to-r from-indigo-500 to-purple-500
                             hover:from-indigo-600 hover:to-purple-600
                             shadow-md shadow-indigo-500/25
                             disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Add
                </button>
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {TAG_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      newTagColor === color ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </form>

            {/* Tag list */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tags.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                  No tags yet. Create one above!
                </p>
              ) : (
                tags.map(tag => (
                  <div key={tag.id} className="flex items-center gap-2 group">
                    {editingTag?.id === tag.id ? (
                      <>
                        <input
                          type="text"
                          value={editTagName}
                          onChange={(e) => setEditTagName(e.target.value)}
                          className="flex-1 rounded-xl px-2 py-1 text-sm
                                     bg-white/50 dark:bg-gray-700/50
                                     border border-gray-200 dark:border-gray-600
                                     text-gray-900 dark:text-white
                                     focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                        />
                        <div className="flex gap-1">
                          {TAG_COLORS.map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setEditTagColor(color)}
                              className={`w-4 h-4 rounded-full border ${
                                editTagColor === color ? 'border-gray-900 dark:border-white' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <button
                          onClick={handleUpdateTag}
                          className="text-xs px-2 py-1 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white
                                     hover:from-indigo-600 hover:to-purple-600 transition-all"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingTag(null)}
                          className="text-xs px-2 py-1 rounded border
                                     border-gray-300 dark:border-gray-600
                                     text-gray-600 dark:text-gray-400
                                     hover:bg-gray-100 dark:hover:bg-gray-700
                                     transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 text-sm text-gray-900 dark:text-white">
                          {tag.name}
                        </span>
                        <button
                          onClick={() => {
                            setEditingTag(tag)
                            setEditTagName(tag.name)
                            setEditTagColor(tag.color)
                            setTagError('')
                          }}
                          className="text-xs text-gray-500 dark:text-gray-400
                                     opacity-0 group-hover:opacity-100
                                     hover:text-blue-500 dark:hover:text-blue-400
                                     transition-opacity px-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="text-xs text-red-500 dark:text-red-400
                                     opacity-0 group-hover:opacity-100
                                     hover:text-red-700 dark:hover:text-red-300
                                     transition-opacity px-1"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowTagModal(false)}
                className="px-4 py-2 text-sm rounded-xl border
                           border-gray-200 dark:border-gray-600
                           text-gray-700 dark:text-gray-300
                           hover:bg-gray-100 dark:hover:bg-gray-700
                           transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="glass-card rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {editingTemplate ? 'Edit Template' : 'Templates'}
            </h3>

            {templateError && (
              <div className="mb-4 px-3 py-2 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                {templateError}
              </div>
            )}

            {/* Template form */}
            <form onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate} className="mb-4 space-y-3">
              <input
                type="text"
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                placeholder="Template title"
                className="w-full rounded-xl px-3 py-2 text-sm
                           bg-white/50 dark:bg-gray-700/50
                           border border-gray-200 dark:border-gray-600
                           text-gray-900 dark:text-white
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
              />
              <div className="flex gap-2">
                <select
                  value={templatePriority}
                  onChange={(e) => setTemplatePriority(e.target.value as Priority)}
                  className="rounded-xl px-3 py-2 text-sm
                             bg-white/50 dark:bg-gray-700/50
                             border border-gray-200 dark:border-gray-600
                             text-gray-900 dark:text-white
                             focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <input
                  type="text"
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                  placeholder="Category (optional)"
                  className="flex-1 rounded-xl px-3 py-2 text-sm
                             bg-white/50 dark:bg-gray-700/50
                             border border-gray-200 dark:border-gray-600
                             text-gray-900 dark:text-white
                             placeholder-gray-400 dark:placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                />
                <input
                  type="number"
                  value={templateOffset}
                  onChange={(e) => setTemplateOffset(e.target.value)}
                  placeholder="Days"
                  min="0"
                  className="w-20 rounded-xl px-3 py-2 text-sm
                             bg-white/50 dark:bg-gray-700/50
                             border border-gray-200 dark:border-gray-600
                             text-gray-900 dark:text-white
                             placeholder-gray-400 dark:placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                />
              </div>

              {/* Template subtasks */}
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={templateSubtaskInput}
                    onChange={(e) => setTemplateSubtaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddTemplateSubtask()
                      }
                    }}
                    placeholder="Add subtask..."
                    className="flex-1 rounded-xl px-3 py-1.5 text-sm
                               bg-white/50 dark:bg-gray-700/50
                               border border-gray-200 dark:border-gray-600
                               text-gray-900 dark:text-white
                               placeholder-gray-400 dark:placeholder-gray-500
                               focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                  />
                  <button
                    type="button"
                    onClick={handleAddTemplateSubtask}
                    disabled={!templateSubtaskInput.trim()}
                    className="px-3 py-1.5 text-xs rounded-xl font-medium text-white
                               bg-gradient-to-r from-indigo-500 to-purple-500
                               hover:from-indigo-600 hover:to-purple-600
                               shadow-md shadow-indigo-500/25
                               disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Add
                  </button>
                </div>
                {templateSubtasks.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {templateSubtasks.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="text-gray-400 text-xs w-4">{i + 1}.</span>
                        <span className="flex-1">{s.title}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTemplateSubtask(i)}
                          className="text-xs text-red-500 dark:text-red-400
                                     hover:text-red-700 dark:hover:text-red-300 px-1"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!templateTitle.trim()}
                  className="px-4 py-2 text-sm rounded-xl font-medium text-white
                             bg-gradient-to-r from-indigo-500 to-purple-500
                             hover:from-indigo-600 hover:to-purple-600
                             shadow-md shadow-indigo-500/25
                             disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {editingTemplate ? 'Update Template' : 'Save Template'}
                </button>
                {editingTemplate && (
                  <button
                    type="button"
                    onClick={() => { setEditingTemplate(null); resetTemplateForm() }}
                    className="px-4 py-2 text-sm rounded-xl border
                               border-gray-200 dark:border-gray-600
                               text-gray-700 dark:text-gray-300
                               hover:bg-gray-100 dark:hover:bg-gray-700
                               transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* Template list grouped by category */}
            {!editingTemplate && (
              <div className="space-y-4">
                {templates.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                    No templates yet. Create one above!
                  </p>
                ) : (
                  (() => {
                    const grouped = templates.reduce<Record<string, Template[]>>((acc, t) => {
                      const key = t.category || ''
                      return {
                        ...acc,
                        [key]: [...(acc[key] || []), t],
                      }
                    }, {})

                    const sortedKeys = Object.keys(grouped).sort((a, b) => {
                      if (a === '') return 1
                      if (b === '') return -1
                      return a.localeCompare(b)
                    })

                    return sortedKeys.map(category => (
                      <div key={category}>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                          {category || 'Uncategorized'}
                        </h4>
                        <div className="space-y-2">
                          {grouped[category].map(template => {
                            const subtasks: TemplateSubtask[] = JSON.parse(template.subtasks)
                            const colors = PRIORITY_COLORS[template.priority]
                            return (
                              <div
                                key={template.id}
                                className="flex items-center gap-3 p-3 bg-white/40 dark:bg-gray-700/30 border border-gray-200/60 dark:border-gray-600/60 rounded-xl hover:bg-white/60 dark:hover:bg-gray-700/50 transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {template.title}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                                      {template.priority.charAt(0).toUpperCase() + template.priority.slice(1)}
                                    </span>
                                  </div>
                                  <div className="flex gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {template.due_date_offset !== null && (
                                      <span>Due in {template.due_date_offset} day{template.due_date_offset !== 1 ? 's' : ''}</span>
                                    )}
                                    {subtasks.length > 0 && (
                                      <span>{subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    onClick={() => handleUseTemplate(template.id)}
                                    className="text-xs px-2.5 py-1 rounded-lg font-medium text-white
                                               bg-gradient-to-r from-emerald-500 to-green-500
                                               hover:from-emerald-600 hover:to-green-600
                                               shadow-sm shadow-emerald-500/25
                                               transition-all"
                                  >
                                    Use
                                  </button>
                                  <button
                                    onClick={() => startEditTemplate(template)}
                                    className="text-xs px-2 py-1 rounded-lg border
                                               border-gray-200 dark:border-gray-600
                                               text-gray-600 dark:text-gray-400
                                               hover:bg-gray-100 dark:hover:bg-gray-700
                                               transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTemplate(template.id)}
                                    className="text-xs px-2 py-1 rounded-lg border
                                               border-red-200 dark:border-red-700
                                               text-red-600 dark:text-red-400
                                               hover:bg-red-50 dark:hover:bg-red-900/20
                                               transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  })()
                )}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 text-sm rounded-xl border
                           border-gray-200 dark:border-gray-600
                           text-gray-700 dark:text-gray-300
                           hover:bg-gray-100 dark:hover:bg-gray-700
                           transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
