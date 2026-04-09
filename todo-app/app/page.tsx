'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, type CSSProperties, useEffect, useMemo, useState } from 'react';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { useTheme } from '@/lib/hooks/useTheme';
import { formatSingaporeDate, getSingaporeNow, toDatetimeLocalValue } from '@/lib/timezone';
import type { Tag, Template, Todo } from '@/lib/db';

type User = { userId: number; username: string };
type FilterPreset = {
  id: string;
  name: string;
  search: string;
  priority: 'all' | 'high' | 'medium' | 'low';
  tagId: 'all' | number;
  completion: 'all' | 'complete' | 'incomplete';
  dueDateFrom: string;
  dueDateTo: string;
};

type TodoFormState = {
  title: string;
  priority: 'high' | 'medium' | 'low';
  due_date: string;
  is_recurring: boolean;
  recurrence_pattern: '' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  reminder_minutes: '' | number;
  tagIds: number[];
};

const defaultForm: TodoFormState = {
  title: '',
  priority: 'medium',
  due_date: '',
  is_recurring: false,
  recurrence_pattern: '',
  reminder_minutes: '',
  tagIds: [],
};

const reminderOptions = [
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
  { value: 10080, label: '1 week before' },
];

function sectionize(todos: Todo[]) {
  const now = getSingaporeNow().getTime();
  return {
    overdue: todos.filter((todo) => todo.completed === 0 && todo.due_date && new Date(todo.due_date).getTime() < now),
    active: todos.filter((todo) => !(todo.completed === 0 && todo.due_date && new Date(todo.due_date).getTime() < now) && todo.completed === 0),
    completed: todos.filter((todo) => todo.completed === 1),
  };
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState<TodoFormState>(defaultForm);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [tagFilter, setTagFilter] = useState<'all' | number>('all');
  const [completionFilter, setCompletionFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [savedFilters, setSavedFilters] = useState<FilterPreset[]>([]);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tagDraft, setTagDraft] = useState({ name: '', color: '#3B82F6' });
  const [templateDraft, setTemplateDraft] = useState({ name: '', description: '', category: '' });
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editForm, setEditForm] = useState<TodoFormState>(defaultForm);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all');
  const { theme, toggleTheme } = useTheme();

  useNotifications(notificationEnabled);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const saved = window.localStorage.getItem('todo-filter-presets');
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved) as FilterPreset[]);
      } catch {
        window.localStorage.removeItem('todo-filter-presets');
      }
    }
  }, []);

  useEffect(() => {
    document.body.dataset.todoAppLoaded = 'false';
    void Promise.all([
      fetch('/api/auth/me', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('Unauthorized');
        const data = (await response.json()) as { user: User };
        setUser(data.user);
      }),
      refreshTodos(),
      refreshTags(),
      refreshTemplates(),
    ])
      .then(() => {
        document.body.dataset.todoAppLoaded = 'true';
      })
      .catch(() => router.replace('/login'));

    return () => {
      delete document.body.dataset.todoAppLoaded;
    };
  }, [router]);

  async function refreshTodos() {
    const response = await fetch('/api/todos', { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { todos: Todo[] };
    setTodos(data.todos);
  }

  async function refreshTags() {
    const response = await fetch('/api/tags', { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { tags: Tag[] };
    setTags(data.tags);
  }

  async function refreshTemplates() {
    const response = await fetch('/api/templates', { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { templates: Template[] };
    setTemplates(data.templates);
  }

  const filteredTodos = useMemo(() => {
    return todos.filter((todo) => {
      const tagNames = (todo.tags ?? []).map((tag) => tag.name.toLowerCase());
      const subtaskTitles = (todo.subtasks ?? []).map((subtask) => subtask.title.toLowerCase());
      const haystack = [todo.title.toLowerCase(), ...tagNames, ...subtaskTitles].join(' ');
      if (search && !haystack.includes(search)) return false;
      if (priorityFilter !== 'all' && todo.priority !== priorityFilter) return false;
      if (tagFilter !== 'all' && !(todo.tags ?? []).some((tag) => tag.id === tagFilter)) return false;
      if (completionFilter === 'complete' && todo.completed !== 1) return false;
      if (completionFilter === 'incomplete' && todo.completed !== 0) return false;
      if (dueDateFrom && (!todo.due_date || todo.due_date.slice(0, 10) < dueDateFrom)) return false;
      if (dueDateTo && (!todo.due_date || todo.due_date.slice(0, 10) > dueDateTo)) return false;
      return true;
    });
  }, [todos, search, priorityFilter, tagFilter, completionFilter, dueDateFrom, dueDateTo]);

  const sections = useMemo(() => sectionize(filteredTodos), [filteredTodos]);
  const visibleTemplates = useMemo(
    () => templates.filter((template) => templateCategoryFilter === 'all' || (template.category ?? 'uncategorized') === templateCategoryFilter),
    [templateCategoryFilter, templates],
  );
  const templateCategories = useMemo(
    () => Array.from(new Set(templates.map((template) => template.category?.trim() || 'uncategorized'))),
    [templates],
  );
  const hasActiveFilters =
    searchInput !== '' || priorityFilter !== 'all' || tagFilter !== 'all' || completionFilter !== 'all' || dueDateFrom !== '' || dueDateTo !== '';

  async function createTodo(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          priority: form.priority,
          due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
          is_recurring: form.is_recurring,
          recurrence_pattern: form.is_recurring ? form.recurrence_pattern || null : null,
          reminder_minutes: form.reminder_minutes === '' ? null : Number(form.reminder_minutes),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to create todo');
      const todo = data.todo as Todo;
      if (form.tagIds.length > 0) {
        await fetch(`/api/todos/${todo.id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagIds: form.tagIds }),
        });
      }
      setForm(defaultForm);
      await refreshTodos();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create todo');
    } finally {
      setLoading(false);
    }
  }

  async function toggleTodo(todo: Todo) {
    await fetch(`/api/todos/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: todo.completed !== 1 }),
    });
    await refreshTodos();
  }

  async function deleteTodo(todo: Todo) {
    if (!window.confirm(`Delete "${todo.title}"?`)) return;
    await fetch(`/api/todos/${todo.id}`, { method: 'DELETE' });
    await refreshTodos();
  }

  function openTodoEditor(todo: Todo) {
    setEditingTodo(todo);
    setEditForm({
      title: todo.title,
      priority: todo.priority,
      due_date: toDatetimeLocalValue(todo.due_date),
      is_recurring: todo.is_recurring === 1,
      recurrence_pattern: todo.recurrence_pattern ?? '',
      reminder_minutes: todo.reminder_minutes ?? '',
      tagIds: (todo.tags ?? []).map((tag) => tag.id),
    });
  }

  async function updateTodo(event: FormEvent) {
    event.preventDefault();
    if (!editingTodo) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/todos/${editingTodo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          priority: editForm.priority,
          due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null,
          is_recurring: editForm.is_recurring,
          recurrence_pattern: editForm.is_recurring ? editForm.recurrence_pattern || null : null,
          reminder_minutes: editForm.reminder_minutes === '' ? null : Number(editForm.reminder_minutes),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Failed to update todo');
      await fetch(`/api/todos/${editingTodo.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: editForm.tagIds }),
      });
      setEditingTodo(null);
      await refreshTodos();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update todo');
    } finally {
      setLoading(false);
    }
  }

  async function addSubtask(todoId: number, title: string) {
    if (!title.trim()) return;
    await fetch(`/api/todos/${todoId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    await refreshTodos();
  }

  async function toggleSubtask(subtaskId: number, completed: boolean) {
    await fetch(`/api/subtasks/${subtaskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed }),
    });
    await refreshTodos();
  }

  async function deleteSubtask(subtaskId: number) {
    await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
    await refreshTodos();
  }

  async function createTag(event: FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tagDraft),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? 'Failed to create tag');
      return;
    }
    setTagDraft({ name: '', color: '#3B82F6' });
    await refreshTags();
  }

  async function editTag(tag: Tag) {
    const name = window.prompt('Tag name', tag.name)?.trim();
    if (!name) return;
    const color = window.prompt('Hex color', tag.color)?.trim();
    if (!color) return;
    const response = await fetch(`/api/tags/${tag.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? 'Failed to update tag');
      return;
    }
    await refreshTags();
    await refreshTodos();
  }

  async function removeTag(tag: Tag) {
    if (!window.confirm(`Delete tag "${tag.name}"?`)) return;
    await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' });
    await refreshTags();
    await refreshTodos();
  }

  async function saveTemplate() {
    if (!form.title.trim() || !templateDraft.name.trim()) return;
    const dueOffset = form.due_date
      ? Math.max(1, Math.round((new Date(form.due_date).getTime() - getSingaporeNow().getTime()) / 60000))
      : null;
    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: templateDraft.name,
        description: templateDraft.description || null,
        category: templateDraft.category || null,
        title_template: form.title,
        priority: form.priority,
        is_recurring: form.is_recurring,
        recurrence_pattern: form.recurrence_pattern || null,
        reminder_minutes: form.reminder_minutes === '' ? null : Number(form.reminder_minutes),
        due_date_offset_minutes: dueOffset,
        subtasks_json: JSON.stringify([]),
      }),
    });
    setTemplateDraft({ name: '', description: '', category: '' });
    await refreshTemplates();
  }

  async function useTemplate(templateId: number) {
    await fetch(`/api/templates/${templateId}/use`, { method: 'POST' });
    await refreshTodos();
  }

  async function editTemplate(template: Template) {
    const name = window.prompt('Template name', template.name)?.trim();
    if (!name) return;
    const description = window.prompt('Description', template.description ?? '') ?? '';
    const category = window.prompt('Category', template.category ?? '') ?? '';
    const response = await fetch(`/api/templates/${template.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, category }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? 'Failed to update template');
      return;
    }
    await refreshTemplates();
  }

  async function deleteTemplate(template: Template) {
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    await fetch(`/api/templates/${template.id}`, { method: 'DELETE' });
    await refreshTemplates();
  }

  function saveCurrentFilter() {
    const name = window.prompt('Preset name');
    if (!name) return;
    const next = [
      ...savedFilters,
      { id: crypto.randomUUID(), name, search: searchInput, priority: priorityFilter, tagId: tagFilter, completion: completionFilter, dueDateFrom, dueDateTo },
    ];
    setSavedFilters(next);
    window.localStorage.setItem('todo-filter-presets', JSON.stringify(next));
  }

  function applyPreset(preset: FilterPreset) {
    setSearchInput(preset.search);
    setPriorityFilter(preset.priority);
    setTagFilter(preset.tagId);
    setCompletionFilter(preset.completion);
    setDueDateFrom(preset.dueDateFrom);
    setDueDateTo(preset.dueDateTo);
  }

  function deletePreset(id: string) {
    const next = savedFilters.filter((preset) => preset.id !== id);
    setSavedFilters(next);
    window.localStorage.setItem('todo-filter-presets', JSON.stringify(next));
  }

  async function enableNotifications() {
    const permission = await Notification.requestPermission();
    setNotificationEnabled(permission === 'granted');
  }

  async function exportTodos() {
    const response = await fetch('/api/todos/export');
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `todos-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importTodos(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const response = await fetch('/api/todos/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: text,
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? 'Import failed');
      return;
    }
    await Promise.all([refreshTodos(), refreshTags()]);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  }

  return (
    <main style={{ padding: 'clamp(16px, 4vw, 24px)', maxWidth: 1320, margin: '0 auto' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <p style={{ margin: 0, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>Todo App</p>
          <h1 style={{ margin: '8px 0 4px', fontSize: 'clamp(2rem, 6vw, 2.75rem)', lineHeight: 1.05 }}>Daily Work, In Singapore Time</h1>
          <p style={{ margin: 0, color: 'var(--muted)' }}>Welcome back{user ? `, ${user.username}` : ''}. Build, filter, export, and schedule with passkey-backed access.</p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: 'min(100%, 640px)' }}>
          <button onClick={toggleTheme} type="button" style={ghostButtonStyle}>
            {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
          </button>
          <button onClick={() => void enableNotifications()} style={ghostButtonStyle}>
            {notificationEnabled ? 'Notifications On' : 'Enable Notifications'}
          </button>
          <Link href="/calendar" style={{ ...ghostButtonStyle, display: 'inline-flex', alignItems: 'center' }}>
            Calendar
          </Link>
          <button onClick={() => void exportTodos()} style={ghostButtonStyle}>Export</button>
          <label style={{ ...ghostButtonStyle, display: 'inline-flex', alignItems: 'center' }}>
            Import
            <input type="file" accept="application/json" hidden onChange={(event) => void importTodos(event)} />
          </label>
          <button onClick={() => void logout()} style={{ ...ghostButtonStyle, borderColor: 'color-mix(in srgb, var(--danger) 45%, var(--border))' }}>
            Logout
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20, alignItems: 'start' }}>
        <section style={panelStyle}>
          <form onSubmit={(event) => void createTodo(event)} style={{ display: 'grid', gap: 14 }}>
            <h2 style={{ margin: 0 }}>Create Todo</h2>
            <input
              aria-label="Todo title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="What needs doing?"
              style={inputStyle}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <select
                aria-label="Todo priority"
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TodoFormState['priority'] }))}
                style={inputStyle}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <input
                aria-label="Todo due date"
                type="datetime-local"
                value={form.due_date}
                onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
                style={inputStyle}
              />
              <select
                aria-label="Todo reminder"
                value={form.reminder_minutes === '' ? '' : String(form.reminder_minutes)}
                disabled={!form.due_date}
                onChange={(event) => setForm((current) => ({ ...current, reminder_minutes: event.target.value === '' ? '' : Number(event.target.value) }))}
                style={inputStyle}
              >
                <option value="">No reminder</option>
                {reminderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={form.is_recurring} onChange={(event) => setForm((current) => ({ ...current, is_recurring: event.target.checked }))} />
                Repeat
              </label>
              {form.is_recurring ? (
                <select
                  aria-label="Recurrence pattern"
                  value={form.recurrence_pattern}
                  onChange={(event) => setForm((current) => ({ ...current, recurrence_pattern: event.target.value as TodoFormState['recurrence_pattern'] }))}
                  style={{ ...inputStyle, maxWidth: 220 }}
                >
                  <option value="">Pattern</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              ) : null}
            </div>
            {tags.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {tags.map((tag) => {
                  const selected = form.tagIds.includes(tag.id);
                  return (
                    <button
                    type="button"
                    key={tag.id}
                    onClick={() => setForm((current) => ({ ...current, tagIds: selected ? current.tagIds.filter((id) => id !== tag.id) : [...current.tagIds, tag.id] }))}
                    aria-label={`${selected ? 'Remove' : 'Add'} tag ${tag.name}`}
                    style={{ borderRadius: 999, border: `1px solid ${tag.color}`, background: selected ? tag.color : 'transparent', color: selected ? '#fff' : 'var(--text)', padding: '0.45rem 0.8rem' }}
                  >
                      {selected ? '✓ ' : ''}
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {error ? <p style={{ margin: 0, color: 'var(--danger)' }}>{error}</p> : null}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="submit" disabled={loading} style={primaryButtonStyle}>
                {loading ? 'Adding...' : 'Add Todo'}
              </button>
              <input
                aria-label="Template name"
                value={templateDraft.name}
                onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Template name"
                style={{ ...inputStyle, maxWidth: 220 }}
              />
              <button type="button" onClick={() => void saveTemplate()} style={ghostButtonStyle}>
                Save as Template
              </button>
            </div>
          </form>
        </section>
        <aside style={{ display: 'grid', gap: 20 }}>
          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Manage Tags</h2>
            <form onSubmit={(event) => void createTag(event)} style={{ display: 'grid', gap: 10 }}>
              <input value={tagDraft.name} onChange={(event) => setTagDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Tag name" style={inputStyle} />
              <input value={tagDraft.color} onChange={(event) => setTagDraft((current) => ({ ...current, color: event.target.value }))} type="color" style={{ ...inputStyle, minHeight: 48 }} />
              <button type="submit" style={primaryButtonStyle}>Create Tag</button>
            </form>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {tags.map((tag) => (
                <span key={tag.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    aria-label={`Filter by tag ${tag.name}`}
                    onClick={() => setTagFilter(tag.id)}
                    style={{ borderRadius: 999, border: 0, background: tag.color, color: '#fff', padding: '0.45rem 0.8rem' }}
                  >
                    {tag.name}
                  </button>
                  <button type="button" onClick={() => void editTag(tag)} style={{ ...ghostButtonStyle, padding: '0.45rem 0.6rem' }}>
                    Edit
                  </button>
                  <button type="button" onClick={() => void removeTag(tag)} style={{ ...ghostButtonStyle, padding: '0.45rem 0.6rem' }}>
                    Delete
                  </button>
                </span>
              ))}
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Templates</h2>
            <select value={templateCategoryFilter} onChange={(event) => setTemplateCategoryFilter(event.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>
              <option value="all">All Categories</option>
              {templateCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <div style={{ display: 'grid', gap: 10 }}>
              {visibleTemplates.length === 0 ? <p style={{ color: 'var(--muted)', margin: 0 }}>No templates yet.</p> : null}
              {visibleTemplates.map((template) => (
                <div key={template.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 12 }}>
                  <strong>{template.name}</strong>
                  <p style={{ margin: '6px 0', color: 'var(--muted)' }}>{template.description || template.title_template}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <Badge label={template.priority} tone={template.priority === 'high' ? '#dc2626' : template.priority === 'medium' ? '#d97706' : '#2563eb'} />
                    {(template.category ?? '').trim() ? <Badge label={template.category ?? ''} tone="#334155" /> : null}
                    {template.is_recurring === 1 && template.recurrence_pattern ? <Badge label={`repeat ${template.recurrence_pattern}`} tone="#7c3aed" /> : null}
                    {template.reminder_minutes ? <Badge label={`reminder ${template.reminder_minutes}m`} tone="#0f766e" /> : null}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => void useTemplate(template.id)} style={ghostButtonStyle}>
                      Use Template
                    </button>
                    <button type="button" onClick={() => void editTemplate(template)} style={ghostButtonStyle}>
                      Edit
                    </button>
                    <button type="button" onClick={() => void deleteTemplate(template)} style={ghostButtonStyle}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section style={{ ...panelStyle, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Search & Filters</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search todos, subtasks, and tags..." style={{ ...inputStyle, gridColumn: '1 / -1' }} />
          <select aria-label="Filter priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)} style={inputStyle}>
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select aria-label="Filter tag" value={tagFilter === 'all' ? 'all' : String(tagFilter)} onChange={(event) => setTagFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))} style={inputStyle}>
            <option value="all">All Tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          <select aria-label="Filter completion" value={completionFilter} onChange={(event) => setCompletionFilter(event.target.value as typeof completionFilter)} style={inputStyle}>
            <option value="all">All Todos</option>
            <option value="incomplete">Incomplete</option>
            <option value="complete">Completed</option>
          </select>
          <input aria-label="Filter due date from" type="date" value={dueDateFrom} onChange={(event) => setDueDateFrom(event.target.value)} style={inputStyle} />
          <input aria-label="Filter due date to" type="date" value={dueDateTo} onChange={(event) => setDueDateTo(event.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
          {hasActiveFilters ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setPriorityFilter('all');
                  setTagFilter('all');
                  setCompletionFilter('all');
                  setDueDateFrom('');
                  setDueDateTo('');
                }}
                style={ghostButtonStyle}
              >
                Clear All
              </button>
              <button type="button" onClick={saveCurrentFilter} style={primaryButtonStyle}>
                Save Filter
              </button>
            </>
          ) : null}
          {savedFilters.map((preset) => (
            <span key={preset.id} style={{ display: 'inline-flex', gap: 6, border: '1px solid var(--border)', borderRadius: 999, padding: '0.3rem 0.45rem' }}>
              <button type="button" onClick={() => applyPreset(preset)} style={{ border: 0, background: 'transparent', color: 'var(--text)' }}>
                {preset.name}
              </button>
              <button type="button" onClick={() => deletePreset(preset.id)} style={{ border: 0, background: 'transparent', color: 'var(--danger)' }}>
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gap: 20, marginTop: 20 }}>
        <TodoSection title={`Overdue (${sections.overdue.length})`} todos={sections.overdue} onToggle={toggleTodo} onDelete={deleteTodo} onEdit={openTodoEditor} onAddSubtask={addSubtask} onToggleSubtask={toggleSubtask} onDeleteSubtask={deleteSubtask} onTagClick={(tagId) => setTagFilter(tagId)} />
        <TodoSection title={`Active (${sections.active.length})`} todos={sections.active} onToggle={toggleTodo} onDelete={deleteTodo} onEdit={openTodoEditor} onAddSubtask={addSubtask} onToggleSubtask={toggleSubtask} onDeleteSubtask={deleteSubtask} onTagClick={(tagId) => setTagFilter(tagId)} />
        <TodoSection title={`Completed (${sections.completed.length})`} todos={sections.completed} onToggle={toggleTodo} onDelete={deleteTodo} onEdit={openTodoEditor} onAddSubtask={addSubtask} onToggleSubtask={toggleSubtask} onDeleteSubtask={deleteSubtask} onTagClick={(tagId) => setTagFilter(tagId)} />
        {filteredTodos.length === 0 ? (
          <section style={panelStyle}>
            <p style={{ margin: 0, color: 'var(--muted)' }}>No todos match the current filters.</p>
          </section>
        ) : null}
      </div>

      {editingTodo ? (
        <div style={modalBackdropStyle}>
          <form onSubmit={(event) => void updateTodo(event)} style={{ ...panelStyle, width: 'min(100%, 640px)', maxHeight: 'min(90vh, 760px)', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>Edit Todo</h2>
            <input aria-label="Edit todo title" value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} style={inputStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}>
              <select
                aria-label="Edit todo priority"
                value={editForm.priority}
                onChange={(event) => setEditForm((current) => ({ ...current, priority: event.target.value as TodoFormState['priority'] }))}
                style={inputStyle}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <input
                aria-label="Edit todo due date"
                type="datetime-local"
                value={editForm.due_date}
                onChange={(event) => setEditForm((current) => ({ ...current, due_date: event.target.value }))}
                style={inputStyle}
              />
              <select
                aria-label="Edit todo reminder"
                value={editForm.reminder_minutes === '' ? '' : String(editForm.reminder_minutes)}
                disabled={!editForm.due_date}
                onChange={(event) => setEditForm((current) => ({ ...current, reminder_minutes: event.target.value === '' ? '' : Number(event.target.value) }))}
                style={inputStyle}
              >
                <option value="">No reminder</option>
                {reminderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={editForm.is_recurring} onChange={(event) => setEditForm((current) => ({ ...current, is_recurring: event.target.checked }))} />
                Repeat
              </label>
              {editForm.is_recurring ? (
                <select
                  aria-label="Edit recurrence pattern"
                  value={editForm.recurrence_pattern}
                  onChange={(event) => setEditForm((current) => ({ ...current, recurrence_pattern: event.target.value as TodoFormState['recurrence_pattern'] }))}
                  style={{ ...inputStyle, maxWidth: 220 }}
                >
                  <option value="">Pattern</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {tags.map((tag) => {
                const selected = editForm.tagIds.includes(tag.id);
                return (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => setEditForm((current) => ({ ...current, tagIds: selected ? current.tagIds.filter((id) => id !== tag.id) : [...current.tagIds, tag.id] }))}
                    aria-label={`${selected ? 'Remove' : 'Add'} edit tag ${tag.name}`}
                    style={{ borderRadius: 999, border: `1px solid ${tag.color}`, background: selected ? tag.color : 'transparent', color: selected ? '#fff' : 'var(--text)', padding: '0.45rem 0.8rem' }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setEditingTodo(null)} style={ghostButtonStyle}>
                Cancel
              </button>
              <button type="submit" style={primaryButtonStyle}>
                Save Changes
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function TodoSection({
  title,
  todos,
  onToggle,
  onDelete,
  onEdit,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onTagClick,
}: {
  title: string;
  todos: Todo[];
  onToggle: (todo: Todo) => Promise<void>;
  onDelete: (todo: Todo) => Promise<void>;
  onEdit: (todo: Todo) => void;
  onAddSubtask: (todoId: number, title: string) => Promise<void>;
  onToggleSubtask: (subtaskId: number, completed: boolean) => Promise<void>;
  onDeleteSubtask: (subtaskId: number) => Promise<void>;
  onTagClick: (tagId: number) => void;
}) {
  return (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div style={{ display: 'grid', gap: 14 }}>
        {todos.map((todo) => (
          <TodoCard key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} onEdit={onEdit} onAddSubtask={onAddSubtask} onToggleSubtask={onToggleSubtask} onDeleteSubtask={onDeleteSubtask} onTagClick={onTagClick} />
        ))}
      </div>
    </section>
  );
}

function TodoCard({
  todo,
  onToggle,
  onDelete,
  onEdit,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onTagClick,
}: {
  todo: Todo;
  onToggle: (todo: Todo) => Promise<void>;
  onDelete: (todo: Todo) => Promise<void>;
  onEdit: (todo: Todo) => void;
  onAddSubtask: (todoId: number, title: string) => Promise<void>;
  onToggleSubtask: (subtaskId: number, completed: boolean) => Promise<void>;
  onDeleteSubtask: (subtaskId: number) => Promise<void>;
  onTagClick: (tagId: number) => void;
}) {
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const total = todo.subtasks?.length ?? 0;
  const completed = todo.subtasks?.filter((subtask) => subtask.completed === 1).length ?? 0;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <article style={{ border: '1px solid var(--border)', borderRadius: 18, padding: 16, background: 'var(--surface-alt)' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <input type="checkbox" checked={todo.completed === 1} onChange={() => void onToggle(todo)} aria-label={`Toggle ${todo.title}`} />
        <div style={{ flex: 1, minWidth: 'min(100%, 240px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: 20, textDecoration: todo.completed === 1 ? 'line-through' : 'none' }}>{todo.title}</strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <Badge label={todo.priority} tone={todo.priority === 'high' ? '#dc2626' : todo.priority === 'medium' ? '#d97706' : '#2563eb'} />
                {todo.is_recurring === 1 && todo.recurrence_pattern ? <Badge label={`↻ ${todo.recurrence_pattern}`} tone="#7c3aed" /> : null}
                {todo.reminder_minutes ? <Badge label={`🔔 ${todo.reminder_minutes}m`} tone="#0f766e" /> : null}
                {(todo.tags ?? []).map((tag) => (
                  <Badge key={tag.id} label={tag.name} tone={tag.color} onClick={() => onTagClick(tag.id)} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => onEdit(todo)} style={ghostButtonStyle}>
                Edit
              </button>
              <button type="button" onClick={() => void onDelete(todo)} style={ghostButtonStyle}>
                Delete
              </button>
            </div>
          </div>
          {todo.due_date ? <p style={{ color: 'var(--muted)', marginBottom: 8 }}>Due {formatSingaporeDate(todo.due_date)}</p> : null}
          {total > 0 ? (
            <>
              <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.25)', overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? 'var(--ok)' : '#2563eb' }} />
              </div>
              <p style={{ marginTop: 0, color: 'var(--muted)' }}>
                {completed}/{total} completed ({progress}%)
              </p>
            </>
          ) : null}
          <div style={{ display: 'grid', gap: 8 }}>
            {(todo.subtasks ?? []).map((subtask) => (
              <div key={subtask.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="checkbox" checked={subtask.completed === 1} onChange={() => void onToggleSubtask(subtask.id, subtask.completed === 1)} />
                <span style={{ flex: 1 }}>{subtask.title}</span>
                <button type="button" onClick={() => void onDeleteSubtask(subtask.id)} style={{ ...ghostButtonStyle, padding: '0.4rem 0.6rem' }}>
                  x
                </button>
              </div>
            ))}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void onAddSubtask(todo.id, subtaskDraft);
                setSubtaskDraft('');
              }}
              style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}
            >
              <input
                aria-label={`Add subtask for ${todo.title}`}
                value={subtaskDraft}
                onChange={(event) => setSubtaskDraft(event.target.value)}
                placeholder="Add subtask"
                style={{ ...inputStyle, flex: '1 1 220px' }}
              />
              <button type="submit" style={ghostButtonStyle}>
                Add
              </button>
            </form>
          </div>
        </div>
      </div>
    </article>
  );
}

function Badge({ label, tone, onClick }: { label: string; tone: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '0.3rem 0.75rem',
        borderRadius: 999,
        color: '#fff',
        background: tone,
        fontSize: 13,
        border: 0,
      }}
    >
      {label}
    </button>
  );
}

const panelStyle: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 24,
  padding: 20,
  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid var(--border)',
  padding: '0.8rem 1rem',
  background: 'var(--surface-alt)',
  color: 'var(--text)',
};

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 14,
  background: 'var(--accent)',
  color: '#fff',
  padding: '0.85rem 1rem',
  fontWeight: 700,
};

const ghostButtonStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  padding: '0.7rem 0.95rem',
};

const modalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.45)',
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  zIndex: 50,
};
