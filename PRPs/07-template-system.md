# PRP 07: Template System

## Feature Overview

Implement a reusable template system that lets users save todo patterns and quickly create new todos from them. Templates store a title, priority, category, optional due date offset (in days), and an optional list of subtasks serialized as JSON. When a template is used, it generates a new todo with the stored properties, calculating the due date from the current Singapore time plus the offset. This feature builds on **PRP 01** (CRUD), **PRP 02** (Priority), and **PRP 05** (Subtasks).

---

## User Stories

### As a user, I want to:

1. **Save a todo as a template** so I can reuse common task patterns
2. **Create templates directly** with a title, priority, category, subtasks, and due date offset
3. **Organize templates by category** so I can find them quickly
4. **Create a todo from a template** so I can set up recurring task patterns with one click
5. **Edit existing templates** so I can refine my saved patterns
6. **Delete templates** I no longer use so my template list stays clean
7. **See subtask counts on templates** so I know what each template includes

---

## User Flow

### Creating a Template

```
1. User clicks "Templates" button to open the template management modal
2. User fills in the template form:
   a. Title (required)
   b. Priority dropdown (high / medium / low, default: medium)
   c. Category input (optional, e.g., "Work", "Personal", "Health")
   d. Due date offset in days (optional, e.g., 7 = due in 7 days from use)
3. User optionally adds subtasks:
   a. Types subtask title in input, clicks "Add" or presses Enter
   b. Subtasks appear in an ordered list below
   c. User can remove subtasks before saving
4. User clicks "Save Template"
5. Template appears in the template list grouped by category
```

### Using a Template

```
1. User opens the template modal
2. User locates the template (optionally filtered by category)
3. User clicks "Use" on the template
4. System creates a new todo with:
   a. Title from template
   b. Priority from template
   c. Due date = Singapore now + offset days (if offset is set)
   d. Subtasks from template (uncompleted, in stored order)
5. Modal closes
6. New todo appears in the Pending section
7. Success feedback shown
```

### Editing a Template

```
1. User opens the template modal
2. User clicks "Edit" on a template
3. Form populates with current values (title, priority, category, offset, subtasks)
4. User modifies fields
5. User clicks "Update Template"
6. Template list reflects changes
```

### Deleting a Template

```
1. User opens the template modal
2. User clicks "Delete" on a template
3. Template is removed from the list
4. No confirmation step required (templates are easily recreated)
```

---

## Technical Requirements

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT DEFAULT NULL,
  due_date_offset INTEGER DEFAULT NULL,
  subtasks TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INTEGER | Auto | Auto-increment | Primary key |
| `user_id` | INTEGER | Yes | — | Foreign key to `users` table |
| `title` | TEXT | Yes | — | Template title (becomes the todo title) |
| `priority` | TEXT | Yes | `'medium'` | `'high'` \| `'medium'` \| `'low'` |
| `category` | TEXT | No | `NULL` | Grouping label (e.g., "Work", "Health") |
| `due_date_offset` | INTEGER | No | `NULL` | Days from now to set due date when used |
| `subtasks` | TEXT | No | `'[]'` | JSON-serialized subtask array |
| `created_at` | TEXT | Yes | `datetime('now')` | Creation timestamp |

**Subtasks JSON Format:**

```json
[
  { "title": "Research options", "position": 0 },
  { "title": "Compare prices", "position": 1 },
  { "title": "Make decision", "position": 2 }
]
```

### TypeScript Interfaces

```typescript
// lib/db.ts

export interface TemplateSubtask {
  title: string
  position: number
}

export interface Template {
  id: number
  user_id: number
  title: string
  priority: Priority
  category: string | null
  due_date_offset: number | null
  subtasks: string // JSON string in DB
  created_at: string
}

export interface CreateTemplateInput {
  title: string
  priority?: Priority
  category?: string
  due_date_offset?: number
  subtasks?: TemplateSubtask[]
}

export interface UpdateTemplateInput {
  title?: string
  priority?: Priority
  category?: string | null
  due_date_offset?: number | null
  subtasks?: TemplateSubtask[]
}
```

### Database CRUD Operations

