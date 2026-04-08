# PRP 06: Tag System

## Feature Overview

Implement a color-coded tag system for organizing todos into custom categories. Tags use a many-to-many relationship with todos via a junction table. Each user manages their own set of tags with custom names and hex colors. Tags can be created, edited, deleted, assigned to todos, and used as a filter criterion. Tag associations are cascade-deleted when a tag is removed. This feature builds on **PRP 01** (CRUD) and integrates with **PRP 03** (Recurring — tags inherited), **PRP 05** (Subtasks — independent), and **PRP 08** (Filtering).

---

## User Stories

### As a user, I want to:

1. **Create custom tags** with a name and color so I can categorize todos by topic
2. **Edit tag names and colors** so I can refine my organization system
3. **Delete tags** I no longer need so my tag list stays clean
4. **Assign multiple tags to a todo** when creating or editing so I can cross-categorize
5. **See color-coded tag pills** on todos so I can visually scan categories at a glance
6. **Filter todos by tag** so I can focus on a specific category
7. **Have tag associations cleaned up** when a tag is deleted so no broken references remain

---

## User Flow

### Creating a Tag

```
1. User clicks "+ Manage Tags" button (near the todo form)
2. Tag management modal opens showing:
   a. Create tag form (name input + color picker)
   b. List of existing tags with Edit/Delete buttons
3. User types a tag name in the input field
4. User selects a color via the color picker (default: #3B82F6 blue)
5. User clicks "Create Tag"
6. New tag appears in the list immediately
7. Tag becomes available for selection on todos
```

### Editing a Tag

```
1. User opens the tag management modal
2. User clicks "Edit" on an existing tag
3. Name input and color picker populate with current values
4. User modifies name and/or color
5. User clicks "Update"
6. Tag updates everywhere it appears (all associated todos)
```

### Deleting a Tag

```
1. User opens the tag management modal
2. User clicks "Delete" on a tag
3. User confirms deletion
4. Tag is removed from the list
5. Tag associations are removed from all todos (CASCADE)
6. The tag itself is deleted, but the todos are NOT deleted
```

### Assigning Tags to a Todo (Create)

```
1. User fills out the todo form (title, priority, etc.)
2. Below the form, available tags are displayed as selectable pills
3. User clicks tag pills to select/deselect:
   - Selected: ✓ checkmark, colored background, white text
   - Unselected: no checkmark, gray border, gray text
4. Multiple tags can be selected
5. User clicks "Add" to create the todo
6. Selected tags are associated with the new todo
```

### Assigning Tags to a Todo (Edit)

```
1. User clicks "Edit" on a todo
2. Edit modal shows tag selection pills
3. Currently assigned tags appear selected
4. User toggles tags on/off
5. User clicks "Update"
6. Tag associations are updated
```

### Filtering by Tag

```
1. User locates the "All Tags" dropdown in the filter bar
2. Dropdown lists all user-created tags
3. User selects a tag
4. Todo list filters to show only todos with that tag
5. Section counters update
6. User selects "All Tags" to clear the filter
```

---

## Technical Requirements

### Database Schema

```sql
-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, name)
);

-- Junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (todo_id, tag_id),
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

**Tags Table Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INTEGER | Auto | Auto-increment | Primary key |
| `user_id` | INTEGER | Yes | — | Foreign key to `users` table |
| `name` | TEXT | Yes | — | Tag name (unique per user) |
| `color` | TEXT | Yes | `'#3B82F6'` | Hex color code |
| `created_at` | TEXT | Yes | `datetime('now')` | Creation timestamp |

**Junction Table:**

| Field | Type | Description |
|-------|------|-------------|
| `todo_id` | INTEGER | Foreign key to `todos` (CASCADE delete) |
| `tag_id` | INTEGER | Foreign key to `tags` (CASCADE delete) |

**Key Constraints:**
- `UNIQUE(user_id, name)` — no duplicate tag names per user
- `PRIMARY KEY (todo_id, tag_id)` — prevents duplicate associations
- `ON DELETE CASCADE` on both foreign keys — deleting a todo removes its tag associations; deleting a tag removes it from all todos

### TypeScript Interfaces

```typescript
// lib/db.ts

export interface Tag {
  id: number
  user_id: number
  name: string
  color: string
  created_at: string
}