```typescript
// lib/db.ts — templateDB object

export const templateDB = {
  findAll(userId: number): Template[] {
    return db.prepare(
      'SELECT * FROM templates WHERE user_id = ? ORDER BY category ASC, title ASC'
    ).all(userId) as Template[]
  },

  findById(id: number, userId: number): Template | undefined {
    return db.prepare(
      'SELECT * FROM templates WHERE id = ? AND user_id = ?'
    ).get(id, userId) as Template | undefined
  },

  create(userId: number, input: CreateTemplateInput): Template {
    const subtasksJson = JSON.stringify(input.subtasks ?? [])
    const result = db.prepare(`
      INSERT INTO templates (user_id, title, priority, category, due_date_offset, subtasks)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      input.title.trim(),
      input.priority ?? 'medium',
      input.category?.trim() || null,
      input.due_date_offset ?? null,
      subtasksJson
    )

    return templateDB.findById(result.lastInsertRowid as number, userId)!
  },

  update(id: number, userId: number, input: UpdateTemplateInput): Template | undefined {
    const template = templateDB.findById(id, userId)
    if (!template) return undefined

    const updated = {
      title: input.title !== undefined ? input.title.trim() : template.title,
      priority: input.priority !== undefined ? input.priority : template.priority,
      category: input.category !== undefined ? (input.category?.trim() || null) : template.category,
      due_date_offset: input.due_date_offset !== undefined ? input.due_date_offset : template.due_date_offset,
      subtasks: input.subtasks !== undefined ? JSON.stringify(input.subtasks) : template.subtasks,
    }

    db.prepare(`
      UPDATE templates SET title = ?, priority = ?, category = ?, due_date_offset = ?, subtasks = ?
      WHERE id = ? AND user_id = ?
    `).run(
      updated.title,
      updated.priority,
      updated.category,
      updated.due_date_offset,
      updated.subtasks,
      id,
      userId
    )

    return templateDB.findById(id, userId)
  },

  delete(id: number, userId: number): boolean {
    const result = db.prepare(
      'DELETE FROM templates WHERE id = ? AND user_id = ?'
    ).run(id, userId)
    return result.changes > 0
  },
}
```

---

### API Endpoints

#### `GET /api/templates` — List all templates for the user

```typescript
// app/api/templates/route.ts

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const templates = templateDB.findAll(session.userId)
  return NextResponse.json(templates)
}
```

**Response:** `200 OK` — Array of `Template` objects sorted by category then title

---

#### `POST /api/templates` — Create a template

```typescript
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()

  // Validate title
  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: 'Template title is required' }, { status: 400 })
  }

  // Validate priority
  if (body.priority && !['high', 'medium', 'low'].includes(body.priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  // Validate due_date_offset
  if (body.due_date_offset !== undefined && body.due_date_offset !== null) {
    if (!Number.isInteger(body.due_date_offset) || body.due_date_offset < 0) {
      return NextResponse.json({ error: 'Due date offset must be a non-negative integer' }, { status: 400 })
    }
  }

  // Validate subtasks
  if (body.subtasks) {
    if (!Array.isArray(body.subtasks)) {
      return NextResponse.json({ error: 'Subtasks must be an array' }, { status: 400 })
    }
    for (const subtask of body.subtasks) {
      if (!subtask.title || !subtask.title.trim()) {
        return NextResponse.json({ error: 'Subtask title is required' }, { status: 400 })
      }
    }
  }

  const template = templateDB.create(session.userId, body)
  return NextResponse.json(template, { status: 201 })
}
```

**Request Body:**
```json
{
  "title": "Weekly Report",
  "priority": "high",
  "category": "Work",
  "due_date_offset": 7,
  "subtasks": [
    { "title": "Gather metrics", "position": 0 },
    { "title": "Write summary", "position": 1 },
    { "title": "Send to team", "position": 2 }
  ]
}
```

**Response:** `201 Created` — Created `Template` object

---

#### `PUT /api/templates/[id]` — Update a template

```typescript
// app/api/templates/[id]/route.ts

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  // Validate title if provided
  if (body.title !== undefined && !body.title.trim()) {
    return NextResponse.json({ error: 'Template title cannot be empty' }, { status: 400 })
  }

  // Validate priority if provided
  if (body.priority && !['high', 'medium', 'low'].includes(body.priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  // Validate due_date_offset if provided
  if (body.due_date_offset !== undefined && body.due_date_offset !== null) {
    if (!Number.isInteger(body.due_date_offset) || body.due_date_offset < 0) {
      return NextResponse.json({ error: 'Due date offset must be a non-negative integer' }, { status: 400 })
    }
  }

  const template = templateDB.update(Number(id), session.userId, body)
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  return NextResponse.json(template)
}
```

**Response:** `200 OK` — Updated `Template` object

---

#### `DELETE /api/templates/[id]` — Delete a template

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const deleted = templateDB.delete(Number(id), session.userId)

  if (!deleted) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
```

**Response:** `200 OK` — `{ success: true }`

---

#### `POST /api/templates/[id]/use` — Create a todo from a template

```typescript
// app/api/templates/[id]/use/route.ts

import { getSingaporeNow, formatSingaporeDate } from '@/lib/timezone'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const template = templateDB.findById(Number(id), session.userId)

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  // Calculate due date from offset
  let dueDate: string | null = null
  if (template.due_date_offset !== null) {
    const now = getSingaporeNow()
    now.setDate(now.getDate() + template.due_date_offset)
    dueDate = formatSingaporeDate(now) // YYYY-MM-DD format
  }

  // Create the todo
  const todo = todoDB.create(session.userId, {
    title: template.title,
    priority: template.priority,
    due_date: dueDate,
  })

  // Create subtasks from template
  const subtasks: TemplateSubtask[] = JSON.parse(template.subtasks)
  for (const subtask of subtasks) {
    subtaskDB.create(todo.id, {
      title: subtask.title,
      position: subtask.position,
    })
  }

  // Return todo with subtasks
  const createdSubtasks = subtaskDB.findByTodoId(todo.id)
  return NextResponse.json({ ...todo, subtasks: createdSubtasks }, { status: 201 })
}
```

**Response:** `201 Created` — Todo object with subtasks

**Behavior:**
- Title, priority copied from template
- Due date = `getSingaporeNow()` + `due_date_offset` days (if offset set)
- Subtasks created from parsed JSON array, all uncompleted, in stored positions
- Tags are NOT copied (templates don't store tags)
- Recurrence is NOT set (templates create one-off todos)
- Reminder is NOT set (user sets on the created todo if needed)

---

## UI Components

### Template Modal

```tsx
{showTemplateModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
      <h3 className="text-lg font-bold mb-4 dark:text-white">Templates</h3>

      {/* Create / Edit template form */}
      <form onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
            className="space-y-3 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h4 className="font-semibold dark:text-white">
          {editingTemplate ? 'Edit Template' : 'New Template'}
        </h4>

        {/* Title */}
        <input
          type="text"
          value={templateTitle}
          onChange={(e) => setTemplateTitle(e.target.value)}
          placeholder="Template title"
          className="w-full border rounded px-3 py-2
                     dark:bg-gray-600 dark:border-gray-500 dark:text-white"
        />

        <div className="flex gap-3">
          {/* Priority */}
          <select
            value={templatePriority}
            onChange={(e) => setTemplatePriority(e.target.value as Priority)}
            className="border rounded px-3 py-2
                       dark:bg-gray-600 dark:border-gray-500 dark:text-white"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Category */}
          <input
            type="text"
            value={templateCategory}
            onChange={(e) => setTemplateCategory(e.target.value)}
            placeholder="Category (optional)"
            className="flex-1 border rounded px-3 py-2
                       dark:bg-gray-600 dark:border-gray-500 dark:text-white"
          />

          {/* Due Date Offset */}
          <input
            type="number"
            value={templateOffset}
            onChange={(e) => setTemplateOffset(e.target.value)}
            placeholder="Days"
            min="0"
            className="w-20 border rounded px-3 py-2
                       dark:bg-gray-600 dark:border-gray-500 dark:text-white"
          />
        </div>

        {/* Subtask input */}
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
            placeholder="Add subtask"
            className="flex-1 border rounded px-3 py-2
                       dark:bg-gray-600 dark:border-gray-500 dark:text-white"
          />
          <button
            type="button"
            onClick={handleAddTemplateSubtask}
            className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300
                       dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white"
          >
            Add
          </button>
        </div>

        {/* Subtask list */}
        {templateSubtasks.length > 0 && (
          <ul className="space-y-1">
            {templateSubtasks.map((subtask, index) => (
              <li key={index} className="flex items-center gap-2 text-sm
                                          dark:text-gray-300">
                <span className="text-gray-400">{index + 1}.</span>
                <span className="flex-1">{subtask.title}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTemplateSubtask(index)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600
                     dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          {editingTemplate ? 'Update Template' : 'Save Template'}
        </button>

        {editingTemplate && (
          <button
            type="button"
            onClick={() => {
              setEditingTemplate(null)
              resetTemplateForm()
            }}
            className="w-full py-2 bg-gray-200 rounded hover:bg-gray-300
                       dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white"
          >
            Cancel
          </button>
        )}
      </form>

      {/* Template list grouped by category */}
      {Object.entries(groupedTemplates).map(([category, templates]) => (
        <div key={category} className="mb-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2
                         dark:text-gray-400">
            {category || 'Uncategorized'}
          </h4>
          <div className="space-y-2">
            {templates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={handleUseTemplate}
                onEdit={startEditTemplate}
                onDelete={handleDeleteTemplate}
              />
            ))}
          </div>
        </div>
      ))}

      {templates.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
          No templates yet. Create one above!
        </p>
      )}

      {/* Close */}
      <button
        onClick={() => setShowTemplateModal(false)}
        className="mt-4 w-full py-2 bg-gray-200 rounded hover:bg-gray-300
                   dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white"
      >
        Close
      </button>
    </div>
  </div>
)}
```

### Template Card

```tsx
function TemplateCard({ template, onUse, onEdit, onDelete }) {
  const subtasks: TemplateSubtask[] = JSON.parse(template.subtasks)

  return (
    <div className="flex items-center gap-3 p-3 bg-white border rounded-lg
                    dark:bg-gray-800 dark:border-gray-600">
      {/* Priority badge */}
      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
        template.priority === 'high'
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : template.priority === 'medium'
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      }`}>
        {template.priority}
      </span>

      {/* Title and metadata */}
      <div className="flex-1">
        <span className="font-medium dark:text-white">{template.title}</span>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {template.due_date_offset !== null && (
            <span>Due in {template.due_date_offset} day{template.due_date_offset !== 1 ? 's' : ''} · </span>
          )}
          {subtasks.length > 0 && (
            <span>{subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={() => onUse(template.id)}
        className="text-sm px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600
                   dark:bg-green-600 dark:hover:bg-green-700"
      >
        Use
      </button>
      <button
        onClick={() => onEdit(template)}
        className="text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400"
      >
        Edit
      </button>
      <button
        onClick={() => onDelete(template.id)}
        className="text-sm text-red-500 hover:text-red-700 dark:text-red-400"
      >
        Delete
      </button>
    </div>
  )
}
```

### "Templates" Button

```tsx
<button
  onClick={() => setShowTemplateModal(true)}
  className="text-sm px-3 py-1.5 rounded-lg border
             border-purple-300 text-purple-600 hover:bg-purple-50
             dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-900/20"
>
  Templates
</button>
```

---

## State Management

```typescript
// Template modal state
const [showTemplateModal, setShowTemplateModal] = useState(false)
const [templates, setTemplates] = useState<Template[]>([])
const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)

// Template form state
const [templateTitle, setTemplateTitle] = useState('')
const [templatePriority, setTemplatePriority] = useState<Priority>('medium')
const [templateCategory, setTemplateCategory] = useState('')
const [templateOffset, setTemplateOffset] = useState('')
const [templateSubtaskInput, setTemplateSubtaskInput] = useState('')
const [templateSubtasks, setTemplateSubtasks] = useState<TemplateSubtask[]>([])

// Grouped templates by category
const groupedTemplates = templates.reduce<Record<string, Template[]>>((acc, t) => {
  const key = t.category || ''
  return {
    ...acc,
    [key]: [...(acc[key] || []), t],
  }
}, {})
```

---

## Event Handlers

```typescript
// Fetch templates
async function fetchTemplates() {
  const res = await fetch('/api/templates')
  if (res.ok) {
    const data = await res.json()
    setTemplates(data)
  }
}

// Reset form
function resetTemplateForm() {
  setTemplateTitle('')
  setTemplatePriority('medium')
  setTemplateCategory('')
  setTemplateOffset('')
  setTemplateSubtaskInput('')
  setTemplateSubtasks([])
}

// Add subtask to template form
function handleAddTemplateSubtask() {
  if (!templateSubtaskInput.trim()) return
  setTemplateSubtasks(prev => [
    ...prev,
    { title: templateSubtaskInput.trim(), position: prev.length },
  ])
  setTemplateSubtaskInput('')
}

// Remove subtask from template form
function handleRemoveTemplateSubtask(index: number) {
  setTemplateSubtasks(prev =>
    prev
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, position: i }))
  )
}

// Create template
async function handleCreateTemplate(e: React.FormEvent) {
  e.preventDefault()
  if (!templateTitle.trim()) return

  await fetch('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: templateTitle,
      priority: templatePriority,
      category: templateCategory || undefined,
      due_date_offset: templateOffset ? Number(templateOffset) : undefined,
      subtasks: templateSubtasks,
    }),
  })

  resetTemplateForm()
  await fetchTemplates()
}

// Start editing a template
function startEditTemplate(template: Template) {
  const subtasks: TemplateSubtask[] = JSON.parse(template.subtasks)
  setEditingTemplate(template)
  setTemplateTitle(template.title)
  setTemplatePriority(template.priority)
  setTemplateCategory(template.category ?? '')
  setTemplateOffset(template.due_date_offset !== null ? String(template.due_date_offset) : '')
  setTemplateSubtasks(subtasks)
}

// Update template
async function handleUpdateTemplate(e: React.FormEvent) {
  e.preventDefault()
  if (!editingTemplate || !templateTitle.trim()) return

  await fetch(`/api/templates/${editingTemplate.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: templateTitle,
      priority: templatePriority,
      category: templateCategory || null,
      due_date_offset: templateOffset ? Number(templateOffset) : null,
      subtasks: templateSubtasks,
    }),
  })

  setEditingTemplate(null)
  resetTemplateForm()
  await fetchTemplates()
}

// Delete template
async function handleDeleteTemplate(templateId: number) {
  await fetch(`/api/templates/${templateId}`, { method: 'DELETE' })
  await fetchTemplates()
}

// Use template — create a todo from it
async function handleUseTemplate(templateId: number) {
  const res = await fetch(`/api/templates/${templateId}/use`, {
    method: 'POST',
  })

  if (res.ok) {
    setShowTemplateModal(false)
    await fetchTodos() // Refresh todo list to show new todo
  }
}
```

---

## Category Grouping

Templates in the modal are grouped by category and displayed under section headers:

```
Work
├── Weekly Report          [High]  Due in 7 days · 3 subtasks  [Use] [Edit] [Delete]
├── Sprint Planning        [Medium]  Due in 14 days · 5 subtasks  [Use] [Edit] [Delete]

Health
├── Workout Plan           [Medium]  · 4 subtasks  [Use] [Edit] [Delete]
├── Meal Prep              [Low]  Due in 1 day · 6 subtasks  [Use] [Edit] [Delete]

Uncategorized
├── Quick Errand           [Low]  [Use] [Edit] [Delete]
```

**Sorting:**
- Categories sorted alphabetically
- `null`/empty category as "Uncategorized" at the end
- Templates within each category sorted alphabetically by title

---

## Edge Cases

### Template Creation

| Scenario | Expected Behavior |
|----------|-------------------|
| Empty title | Reject — "Template title is required" (400) |
| Whitespace-only title | Reject — trimmed to empty (400) |
| Invalid priority | Reject — "Invalid priority" (400) |
| No priority provided | Default to `'medium'` |
| Negative due date offset | Reject — "must be non-negative integer" (400) |
| Zero due date offset | Allowed — due date = today when used |
| Fractional offset (e.g., 1.5) | Reject — "must be a non-negative integer" (400) |
| No offset provided | `null` — todo created without due date |
| Empty subtask title | Reject — "Subtask title is required" (400) |
| No subtasks | Allowed — `'[]'` stored |
| Very long subtask list | Allowed — no practical limit |
| Duplicate template titles | Allowed — templates don't require unique names |
| No category | Stored as `null`, displayed as "Uncategorized" |
| Whitespace-only category | Trimmed to `null` |

### Template Usage

| Scenario | Expected Behavior |
|----------|-------------------|
| Template with offset and subtasks | Todo created with calculated due date and subtasks |
| Template with no offset | Todo created without due date |
| Template with 0 offset | Todo due date = today (Singapore time) |
| Template with no subtasks | Todo created with no subtasks |
| Offset of 1 day | Due date = tomorrow in Singapore timezone |
| Use template multiple times | Each use creates a separate todo (no deduplication) |
| Template deleted after use | No effect on already-created todos |
| Due date calculation | Uses `getSingaporeNow()`, NOT `new Date()` |

### Template Editing

| Scenario | Expected Behavior |
|----------|-------------------|
| Edit title and save | Title updated in DB |
| Edit subtasks — add new | New subtask added, positions recalculated |
| Edit subtasks — remove | Subtask removed, positions recalculated |
| Cancel edit | Form resets, no changes saved |
| Edit non-existent template | 404 "Template not found" |
| Clear category | Category set to `null` |
| Clear offset | Offset set to `null` |

### Template Deletion

| Scenario | Expected Behavior |
|----------|-------------------|
| Delete template | Removed from DB, no effect on created todos |
| Delete non-existent template | 404 "Template not found" |
| Delete another user's template | 404 "Template not found" |

---

## Acceptance Criteria

### Template CRUD

- [ ] "Templates" button opens the template modal
- [ ] Template form has title, priority, category, offset, and subtask fields
- [ ] Creating a template with valid inputs adds it to the list
- [ ] Template title is required and non-empty
- [ ] Priority defaults to "medium" when not specified
- [ ] Category is optional (null when empty)
- [ ] Due date offset is optional, must be a non-negative integer
- [ ] Subtasks are stored as a JSON array with title and position
- [ ] "Edit" populates the form with current template values
- [ ] Editing updates the template correctly
- [ ] "Delete" removes the template from the list
- [ ] Deleting a template does not affect previously created todos

### Template Usage

- [ ] "Use" button creates a new todo from the template
- [ ] Created todo has the template's title
- [ ] Created todo has the template's priority
- [ ] Due date is calculated as `getSingaporeNow() + offset` days (if offset set)
- [ ] No due date is set when offset is `null`
- [ ] Subtasks are created from the template's JSON, all uncompleted
- [ ] Subtask positions match the stored order
- [ ] Modal closes after successful use
- [ ] New todo appears in the Pending section immediately
- [ ] Using a template multiple times creates separate, independent todos

### Category Grouping

- [ ] Templates are grouped by category in the modal
- [ ] Category headers are displayed as section titles
- [ ] Templates without a category appear under "Uncategorized"
- [ ] Categories are sorted alphabetically
- [ ] "Uncategorized" appears last
- [ ] Templates within a category are sorted alphabetically by title

### Subtask Management in Form

- [ ] Subtask input field and "Add" button in the template form
- [ ] Pressing Enter in the subtask input adds the subtask
- [ ] Added subtasks appear in a numbered list below
- [ ] "✕" button removes a subtask from the list
- [ ] Removing a subtask recalculates positions
- [ ] Subtask count displayed on the template card

### Template Card Display

- [ ] Card shows priority badge (color-coded)
- [ ] Card shows template title
- [ ] Card shows due date offset (e.g., "Due in 7 days") if set
- [ ] Card shows subtask count (e.g., "3 subtasks") if any
- [ ] Card has "Use", "Edit", and "Delete" action buttons
- [ ] All elements render correctly in dark mode

### Validation & Security

- [ ] All template endpoints return 401 without a valid session
- [ ] Users cannot see, edit, delete, or use other users' templates
- [ ] Input validation for title, priority, offset, and subtask titles
- [ ] SQL injection prevented via prepared statements
- [ ] Subtask JSON is properly serialized/deserialized

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/07-templates.spec.ts

import { test, expect } from '@playwright/test'
import { TodoHelper } from './helpers'

test.describe('Template System', () => {

  test('should open template modal', async ({ page }) => {
    await page.click('button:has-text("Templates")')
    await expect(page.getByText('Templates')).toBeVisible()
    await expect(page.getByPlaceholder('Template title')).toBeVisible()
  })

  test('should create a template', async ({ page }) => {
    await page.click('button:has-text("Templates")')

    await page.fill('input[placeholder="Template title"]', 'Weekly Report')
    await page.selectOption('select', 'high')
    await page.fill('input[placeholder="Category (optional)"]', 'Work')
    await page.fill('input[placeholder="Days"]', '7')

    await page.click('button:has-text("Save Template")')

    await expect(page.getByText('Weekly Report')).toBeVisible()
    await expect(page.getByText('Due in 7 days')).toBeVisible()
  })

  test('should create a template with subtasks', async ({ page }) => {
    await page.click('button:has-text("Templates")')

    await page.fill('input[placeholder="Template title"]', 'Project Setup')
    await page.fill('input[placeholder="Category (optional)"]', 'Dev')

    // Add subtasks
    await page.fill('input[placeholder="Add subtask"]', 'Create repo')
    await page.click('button:has-text("Add")')
    await page.fill('input[placeholder="Add subtask"]', 'Setup CI')
    await page.click('button:has-text("Add")')

    await page.click('button:has-text("Save Template")')

    await expect(page.getByText('Project Setup')).toBeVisible()
    await expect(page.getByText('2 subtasks')).toBeVisible()
  })

  test('should use a template to create a todo', async ({ page }) => {
    const helper = new TodoHelper(page)

    // Create a template first
    await page.click('button:has-text("Templates")')
    await page.fill('input[placeholder="Template title"]', 'Quick Task')
    await page.click('button:has-text("Save Template")')

    // Use the template
    await page.click('button:has-text("Use")')

    // Modal should close, new todo should appear
    await expect(page.getByText('Quick Task')).toBeVisible()
  })

  test('should create todo with subtasks from template', async ({ page }) => {
    await page.click('button:has-text("Templates")')

    await page.fill('input[placeholder="Template title"]', 'Subtask Template')

    await page.fill('input[placeholder="Add subtask"]', 'Step 1')
    await page.click('button:has-text("Add")')
    await page.fill('input[placeholder="Add subtask"]', 'Step 2')
    await page.click('button:has-text("Add")')

    await page.click('button:has-text("Save Template")')
    await page.click('button:has-text("Use")')

    // Verify subtasks created on the todo
    const todoItem = page.locator('[data-testid="todo-item"]:has-text("Subtask Template")')
    await expect(todoItem).toBeVisible()
    await expect(todoItem.getByText('Step 1')).toBeVisible()
    await expect(todoItem.getByText('Step 2')).toBeVisible()
  })

  test('should create todo with calculated due date from offset', async ({ page }) => {
    await page.click('button:has-text("Templates")')

    await page.fill('input[placeholder="Template title"]', 'Offset Template')
    await page.fill('input[placeholder="Days"]', '3')

    await page.click('button:has-text("Save Template")')
    await page.click('button:has-text("Use")')

    // Todo should have a due date 3 days from now
    const todoItem = page.locator('[data-testid="todo-item"]:has-text("Offset Template")')
    await expect(todoItem).toBeVisible()
    // Verify due date display is present (exact date depends on test run time)
  })

  test('should edit a template', async ({ page }) => {
    await page.click('button:has-text("Templates")')
    await page.fill('input[placeholder="Template title"]', 'Editme')
    await page.click('button:has-text("Save Template")')

    // Click Edit
    await page.click('button:has-text("Edit")')
    await page.fill('input[placeholder="Template title"]', 'Edited Template')
    await page.click('button:has-text("Update Template")')

    await expect(page.getByText('Edited Template')).toBeVisible()
    await expect(page.getByText('Editme')).not.toBeVisible()
  })

  test('should delete a template', async ({ page }) => {
    await page.click('button:has-text("Templates")')
    await page.fill('input[placeholder="Template title"]', 'Deleteme')
    await page.click('button:has-text("Save Template")')

    await page.click('button:has-text("Delete")')

    await expect(page.getByText('Deleteme')).not.toBeVisible()
  })

  test('should group templates by category', async ({ page }) => {
    await page.click('button:has-text("Templates")')

    // Create Work template
    await page.fill('input[placeholder="Template title"]', 'Work Task')
    await page.fill('input[placeholder="Category (optional)"]', 'Work')
    await page.click('button:has-text("Save Template")')

    // Create Health template
    await page.fill('input[placeholder="Template title"]', 'Exercise')
    await page.fill('input[placeholder="Category (optional)"]', 'Health')
    await page.click('button:has-text("Save Template")')

    // Category headers should be visible
    await expect(page.getByText('WORK', { exact: false })).toBeVisible()
    await expect(page.getByText('HEALTH', { exact: false })).toBeVisible()
  })

  test('should reject empty template title', async ({ page }) => {
    await page.click('button:has-text("Templates")')
    await page.click('button:has-text("Save Template")')

    // Should not create template — title is empty
    await expect(page.getByText('No templates yet')).toBeVisible()
  })

  test('should use template multiple times', async ({ page }) => {
    await page.click('button:has-text("Templates")')
    await page.fill('input[placeholder="Template title"]', 'Multi-use')
    await page.click('button:has-text("Save Template")')

    // Use twice
    await page.click('button:has-text("Use")')
    await page.click('button:has-text("Templates")')
    await page.click('button:has-text("Use")')

    // Two separate todos should exist
    const todos = page.locator('[data-testid="todo-item"]:has-text("Multi-use")')
    await expect(todos).toHaveCount(2)
  })

  test('should cancel template editing', async ({ page }) => {
    await page.click('button:has-text("Templates")')
    await page.fill('input[placeholder="Template title"]', 'No Edit')
    await page.click('button:has-text("Save Template")')

    await page.click('button:has-text("Edit")')
    await page.fill('input[placeholder="Template title"]', 'Changed')
    await page.click('button:has-text("Cancel")')

    // Original name should remain
    await expect(page.getByText('No Edit')).toBeVisible()
    await expect(page.getByText('Changed')).not.toBeVisible()
  })

  test('should remove subtask from template form', async ({ page }) => {
    await page.click('button:has-text("Templates")')

    await page.fill('input[placeholder="Add subtask"]', 'Remove Me')
    await page.click('button:has-text("Add")')

    await expect(page.getByText('Remove Me')).toBeVisible()

    await page.click('button:has-text("✕")')

    await expect(page.getByText('Remove Me')).not.toBeVisible()
  })
})
```

### Test Helper Extension

```typescript
// tests/helpers.ts — add to TodoHelper class

export class TodoHelper {
  // ... existing methods

  async createTemplate(
    title: string,
    options?: { priority?: string; category?: string; offset?: number; subtasks?: string[] }
  ) {
    const modal = this.page.getByText('Templates')
    if (!(await modal.isVisible())) {
      await this.page.click('button:has-text("Templates")')
    }

    await this.page.fill('input[placeholder="Template title"]', title)

    if (options?.priority) {
      await this.page.selectOption('select', options.priority)
    }
    if (options?.category) {
      await this.page.fill('input[placeholder="Category (optional)"]', options.category)
    }
    if (options?.offset !== undefined) {
      await this.page.fill('input[placeholder="Days"]', String(options.offset))
    }
    if (options?.subtasks) {
      for (const subtask of options.subtasks) {
        await this.page.fill('input[placeholder="Add subtask"]', subtask)
        await this.page.click('button:has-text("Add")')
      }
    }

    await this.page.click('button:has-text("Save Template")')
  }
}
```

### API Tests

```typescript
test('POST /api/templates creates a template', async () => {
  const res = await fetch('/api/templates', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Weekly Report',
      priority: 'high',
      category: 'Work',
      due_date_offset: 7,
      subtasks: [
        { title: 'Gather data', position: 0 },
        { title: 'Write summary', position: 1 },
      ],
    }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(201)
  const template = await res.json()
  expect(template.title).toBe('Weekly Report')
  expect(template.priority).toBe('high')
  expect(JSON.parse(template.subtasks)).toHaveLength(2)
})

test('POST /api/templates rejects empty title', async () => {
  const res = await fetch('/api/templates', {
    method: 'POST',
    body: JSON.stringify({ title: '' }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(400)
})

test('POST /api/templates/[id]/use creates todo from template', async () => {
  const template = await createTemplate('Test Template', { offset: 3, subtasks: ['Step 1'] })

  const res = await fetch(`/api/templates/${template.id}/use`, { method: 'POST' })
  expect(res.status).toBe(201)

  const todo = await res.json()
  expect(todo.title).toBe('Test Template')
  expect(todo.subtasks).toHaveLength(1)
  expect(todo.subtasks[0].title).toBe('Step 1')
  expect(todo.due_date).toBeTruthy() // Should have a due date
})

test('POST /api/templates/[id]/use creates todo without due date if no offset', async () => {
  const template = await createTemplate('No Offset', {})

  const res = await fetch(`/api/templates/${template.id}/use`, { method: 'POST' })
  const todo = await res.json()
  expect(todo.due_date).toBeNull()
})

test('DELETE /api/templates/[id] removes template', async () => {
  const template = await createTemplate('Delete Me', {})

  const res = await fetch(`/api/templates/${template.id}`, { method: 'DELETE' })
  expect(res.status).toBe(200)

  const getRes = await fetch(`/api/templates/${template.id}`)
  // Template should no longer be retrievable
})

test('returns 401 for unauthenticated template requests', async () => {
  const res = await fetch('/api/templates', { headers: {} })
  expect(res.status).toBe(401)
})
```

---

## Out of Scope

These are related features handled by other PRPs or future enhancements:

- Todo CRUD basics → **PRP 01**
- Priority system → **PRP 02**
- Recurring todo patterns → **PRP 03**
- Reminder settings → **PRP 04**
- Subtask implementation → **PRP 05**
- Tag system (templates don't store tags) → **PRP 06**
- Filtering and search → **PRP 08**
- Export/import → **PRP 09**
- Template sharing between users → Future enhancement
- Template version history → Future enhancement
- Template usage analytics → Future enhancement
- Importing templates from file → Future enhancement
- Template scheduling (auto-use on a schedule) → Future enhancement

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Template CRUD response time | < 100ms |
| Template use (todo creation) response time | < 200ms |
| Subtask JSON parse correctness | 100% — no corruption |
| Due date offset calculation | 100% — correct Singapore timezone |
| Category grouping accuracy | 100% — all templates in correct groups |
| Form validation coverage | 100% — all invalid inputs rejected |
| Authorization scoping | 100% — no cross-user access |
| E2E test pass rate | 100% |

---

## Implementation Notes

### Project-Specific Patterns

1. **Subtasks as JSON** — template subtasks are stored as a JSON string in the `subtasks` TEXT column. `JSON.stringify()` on write, `JSON.parse()` on read. This avoids a separate template-subtasks table.
2. **Due date offset vs. absolute date** — templates store an offset (integer days), not an absolute date. The `/use` endpoint calculates the due date dynamically using `getSingaporeNow()`.
3. **Category grouping** — client-side `reduce()` groups templates by category. Categories are not a separate table — just a string field.
4. **No uniqueness constraint on title** — users can have multiple templates with the same name.
5. **Templates are independent of tags** — when a template is used, the created todo has no tags. User adds tags after creation if needed.
6. **Templates are independent of recurrence** — created todos are one-off. User configures recurrence after creation if needed.
7. **Templates are independent of reminders** — no `reminder_minutes` stored. User sets reminders after creation if needed.
8. **`params` is async** in Next.js 16 — always `const { id } = await params`.
9. **Immutability** — use `prev.filter()`, `[...prev, item]`, and spread operator for state updates. Never mutate.
10. **Synchronous DB operations** — `better-sqlite3` is synchronous. No `await` on DB calls.

### File Locations

```
app/api/templates/route.ts            # GET (list), POST (create) templates
app/api/templates/[id]/route.ts       # PUT (update), DELETE template
app/api/templates/[id]/use/route.ts   # POST — create todo from template
lib/db.ts                              # templateDB, Template, TemplateSubtask interfaces
app/page.tsx                           # UI: modal, form, cards, category groups
```

### Dependencies

No additional npm packages. Uses:
- `better-sqlite3` for template table operations
- `JSON.stringify()` / `JSON.parse()` for subtask serialization
- `lib/timezone.ts` for due date offset calculation (`getSingaporeNow()`)
- Tailwind CSS for modal and card styling