export interface CreateTagInput {
  name: string
  color?: string
}

export interface UpdateTagInput {
  name?: string
  color?: string
}

export interface TodoTag {
  todo_id: number
  tag_id: number
}
```

### Database CRUD Operations

```typescript
// lib/db.ts — tagDB object

export const tagDB = {
  findAll(userId: number): Tag[] {
    return db.prepare(
      'SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC'
    ).all(userId) as Tag[]
  },

  findById(id: number, userId: number): Tag | undefined {
    return db.prepare(
      'SELECT * FROM tags WHERE id = ? AND user_id = ?'
    ).get(id, userId) as Tag | undefined
  },

  create(userId: number, input: CreateTagInput): Tag {
    const result = db.prepare(`
      INSERT INTO tags (user_id, name, color)
      VALUES (?, ?, ?)
    `).run(userId, input.name.trim(), input.color ?? '#3B82F6')

    return tagDB.findById(result.lastInsertRowid as number, userId)!
  },

  update(id: number, userId: number, input: UpdateTagInput): Tag | undefined {
    const tag = tagDB.findById(id, userId)
    if (!tag) return undefined

    const updated = {
      name: input.name !== undefined ? input.name.trim() : tag.name,
      color: input.color !== undefined ? input.color : tag.color,
    }

    db.prepare(
      'UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?'
    ).run(updated.name, updated.color, id, userId)

    return tagDB.findById(id, userId)
  },

  delete(id: number, userId: number): boolean {
    const result = db.prepare(
      'DELETE FROM tags WHERE id = ? AND user_id = ?'
    ).run(id, userId)
    return result.changes > 0
  },
}
```

```typescript
// lib/db.ts — todoTagDB object

export const todoTagDB = {
  findByTodoId(todoId: number): Tag[] {
    return db.prepare(`
      SELECT t.* FROM tags t
      INNER JOIN todo_tags tt ON t.id = tt.tag_id
      WHERE tt.todo_id = ?
      ORDER BY t.name ASC
    `).all(todoId) as Tag[]
  },

  findByTagId(tagId: number): number[] {
    return db.prepare(
      'SELECT todo_id FROM todo_tags WHERE tag_id = ?'
    ).all(tagId).map((row: { todo_id: number }) => row.todo_id)
  },

  create(todoId: number, tagId: number): void {
    db.prepare(
      'INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)'
    ).run(todoId, tagId)
  },

  delete(todoId: number, tagId: number): void {
    db.prepare(
      'DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?'
    ).run(todoId, tagId)
  },

  replaceAll(todoId: number, tagIds: number[]): void {
    db.prepare('DELETE FROM todo_tags WHERE todo_id = ?').run(todoId)
    const insert = db.prepare('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)')
    for (const tagId of tagIds) {
      insert.run(todoId, tagId)
    }
  },
}
```

---

### API Endpoints

#### `GET /api/tags` — List all tags for the user

```typescript
// app/api/tags/route.ts

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tags = tagDB.findAll(session.userId)
  return NextResponse.json(tags)
}
```

**Response:** `200 OK` — Array of `Tag` objects sorted by name

---

#### `POST /api/tags` — Create a tag

```typescript
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()

  // Validate name
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
  }

  // Validate color format
  if (body.color && !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
    return NextResponse.json({ error: 'Invalid color format' }, { status: 400 })
  }

  // Check for duplicate name
  const existing = tagDB.findAll(session.userId)
  if (existing.some(t => t.name.toLowerCase() === body.name.trim().toLowerCase())) {
    return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 })
  }

  const tag = tagDB.create(session.userId, body)
  return NextResponse.json(tag, { status: 201 })
}
```

**Request Body:**
```json
{
  "name": "Work",
  "color": "#3B82F6"
}
```

**Response:** `201 Created` — Created `Tag` object

**Validation:**
- `name` — Required, non-empty, trimmed, unique per user (case-insensitive)
- `color` — Optional (defaults to `#3B82F6`), must be valid 6-digit hex with `#` prefix

---

#### `PUT /api/tags/[id]` — Update a tag

```typescript
// app/api/tags/[id]/route.ts

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

  // Validate name if provided
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: 'Tag name cannot be empty' }, { status: 400 })
  }

  // Validate color if provided
  if (body.color && !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
    return NextResponse.json({ error: 'Invalid color format' }, { status: 400 })
  }

  // Check for duplicate name (exclude current tag)
  if (body.name) {
    const existing = tagDB.findAll(session.userId)
    const duplicate = existing.find(
      t => t.id !== Number(id) && t.name.toLowerCase() === body.name.trim().toLowerCase()
    )
    if (duplicate) {
      return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 })
    }
  }

  const tag = tagDB.update(Number(id), session.userId, body)
  if (!tag) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
  }

  return NextResponse.json(tag)
}
```

**Response:** `200 OK` — Updated `Tag` object

---

#### `DELETE /api/tags/[id]` — Delete a tag

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
  const deleted = tagDB.delete(Number(id), session.userId)

  if (!deleted) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
```

**Response:** `200 OK` — `{ success: true }` (junction table rows cascade-deleted)

---

#### `POST /api/todos/[id]/tags` — Set tags on a todo

```typescript
// app/api/todos/[id]/tags/route.ts

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  // Verify the todo belongs to the user
  const todo = todoDB.findById(Number(id), session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  // body.tagIds = [1, 3, 5] — array of tag IDs to associate
  const tagIds: number[] = body.tagIds ?? []

  // Replace all tag associations
  todoTagDB.replaceAll(Number(id), tagIds)

  // Return updated tags for this todo
  const tags = todoTagDB.findByTodoId(Number(id))
  return NextResponse.json(tags)
}
```

**Request Body:**
```json
{ "tagIds": [1, 3, 5] }
```

**Response:** `200 OK` — Array of `Tag` objects now associated with the todo

---

### Enriched Todo Response

The `GET /api/todos` response includes tags for each todo:

```typescript
// In GET /api/todos handler
const todos = todoDB.findAll(session.userId)

const enriched = todos.map(todo => {
  const subtasks = subtaskDB.findByTodoId(todo.id)
  const tags = todoTagDB.findByTodoId(todo.id)
  return {
    ...todo,
    subtasks,
    subtask_count: subtasks.length,
    subtask_completed: subtasks.filter(s => s.completed).length,
    tags,  // ← Array of Tag objects
  }
})
```

---

## UI Components

### Tag Management Modal

```tsx
{showTagModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
      <h3 className="text-lg font-bold mb-4 dark:text-white">Manage Tags</h3>

      {/* Create tag form */}
      <form onSubmit={handleCreateTag} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="Tag name"
          className="flex-1 border rounded px-3 py-2
                     dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <input
          type="color"
          value={newTagColor}
          onChange={(e) => setNewTagColor(e.target.value)}
          className="w-10 h-10 rounded cursor-pointer border
                     dark:border-gray-600"
        />
        <input
          type="text"
          value={newTagColor}
          onChange={(e) => setNewTagColor(e.target.value)}
          placeholder="#3B82F6"
          className="w-24 border rounded px-2 py-2 text-sm
                     dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600
                     dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          Create Tag
        </button>
      </form>

      {/* Tag list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {tags.map(tag => (
          <div key={tag.id} className="flex items-center gap-2 p-2 rounded
                                       bg-gray-50 dark:bg-gray-700">
            {/* Color swatch */}
            <span
              className="w-4 h-4 rounded-full border"
              style={{ backgroundColor: tag.color }}
            />

            {/* Tag name */}
            <span className="flex-1 dark:text-white">{tag.name}</span>

            {/* Actions */}
            <button
              onClick={() => startEditTag(tag)}
              className="text-sm text-blue-500 hover:text-blue-700
                         dark:text-blue-400"
            >
              Edit
            </button>
            <button
              onClick={() => handleDeleteTag(tag.id)}
              className="text-sm text-red-500 hover:text-red-700
                         dark:text-red-400"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={() => setShowTagModal(false)}
        className="mt-4 w-full py-2 bg-gray-200 rounded hover:bg-gray-300
                   dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white"
      >
        Close
      </button>
    </div>
  </div>
)}
```

### Tag Selection Pills (Create Form)

Displayed below the todo form when tags exist:

```tsx
{tags.length > 0 && (
  <div className="flex flex-wrap gap-2 mt-2">
    {tags.map(tag => {
      const isSelected = selectedTagIds.includes(tag.id)
      return (
        <button
          key={tag.id}
          type="button"
          onClick={() => toggleTagSelection(tag.id)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            isSelected
              ? 'text-white border-transparent'
              : 'text-gray-600 border-gray-300 bg-white dark:text-gray-400 dark:border-gray-600 dark:bg-gray-800'
          }`}
          style={isSelected ? { backgroundColor: tag.color } : undefined}
        >
          {isSelected && '✓ '}{tag.name}
        </button>
      )
    })}
  </div>
)}
```

**Selection State:**

```typescript
const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])

function toggleTagSelection(tagId: number) {
  setSelectedTagIds(prev =>
    prev.includes(tagId)
      ? prev.filter(id => id !== tagId)
      : [...prev, tagId]
  )
}
```

**Visual States:**

| State | Appearance |
|-------|-----------|
| Unselected | White/gray background, gray border, gray text |
| Selected | Tag color background, white text, ✓ checkmark prefix |

### Tag Selection Pills (Edit Modal)

Same visual pattern, but initialized with the todo's current tags:

```tsx
// When opening edit modal
const currentTagIds = editingTodo.tags.map((t: Tag) => t.id)
setEditSelectedTagIds(currentTagIds)

// In the edit modal
{tags.map(tag => {
  const isSelected = editSelectedTagIds.includes(tag.id)
  return (
    <button
      key={tag.id}
      type="button"
      onClick={() => toggleEditTagSelection(tag.id)}
      className={/* same styling as create form */}
      style={isSelected ? { backgroundColor: tag.color } : undefined}
    >
      {isSelected && '✓ '}{tag.name}
    </button>
  )
})}
```

### Tag Pills on Todo Items

Color-coded pills displayed after other badges:

```tsx
{todo.tags?.map(tag => (
  <span
    key={tag.id}
    className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
    style={{ backgroundColor: tag.color }}
  >
    {tag.name}
  </span>
))}
```

### Badge Placement

```
☐  Buy groceries  [Medium]  [🔄 weekly]  [🔔 1h]  [Work]  [Shopping]
                                                     ^^^^^^  ^^^^^^^^^^
                                                     Tag pills (custom colors)
```

### Tag Filter Dropdown

```tsx
<select
  value={tagFilter}
  onChange={(e) => setTagFilter(e.target.value)}
  className="border rounded-lg px-3 py-2
             dark:bg-gray-700 dark:border-gray-600 dark:text-white"
>
  <option value="">All Tags</option>
  {tags.map(tag => (
    <option key={tag.id} value={String(tag.id)}>{tag.name}</option>
  ))}
</select>
```

### "+ Manage Tags" Button

```tsx
<button
  onClick={() => setShowTagModal(true)}
  className="text-sm px-3 py-1.5 rounded-lg border
             border-blue-300 text-blue-600 hover:bg-blue-50
             dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
>
  + Manage Tags
</button>
```

---

## Tag Event Handlers

```typescript
// Create tag
async function handleCreateTag(e: React.FormEvent) {
  e.preventDefault()
  if (!newTagName.trim()) return

  await fetch('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newTagName, color: newTagColor }),
  })

  setNewTagName('')
  setNewTagColor('#3B82F6')
  await fetchTags()
}

// Update tag
async function handleUpdateTag(tagId: number) {
  await fetch(`/api/tags/${tagId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: editTagName, color: editTagColor }),
  })
  setEditingTag(null)
  await fetchTags()
  await fetchTodos() // Refresh to show updated tag on todos
}

// Delete tag
async function handleDeleteTag(tagId: number) {
  await fetch(`/api/tags/${tagId}`, { method: 'DELETE' })
  await fetchTags()
  await fetchTodos() // Refresh to remove tag pills from todos
}

// Set tags on a todo (during create or edit)
async function handleSetTodoTags(todoId: number, tagIds: number[]) {
  await fetch(`/api/todos/${todoId}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tagIds }),
  })
}
```

---

## Filtering Logic

Tag filtering is applied client-side alongside other filters:

```typescript
const [tagFilter, setTagFilter] = useState<string>('')

// Apply tag filter
const filteredTodos = todos.filter(todo => {
  // ... other filters (search, priority)

  // Tag filter
  if (tagFilter) {
    const hasTag = todo.tags?.some(t => t.id === Number(tagFilter))
    if (!hasTag) return false
  }

  return true
})
```

**Behavior:**
- `""` (empty string) — Show all todos regardless of tags
- `"5"` (tag ID as string) — Show only todos that have tag ID 5
- Filter combines with search and priority filters using AND logic

---

## Recurring Todo Tag Inheritance

When a recurring todo is completed (see PRP 03), tags are copied to the new instance:

```typescript
// In PUT /api/todos/[id] — recurring completion handler

// Copy tags from completed todo to new instance
const tags = todoTagDB.findByTodoId(completedTodoId)
for (const tag of tags) {
  todoTagDB.create(nextTodo.id, tag.id)
}
```

---

## Edge Cases

### Tag Creation

| Scenario | Expected Behavior |
|----------|-------------------|
| Empty tag name | Reject — "Tag name is required" (400) |
| Whitespace-only name | Reject — trimmed to empty (400) |
| Duplicate name (same user) | Reject — "Tag name already exists" (409) |
| Duplicate name (different case, same user) | Reject — case-insensitive uniqueness (409) |
| Duplicate name (different user) | Allowed — tags are user-scoped |
| Invalid hex color (`#GGG`) | Reject — "Invalid color format" (400) |
| No color provided | Default to `#3B82F6` |
| 3-digit hex (`#F00`) | Reject — require full 6 digit format |
| Color without `#` prefix | Reject — "Invalid color format" (400) |

### Tag Editing

| Scenario | Expected Behavior |
|----------|-------------------|
| Rename to existing name | Reject — "Tag name already exists" (409) |
| Rename to same name (self) | Allowed — no conflict |
| Change color only | Name unchanged, color updated |
| Change name only | Color unchanged, name updated |
| Edit non-existent tag | 404 "Tag not found" |
| Edit another user's tag | 404 "Tag not found" (user_id scoping) |

### Tag Deletion

| Scenario | Expected Behavior |
|----------|-------------------|
| Delete tag with associations | Tag removed, `todo_tags` rows cascade-deleted, todos preserved |
| Delete tag with no associations | Tag removed cleanly |
| Delete non-existent tag | 404 "Tag not found" |
| Delete another user's tag | 404 "Tag not found" |

### Tag Assignment

| Scenario | Expected Behavior |
|----------|-------------------|
| Assign 0 tags | All tag associations removed |
| Assign 1 tag | Single association created |
| Assign multiple tags | All associations created |
| Re-assign (replace) tags | Old associations removed, new ones created |
| Assign tag to non-existent todo | 404 "Todo not found" |
| Assign non-existent tag ID | `INSERT OR IGNORE` — silently skipped or foreign key error |
| Assign same tag twice | `INSERT OR IGNORE` prevents duplicate |

### Tag Display

| Scenario | Expected Behavior |
|----------|-------------------|
| Todo with 0 tags | No tag pills shown |
| Todo with 1 tag | Single colored pill |
| Todo with many tags | Pills wrap to next line on mobile |
| Tag with long name | Pill expands to fit, text truncated if needed |
| Dark mode | White text on colored background readable |
| Custom color on red overdue background | Tag pills distinguishable |

### Filtering

| Scenario | Expected Behavior |
|----------|-------------------|
| Filter by tag with 0 matching todos | Empty sections, no results |
| Filter by tag + priority | AND logic, both must match |
| Filter by tag + search | AND logic, both must match |
| Tag deleted while filter active | Filter cleared, all todos shown |
| Dropdown shows no tags | "All Tags" only option |

---

## Acceptance Criteria

### Tag Management

- [ ] "+ Manage Tags" button opens the tag management modal
- [ ] Tag creation form has name input, color picker, hex input, and "Create Tag" button
- [ ] Default color is `#3B82F6` (blue)
- [ ] Creating a tag with a name and color adds it to the list
- [ ] Tag names are unique per user (case-insensitive)
- [ ] Duplicate name is rejected with a clear error message
- [ ] Empty/whitespace-only name is rejected
- [ ] Invalid hex color is rejected
- [ ] "Edit" button populates form with current tag values
- [ ] Updating name and/or color saves correctly
- [ ] Editing a tag reflects on all todos using it
- [ ] "Delete" button removes the tag and its associations
- [ ] Deleting a tag does NOT delete the associated todos

### Tag Selection on Todos

- [ ] Tag pills appear below the todo create form (when tags exist)
- [ ] Clicking a pill toggles selection (selected/unselected)
- [ ] Selected pills show ✓ prefix, tag color background, white text
- [ ] Unselected pills show gray border, gray text, white/gray background
- [ ] Multiple tags can be selected simultaneously
- [ ] Selected tags are sent to the API on todo creation
- [ ] Edit modal shows tag pills pre-selected with current tags
- [ ] Updated tag selections are saved on edit

### Tag Display on Todos

- [ ] Color-coded tag pills appear on todos after other badges
- [ ] Pills show tag name in white text on the tag's color background
- [ ] Pills are rounded-full for visual appeal
- [ ] Tags are visible in all sections (Overdue, Pending, Completed)
- [ ] Tags adapt for dark mode
- [ ] Multiple tags wrap cleanly on narrow screens

### Tag Filtering

- [ ] "All Tags" dropdown appears in the filter bar
- [ ] Dropdown populates with the user's tags
- [ ] Selecting a tag filters the todo list to matching todos only
- [ ] Selecting "All Tags" clears the filter
- [ ] Section counters update with filtered counts
- [ ] Tag filter combines with priority and search filters (AND logic)

### Tag Inheritance (Recurring)

- [ ] Completing a recurring todo copies tag associations to the new instance
- [ ] New instance displays the same tag pills

### Validation & Security

- [ ] All tag endpoints return 401 without a valid session
- [ ] Users cannot see, edit, or delete other users' tags
- [ ] Color format validated: `#` + 6 hex digits
- [ ] Tag name trimmed before storage
- [ ] SQL injection prevented via prepared statements

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/06-tags.spec.ts

import { test, expect } from '@playwright/test'
import { TodoHelper } from './helpers'

test.describe('Tag System', () => {

  test('should open tag management modal', async ({ page }) => {
    await page.click('button:has-text("Manage Tags")')
    await expect(page.getByText('Manage Tags')).toBeVisible()
    await expect(page.getByPlaceholder('Tag name')).toBeVisible()
  })

  test('should create a tag', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTag('Work', '#3B82F6')

    // Tag should appear in the modal list
    await expect(page.getByText('Work')).toBeVisible()
  })

  test('should create tag with custom color', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTag('Personal', '#10B981')

    await expect(page.getByText('Personal')).toBeVisible()
  })

  test('should reject duplicate tag name', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTag('Work', '#3B82F6')
    await helper.createTag('Work', '#EF4444') // Duplicate

    // Should show error or not create second tag
    // Verify only one "Work" tag exists
  })

  test('should edit a tag name', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTag('Wrk', '#3B82F6')

    // Click Edit
    await page.click('button:has-text("Edit")')
    await page.fill('input[placeholder="Tag name"]', 'Work')
    await page.click('button:has-text("Update")')

    await expect(page.getByText('Work')).toBeVisible()
  })

  test('should delete a tag', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTag('Temporary', '#F59E0B')

    await page.click('button:has-text("Delete")')

    await expect(page.getByText('Temporary')).not.toBeVisible()
  })

  test('should assign tags to a todo', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTag('Work', '#3B82F6')

    // Close the modal
    await page.click('button:has-text("Close")')

    // Select the tag and create a todo
    await page.click('button:has-text("Work")') // Select tag pill
    await helper.createTodo('Tagged task')

    // Verify tag pill on the todo
    const todoPill = page.locator('[data-testid="todo-item"]:has-text("Tagged task") >> text=Work')
    await expect(todoPill).toBeVisible()
  })

  test('should assign multiple tags to a todo', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTag('Work', '#3B82F6')
    await helper.createTag('Urgent', '#EF4444')
    await page.click('button:has-text("Close")')

    // Select both tags
    await page.click('button:has-text("Work")')
    await page.click('button:has-text("Urgent")')
    await helper.createTodo('Multi-tag task')

    const todoItem = page.locator('[data-testid="todo-item"]:has-text("Multi-tag task")')
    await expect(todoItem.getByText('Work')).toBeVisible()
    await expect(todoItem.getByText('Urgent')).toBeVisible()
  })

  test('should update tags via edit modal', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTag('Work', '#3B82F6')
    await helper.createTag('Personal', '#10B981')
    await page.click('button:has-text("Close")')

    // Create todo with Work tag
    await page.click('button:has-text("Work")')
    await helper.createTodo('Edit tags test')

    // Edit and change to Personal
    await page.click('button:has-text("Edit")')
    await page.click('button:has-text("Work")') // Deselect
    await page.click('button:has-text("Personal")') // Select
    await page.click('button:has-text("Update")')

    const todoItem = page.locator('[data-testid="todo-item"]:has-text("Edit tags test")')
    await expect(todoItem.getByText('Personal')).toBeVisible()
    await expect(todoItem.getByText('Work')).not.toBeVisible()
  })

  test('should filter by tag', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTag('Work', '#3B82F6')
    await page.click('button:has-text("Close")')

    // Create one tagged and one untagged todo
    await page.click('button:has-text("Work")')
    await helper.createTodo('Work task')
    await helper.createTodo('Personal task') // No tag

    // Apply tag filter
    await page.selectOption('[data-testid="tag-filter"]', { label: 'Work' })

    await expect(page.getByText('Work task')).toBeVisible()
    await expect(page.getByText('Personal task')).not.toBeVisible()
  })

  test('should clear tag filter', async ({ page }) => {
    // Apply and then clear the filter
    await page.selectOption('[data-testid="tag-filter"]', '')

    // All todos should be visible again
  })

  test('should display tag pills in correct colors', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTag('Red Tag', '#EF4444')
    await page.click('button:has-text("Close")')

    await page.click('button:has-text("Red Tag")')
    await helper.createTodo('Colored tag test')

    const pill = page.locator('[data-testid="todo-item"]:has-text("Colored tag test") >> text=Red Tag')
    await expect(pill).toHaveCSS('background-color', 'rgb(239, 68, 68)')
  })

  test('should remove tag pill when tag is deleted', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTag('Temp', '#F59E0B')
    await page.click('button:has-text("Close")')

    await page.click('button:has-text("Temp")')
    await helper.createTodo('Temp tagged')

    // Verify pill exists
    await expect(page.locator('[data-testid="todo-item"] >> text=Temp')).toBeVisible()

    // Delete the tag
    await page.click('button:has-text("Manage Tags")')
    await page.click('button:has-text("Delete")')
    await page.click('button:has-text("Close")')

    // Pill should be gone, todo should still exist
    await expect(page.getByText('Temp tagged')).toBeVisible()
    await expect(page.locator('[data-testid="todo-item"] >> text=Temp')).not.toBeVisible()
  })
})
```

### Test Helper Extension

```typescript
// tests/helpers.ts — add to TodoHelper class

export class TodoHelper {
  // ... existing methods

  async createTag(name: string, color: string = '#3B82F6') {
    // Open modal if not already open
    const modal = this.page.getByText('Manage Tags')
    if (!(await modal.isVisible())) {
      await this.page.click('button:has-text("Manage Tags")')
    }

    await this.page.fill('input[placeholder="Tag name"]', name)
    // Set color via hex input
    await this.page.fill('input[placeholder="#3B82F6"]', color)
    await this.page.click('button:has-text("Create Tag")')
  }
}
```

### API Integration Tests

```typescript
test('POST /api/tags creates a tag', async () => {
  const res = await fetch('/api/tags', {
    method: 'POST',
    body: JSON.stringify({ name: 'Work', color: '#3B82F6' }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(201)
  const tag = await res.json()
  expect(tag.name).toBe('Work')
  expect(tag.color).toBe('#3B82F6')
})

test('POST /api/tags rejects duplicate name', async () => {
  await createTag('Work')
  const res = await fetch('/api/tags', {
    method: 'POST',
    body: JSON.stringify({ name: 'Work' }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(409)
})

test('POST /api/tags rejects invalid color', async () => {
  const res = await fetch('/api/tags', {
    method: 'POST',
    body: JSON.stringify({ name: 'Bad Color', color: 'not-a-color' }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(400)
})

test('DELETE /api/tags/:id cascades to todo_tags', async () => {
  const tag = await createTag('Cascade')
  const todo = await createTestTodo()
  await associateTag(todo.id, tag.id)

  // Delete the tag
  const res = await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })
  expect(res.status).toBe(200)

  // Todo should still exist, but without the tag
  const todoRes = await fetch(`/api/todos/${todo.id}`)
  const updatedTodo = await todoRes.json()
  expect(updatedTodo.tags).toEqual([])
})

test('POST /api/todos/:id/tags replaces all associations', async () => {
  const tag1 = await createTag('Tag1')
  const tag2 = await createTag('Tag2')
  const todo = await createTestTodo()

  // Set tags
  const res = await fetch(`/api/todos/${todo.id}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tagIds: [tag1.id, tag2.id] }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(200)

  const tags = await res.json()
  expect(tags).toHaveLength(2)

  // Replace with only tag1
  const res2 = await fetch(`/api/todos/${todo.id}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tagIds: [tag1.id] }),
    headers: { 'Content-Type': 'application/json' },
  })
  const tags2 = await res2.json()
  expect(tags2).toHaveLength(1)
  expect(tags2[0].id).toBe(tag1.id)
})

test('returns 401 for unauthenticated tag requests', async () => {
  const res = await fetch('/api/tags', { headers: {} })
  expect(res.status).toBe(401)
})
```

---

## Out of Scope

These are related features handled by other PRPs:

- Todo CRUD basics → **PRP 01**
- Priority system → **PRP 02**
- Recurring tag inheritance on completion → **PRP 03**
- Reminders and notifications → **PRP 04**
- Subtasks (independent of tags) → **PRP 05**
- Template storage (templates don't store tags) → **PRP 07**
- Combined multi-criteria filtering → **PRP 08**
- Export/import tag data → **PRP 09**
- Calendar tag display → **PRP 10**
- Tag autocomplete/suggestions → Future enhancement
- Tag usage statistics → Future enhancement
- Tag hierarchy/nesting → Future enhancement
- Bulk tag operations → Future enhancement

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Tag CRUD response time | < 100ms |
| Tag uniqueness enforcement | 100% — no duplicate names per user |
| Color validation | 100% — only valid hex codes accepted |
| Cascade delete correctness | 100% — no orphaned junction rows |
| Filter accuracy | 100% — shows only todos with selected tag |
| Badge color accuracy | 100% — matches stored hex value |
| E2E test pass rate | 100% |
| Recurring inheritance | 100% — tags copied to new instance |
| Dark mode readability | WCAG AA — white text on color backgrounds |

---

## Implementation Notes

### Project-Specific Patterns

1. **Two tables** — `tags` for tag definitions, `todo_tags` for the many-to-many junction.
2. **`todoTagDB.replaceAll()`** — the tag assignment endpoint replaces all associations atomically (delete all, insert new). Simpler than diffing.
3. **`INSERT OR IGNORE`** in `todoTagDB.create()` — prevents duplicate junction rows without error.
4. **Tags enriched in GET /api/todos** — each todo includes its `tags: Tag[]` array so the client doesn't need separate requests.
5. **Color picker + hex input** — the modal provides both an `<input type="color">` and a text input for the hex code. They are synced via state.
6. **User-scoped uniqueness** — `UNIQUE(user_id, name)` constraint. Different users can have tags with the same name.
7. **Case-insensitive uniqueness check** — done in the API (`toLowerCase()` comparison), not in SQLite.
8. **`PRAGMA foreign_keys = ON`** — must be enabled for cascade deletes to work on the junction table.
9. **`params` is async** in Next.js 16 — always `const { id } = await params`.
10. **Immutability** — use `prev.filter()` and `[...prev, tagId]` for tag selection state, never mutate.

### File Locations

```
app/api/tags/route.ts              # GET (list), POST (create) tags
app/api/tags/[id]/route.ts         # PUT (update), DELETE tag
app/api/todos/[id]/tags/route.ts   # POST — set tag associations
lib/db.ts                           # tagDB, todoTagDB, Tag interface
app/page.tsx                        # UI: modal, pills, filter dropdown, badges
```

### Dependencies

No additional npm packages. Uses:
- `better-sqlite3` for tag and junction table operations
- HTML `<input type="color">` for the color picker (native browser)
- Tailwind CSS for pill styling and dark mode
- `style={{ backgroundColor: tag.color }}` for dynamic tag colors
