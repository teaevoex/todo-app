# PRP-07: Template System

**Depends on:** PRP-05 (Subtasks & Progress Tracking), PRP-06 (Tag System)
**Feature:** Save todo patterns as reusable templates, create todos from them
**Last updated:** 2026-04-08

---

## 1. Feature Overview

The Template System lets users capture a todo's configuration (title pattern, priority, recurrence, reminder, subtask list, due-date offset) as a named template they can reuse. Instead of manually recreating recurring task patterns—such as a weekly meeting preparation checklist or a monthly report workflow—a user saves the pattern once and instantiates it in one click.

Templates are user-scoped records in the `templates` table. Each template stores subtasks as a JSON string (`subtasks_json`) that is deserialized on use. When a user triggers "Use template," the system creates a new todo with all inherited properties and immediately creates each subtask, calculating the due date by adding `due_date_offset_days` to the current Singapore date. Tags stored in a template are also re-applied to the new todo.

A lightweight `TemplateManager` modal allows users to browse all their templates, preview key settings in `TemplateCard` components, and trigger use or deletion. A `SaveTemplateModal` is opened from a todo item to snapshot that todo's current configuration.

---

## 2. User Stories

1. **As a user**, I want to save a todo (with its subtasks and settings) as a template so that I can quickly create similar todos in future.
2. **As a user**, I want to browse my saved templates and apply one with a single click so that the new todo is pre-populated.
3. **As a user**, I want a due date to be automatically calculated from the template's offset when I use a template, so that I don't have to manually set dates each time.
4. **As a user**, I want to delete a template I no longer need without affecting any todos created from it.
5. **As a user**, I want to assign a category to a template so that I can organise them by type (e.g. "Work", "Personal", "Project").
6. **As a user (edge case)**, when a template has `due_date_offset_days = null`, the created todo has no due date.
7. **As a user (edge case)**, when a template has an empty subtasks list, the created todo is simply created with no subtasks.
8. **As a user (edge case)**, if using a template fails mid-way (todo created but subtask creation errors), the system surfaces the error and the partially created todo is visible so no data is silently lost.

---

## 3. Technical Requirements

### 3.1 Architecture Reference

| Layer | File | Responsibility |
|-------|------|---------------|
| DB module | `lib/db/templates.ts` | CRUD for `templates` table (synchronous) |
| DB migration | `lib/db/connection.ts` | `CREATE TABLE IF NOT EXISTS templates …` |
| API routes | `app/api/templates/route.ts` | GET list, POST create |
| API routes | `app/api/templates/[id]/route.ts` | PUT update, DELETE delete |
| API routes | `app/api/templates/[id]/use/route.ts` | POST – create todo + subtasks from template |
| API client | `lib/api/templates.ts` | `fetchTemplates`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `useTemplate` |
| Types | `lib/types/template.ts` | `Template`, `CreateTemplateDto`, `SubtaskBlueprint` |
| Hook | `lib/hooks/useTemplates.ts` | TanStack Query queries + mutations |
| Components | `components/templates/` | `TemplateManager`, `SaveTemplateModal`, `TemplateCard` |

### 3.2 Database Schema

```sql
-- Add to lib/db/connection.ts schema initialisation block

CREATE TABLE IF NOT EXISTS templates (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL,
  name                  TEXT    NOT NULL,
  description           TEXT,
  category              TEXT,                  -- free-text; suggestions provided by UI
  title_template        TEXT    NOT NULL,      -- e.g. "Weekly Team Sync"
  priority              TEXT    NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('high', 'medium', 'low')),
  is_recurring          INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern    TEXT
                          CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly', NULL)),
  reminder_minutes      INTEGER,               -- same set as todos: 15,30,60,120,1440,2880,10080
  subtasks_json         TEXT    NOT NULL DEFAULT '[]',  -- JSON: [{title:string, position:number}]
  due_date_offset_days  INTEGER,               -- null = no due date; 0 = today; 7 = next week
  tag_ids_json          TEXT    NOT NULL DEFAULT '[]',  -- JSON: number[] of tag ids to assign
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_templates_user_id  ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(user_id, category);
```

**`subtasks_json` schema:**
```typescript
// Stored as JSON string; typed as:
type SubtaskBlueprint = { title: string; position: number }
// Example: '[{"title":"Review agenda","position":0},{"title":"Send notes","position":1}]'
```

**`tag_ids_json` schema:**
```typescript
// Stored as JSON string; typed as number[] of tag ids
// Example: '[3, 7]'
// Note: tag ids are resolved at use-time; stale ids are silently skipped
```

### 3.3 API Endpoints

#### GET `/api/templates`

Returns all templates owned by the authenticated user.

**Response `200`:**
```typescript
{
  success: true,
  data: Template[]   // ordered by created_at DESC
}
```

---

#### POST `/api/templates`

Creates a new template.

**Request body:**
```typescript
{
  name:                 string          // 1-100 chars
  description?:         string          // max 500 chars
  category?:            string          // max 50 chars
  title_template:       string          // 1-200 chars
  priority?:            'high' | 'medium' | 'low'   // default 'medium'
  is_recurring?:        boolean         // default false
  recurrence_pattern?:  'daily' | 'weekly' | 'monthly' | 'yearly' | null
  reminder_minutes?:    number | null
  subtasks_json?:       string          // valid JSON array of SubtaskBlueprint
  due_date_offset_days?: number | null  // integer or null
  tag_ids_json?:        string          // valid JSON array of numbers
}
```

**Response `201`:**
```typescript
{ success: true, data: Template }
```

**Errors:**
- `400` – validation failure (detailed field errors)
- `401` – unauthenticated

---

#### PUT `/api/templates/[id]`

Updates any subset of template fields.

**Request body:** Same shape as POST; all fields optional (at least one required).

**Response `200`:**
```typescript
{ success: true, data: Template }
```

**Errors:**
- `400` – validation
- `404` – not found or not owned
- `401` – unauthenticated

---

#### DELETE `/api/templates/[id]`

Deletes a template. Does NOT affect todos created from it.

**Response `200`:**
```typescript
{ success: true }
```

**Errors:**
- `404` – not found or not owned
- `401` – unauthenticated

---

#### POST `/api/templates/[id]/use`

Creates a new todo (and its subtasks and tag assignments) from the template.

**Request body:** *(optional overrides)*
```typescript
{
  title_override?:       string   // override title_template
  due_date_override?:    string   // ISO 8601; overrides offset calculation
}
```

**Server logic:**
```typescript
// 1. Load template (verify ownership)
// 2. Calculate due_date
const dueDate = due_date_override
  ?? (due_date_offset_days !== null
      ? addDays(getSingaporeNow(), due_date_offset_days).toISOString()
      : null)
// 3. CREATE todo with template fields + calculated due_date
// 4. Parse subtasks_json → create each subtask via subtaskDB.create()
// 5. Parse tag_ids_json → assign each valid tag via tagDB.assignToTodo()
//    (silently skip tag ids that no longer exist)
// 6. Return created todo with subtasks and tags
```

**Response `201`:**
```typescript
{
  success: true,
  data: Todo   // fully populated: includes subtasks[] and tags[]
}
```

**Errors:**
- `404` – template not found or not owned
- `400` – title_override > 200 chars; invalid due_date_override format
- `401` – unauthenticated
- `500` – unexpected DB error

---

### 3.4 TypeScript Types

```typescript
// lib/types/template.ts

export interface SubtaskBlueprint {
  title:    string
  position: number
}

export interface Template {
  id:                   number
  user_id:              number
  name:                 string
  description:          string | null
  category:             string | null
  title_template:       string
  priority:             'high' | 'medium' | 'low'
  is_recurring:         boolean
  recurrence_pattern:   'daily' | 'weekly' | 'monthly' | 'yearly' | null
  reminder_minutes:     number | null
  subtasks_json:        string              // raw JSON string stored in DB
  subtasks:             SubtaskBlueprint[] // parsed; added by API layer
  due_date_offset_days: number | null
  tag_ids_json:         string             // raw JSON string stored in DB
  tag_ids:              number[]           // parsed; added by API layer
  created_at:           string            // ISO 8601, Singapore TZ
}

export interface CreateTemplateDto {
  name:                 string
  description?:         string
  category?:            string
  title_template:       string
  priority?:            'high' | 'medium' | 'low'
  is_recurring?:        boolean
  recurrence_pattern?:  'daily' | 'weekly' | 'monthly' | 'yearly' | null
  reminder_minutes?:    number | null
  subtasks?:            SubtaskBlueprint[]
  due_date_offset_days?: number | null
  tag_ids?:             number[]
}

export interface UseTemplateDto {
  title_override?:    string
  due_date_override?: string
}
```

**Predefined category suggestions** (displayed in UI, not enforced in DB):
```typescript
// lib/tokens/templates.ts
export const TEMPLATE_CATEGORIES = [
  'Work', 'Personal', 'Project', 'Health', 'Finance', 'Learning', 'Other'
]
```

---

## 4. React Components

### 4.1 Component Tree (ASCII)

```
AppShell / Header
└── <button "Templates"> → opens TemplateManager

TemplateManager (modal)
├── <header> Templates + <button "New from current todo" or "Close">
├── CategoryFilter tabs (All | Work | Personal | …)
├── TemplateCard[]     (grid or list)
│   ├── <h3> name
│   ├── <p> description (truncated)
│   ├── SettingsBadges (priority badge, recurrence badge, subtask count, tag badges)
│   ├── <button "Use">    → calls useTemplate mutation
│   └── <button "Delete"> → ConfirmDialog → calls deleteTemplate mutation
└── EmptyState  (when no templates)

TodoItem
└── <button "Save as template"> → opens SaveTemplateModal

SaveTemplateModal (modal)
├── <input> Template name
├── <input> Description (optional)
├── <input + datalist> Category
├── <input type="number"> Due date offset days (optional)
├── ReadOnlyPreview (title, priority, recurrence, reminder, subtasks count, tags)
└── <button "Save Template">
```

---

### 4.2 Component Specifications

#### `TemplateManager`

**File:** `components/templates/TemplateManager.tsx` (≤ 250 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | ✓ | Modal visibility |
| `onClose` | `() => void` | ✓ | Dismiss handler |

**State:**
- `categoryFilter: string | null` — active category tab
- Data from `useTemplates().templatesQuery`

**Filtering logic (client-side):**
```typescript
const displayed = categoryFilter
  ? templates.filter(t => t.category === categoryFilter)
  : templates
```

**Implementation:** Uses shadcn `Dialog` from `@/components/ui/dialog` and `Tabs` from `@/components/ui/tabs`:
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
```

**Design tokens:** uses shadcn classes — `max-w-[640px]` for modal width, `grid grid-cols-1 md:grid-cols-2 gap-4` for template grid

**Accessibility:**
- `aria-label="Templates"` — set via `DialogTitle`
- Focus trapped inside modal (shadcn Dialog / Radix UI)
- `data-testid="template-manager-modal"` on `DialogContent`
- Category tabs: shadcn `Tabs` component provides `role="tablist"` / `role="tab"` / `aria-selected` automatically

---

#### `SaveTemplateModal`

**File:** `components/templates/SaveTemplateModal.tsx` (≤ 180 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | ✓ | Modal visibility |
| `onClose` | `() => void` | ✓ | Dismiss handler |
| `sourceTodo` | `Todo` | ✓ | The todo being saved as template |

**State:**
- `name: string` — defaults to `sourceTodo.title`
- `description: string` — empty default
- `category: string` — empty default
- `dueDateOffsetDays: number | null` — empty default
- `isSubmitting: boolean`

**Submission logic:**
- Serialize `sourceTodo.subtasks` → `SubtaskBlueprint[]`
- Serialize `sourceTodo.tags` → `number[]` (tag ids)
- Call `useTemplates().createTemplate.mutateAsync(dto)`

**Implementation:** Uses shadcn `Dialog`, `Input`, `Label`, `Button` from `@/components/ui/*`:
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
```

**Design tokens:** uses shadcn classes — `max-w-[400px]` for modal width, `bg-muted` for preview section

**Accessibility:**
- `aria-label="Save as template"` — set via `DialogTitle`
- `data-testid="save-template-modal"`
- `data-testid="template-name-input"`
- `data-testid="template-category-input"`
- `data-testid="template-offset-input"`
- `data-testid="save-template-submit"`

---

#### `TemplateCard`

**File:** `components/templates/TemplateCard.tsx` (≤ 120 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `template` | `Template` | ✓ | Template data |
| `onUse` | `(id: number) => void` | ✓ | Use button handler |
| `onDelete` | `(id: number) => void` | ✓ | Delete button handler |

**Rendering:**
- Shows `name`, `description` (max 2 lines, clamp), `category` badge
- Shows priority badge, recurrence label, reminder label
- Shows subtasks count (e.g. "3 subtasks")
- Shows tag badges from `tag_ids` (looked up from `useTags()` data)
- Due date offset: "Due in N days" or "No due date"

**Implementation:** Uses shadcn `Card` from `@/components/ui/card`:
```tsx
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'

<Card className="hover:shadow-md transition-shadow" data-testid={`template-card-${template.id}`}>
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
```

**Design tokens:** uses shadcn classes — `bg-card text-card-foreground`, `rounded-lg shadow-sm`, `p-4`

**Accessibility:**
- `data-testid="template-card-{id}"`
- Use button: `data-testid="use-template-{id}"` `aria-label="Use template: {name}"`
- Delete button: `data-testid="delete-template-{id}"` `aria-label="Delete template: {name}"`

---

## 5. TanStack Query Hooks

### `useTemplates()`

**File:** `lib/hooks/useTemplates.ts`

```typescript
const templateKeys = {
  all: ['templates'] as const,
}

export function useTemplates() {
  const queryClient = useQueryClient()

  const templatesQuery = useQuery({
    queryKey: templateKeys.all,
    queryFn:  fetchTemplates,
    staleTime: 60_000,   // 1 minute
    gcTime:    300_000,  // 5 minutes
  })

  const createTemplate = useMutation({
    mutationFn: (dto: CreateTemplateDto) => apiCreateTemplate(dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
  })

  const updateTemplate = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateTemplateDto> }) =>
      apiUpdateTemplate(id, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
  })

  const deleteTemplate = useMutation({
    mutationFn: (id: number) => apiDeleteTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templateKeys.all }),
  })

  const useTemplateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto?: UseTemplateDto }) =>
      apiUseTemplate(id, dto),
    onSuccess: () => {
      // New todo was created; invalidate todos list
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })

  return { templatesQuery, createTemplate, updateTemplate, deleteTemplate, useTemplateMutation }
}
```

**Stale/cache times:** Templates are infrequently modified — 1 min stale / 5 min gc.

**Optimistic updates:** Not used — template use creates a full todo record; optimistic creation would require fake IDs and is error-prone.

**Invalidation targets:**
- `['templates']` — after create/update/delete
- `['todos']` — after `useTemplateMutation` success (new todo appeared)

---

## 6. State Management

| Context | Read | Written |
|---------|------|---------|
| `QueryClient` | `useQueryClient()` | `invalidateQueries(['templates'])`, `invalidateQueries(['todos'])` |

**Local state:**
- `TemplateManager`: `categoryFilter: string | null` — active category tab
- `SaveTemplateModal`: form field states
- `TemplateCard`: no local state (stateless display)

**URL state:** None — template browser is a modal, no URL routing needed.

**Data serialization note:**
- `subtasks_json` is serialized in `lib/db/templates.ts` using `JSON.stringify()` before INSERT and deserialized using `JSON.parse()` before returning from API.
- API layer adds `subtasks: SubtaskBlueprint[]` (parsed) and `tag_ids: number[]` (parsed) fields to the `Template` object before JSON response, keeping raw `*_json` strings internal.

---

## 7. Test Specifications

### 7.1 E2E Tests (Playwright)

**File:** `tests/08-template-system.spec.ts`

#### Test: "Save a todo as a template"
```
1. Create todo "Weekly sync" with priority=high, 2 subtasks ("Prepare agenda", "Send invite"), tag "Work"
2. Click [data-testid="save-as-template-{todoId}"]
3. Assert [data-testid="save-template-modal"] visible
4. [data-testid="template-name-input"] should pre-fill with "Weekly sync"
5. Type "7" into [data-testid="template-offset-input"]
6. Click [data-testid="save-template-submit"]
7. Open TemplateManager modal
8. Assert [data-testid="template-card-{id}"] visible with "Weekly sync", "2 subtasks"
```

#### Test: "Use a template to create a todo"
```
1. Setup: template "Weekly sync" with offset 7, subtasks ["Prepare agenda", "Send invite"]
2. Open TemplateManager
3. Click [data-testid="use-template-{id}"]
4. Assert modal closes
5. Find new todo "Weekly sync" in todo list [data-testid="todo-item-{newTodoId}"]
6. Assert todo due_date is today + 7 days (Singapore date)
7. Expand subtasks panel
8. Assert subtasks "Prepare agenda" and "Send invite" present
```

#### Test: "Template with no due date offset creates todo with no due date"
```
1. Create template with due_date_offset_days=null
2. Use template
3. Assert created todo has no due date badge
```

#### Test: "Delete a template does not affect existing todos"
```
1. Setup: template "T1", use it to create todo "Task from T1"
2. Delete template "T1": [data-testid="delete-template-{id}"] → confirm
3. Assert template card gone from TemplateManager
4. Assert "Task from T1" still exists in todo list
```

#### Test: "Category filter in TemplateManager"
```
1. Create templates: "Work template" (category=Work), "Personal template" (category=Personal)
2. Open TemplateManager
3. Click "Work" category tab
4. Assert only "Work template" visible
5. Click "All"
6. Assert both visible
```

---

### 7.2 Unit Tests

**File:** `lib/db/templates.test.ts`

| Function | Input | Expected Output |
|----------|-------|----------------|
| `templateDB.create(userId, dto)` | valid dto | Returns `Template` with `subtasks: []` parsed |
| `templateDB.create(userId, dto)` with subtasks | `subtasks_json: '[{"title":"A","position":0}]'` | Returns template; `subtasks[0].title === 'A'` |
| `templateDB.update(id, {name:'New'})` | existing id | Returns updated template |
| `templateDB.delete(id)` | existing id | Row removed |
| `templateDB.findByUserId(userId)` | valid userId | Returns array ordered by `created_at DESC` |
| Subtask blueprint serialisation | `[{title:'A',position:0}]` → stringify → parse | Round-trips without data loss |

**File:** `app/api/templates/[id]/use/route.test.ts` (unit-level with mocked DB)

| Scenario | Input | Expected |
|----------|-------|----------|
| Offset 7, no override | `due_date_offset_days=7` | `due_date` = today+7 Singapore date |
| Offset 0 | `due_date_offset_days=0` | `due_date` = today Singapore date |
| Null offset | `due_date_offset_days=null` | `due_date` = null |
| Due date override | `due_date_override='2026-05-01T00:00:00+08:00'` | `due_date` = provided value |
| Stale tag id | `tag_ids_json='[9999]'` | Tag silently skipped; todo created |
| Empty subtasks | `subtasks_json='[]'` | No subtasks created; todo created |

---

### 7.3 Integration Tests

**File:** `tests/contracts/todo-templates.contract.test.ts`

```
1. POST /api/templates {name:"T1", title_template:"Task", subtasks:[{title:"Step A",position:0}], due_date_offset_days:3}
   → assert 201, templateId saved
2. GET /api/templates → response includes template with subtasks array
3. POST /api/templates/{templateId}/use {}
   → assert 201, response.data.title === "Task"
   → response.data.subtasks.length === 1
   → response.data.due_date is approx today+3 days (SGT)
4. GET /api/todos → new todo present
5. PUT /api/templates/{templateId} {name:"T1 Updated"} → assert 200
6. DELETE /api/templates/{templateId} → assert 200
7. GET /api/todos → todo created in step 3 still exists (not deleted)
8. GET /api/templates → empty array
```

---

## 8. Acceptance Criteria

1. A user can save any todo as a template, capturing title, priority, recurrence, reminder, subtask list, and tag associations.
2. Template name is required (1–100 characters); submission with empty name is rejected.
3. A user can optionally set a category and description on a template.
4. A user can specify `due_date_offset_days`; using the template creates a todo with `due_date = today + offset` (Singapore date).
5. When `due_date_offset_days` is null, the created todo has no due date.
6. Using a template creates both the todo and all subtasks in a single API call.
7. Tag ids stored in the template are applied to the newly created todo; stale/missing tag ids are silently skipped.
8. Deleting a template does not affect todos previously created from it.
9. A user can filter templates in `TemplateManager` by category.
10. `TemplateCard` displays: name, description (truncated), priority, recurrence, subtask count, due date offset, and tag badges.
11. `subtasks_json` is a valid JSON array and round-trips without data loss.
12. `tag_ids_json` is a valid JSON array and round-trips without data loss.
13. The `use` endpoint is atomic with respect to todo creation: if the todo INSERT fails, no subtasks or tag assignments are created.
14. A user can delete a template from `TemplateManager` with a confirmation step.

---

## 9. Integration Points

### 9.1 What This Feature Consumes

| Feature | Usage |
|---------|-------|
| PRP-01 Todo CRUD | `todos` table (creates todos on use), `todoDB.create()`, authenticated session |
| PRP-05 Subtasks | `subtasks` table, `subtaskDB.create()` — called per blueprint when using template |
| PRP-06 Tag System | `tags` table, `tagDB.assignToTodo()` — re-applies saved tag ids |
| `lib/timezone.ts` | `getSingaporeNow()` + date arithmetic for `due_date_offset_days` |
| `lib/db/connection.ts` | Schema init must include `templates` table |
| `components/ui/dialog` | `TemplateManager` and `SaveTemplateModal` use shadcn Dialog |
| `components/ui/card` | `TemplateCard` uses shadcn Card |
| `components/ui/input` | Form inputs in `SaveTemplateModal` |
| `components/ui/label` | Form labels in `SaveTemplateModal` |
| `components/ui/button` | Action buttons throughout |
| `components/ui/select` | Category and other selects |
| `components/ui/tabs` | Category filter tabs in `TemplateManager` |

### 9.2 What This Feature Exposes

| Artifact | Consumed by |
|----------|-------------|
| `lib/types/template.ts` | Future export/import (PRP-09) serialises templates |
| `lib/db/templates.ts` | Any agent implementing template management |
| `lib/hooks/useTemplates.ts` | `TemplateManager`, `SaveTemplateModal`, any page needing templates |
| `TemplateManager` component | Header navigation |
| `SaveTemplateModal` component | `TodoItem` (save-as-template action) |
| `TEMPLATE_CATEGORIES` constant | `SaveTemplateModal` datalist, `TemplateManager` category tabs |

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Empty template name | `400` – "Name is required" |
| Template name > 100 chars | `400` – "Name must be ≤ 100 characters" |
| `subtasks_json` is not valid JSON | `400` – "subtasks_json must be a valid JSON array" |
| `tag_ids_json` is not valid JSON | `400` – "tag_ids_json must be a valid JSON array" |
| `due_date_override` is not ISO 8601 | `400` – "due_date_override must be a valid ISO 8601 date" |
| Tag id in `tag_ids_json` no longer exists | Silently skipped; remaining tags assigned normally |
| Todo creation succeeds but first subtask fails | Partial state: todo exists with 0 subtasks; error returned to client with 500; client shows error toast |
| Using template when user has hit a (future) todo limit | Forward error from todo creation to client |
| Template with `recurrence_pattern` set | Created todo inherits recurrence; same validation as PRP-03 |
| Very long `title_template` (≤200 chars) | Valid; created todo title = template title (or override) |
| `title_override` longer than 200 chars | `400` – "Title must be ≤ 200 characters" |
| Deleting tag that is referenced in a template | Tag id stays in `tag_ids_json`; on next use it is silently skipped |
| Concurrent "Use template" calls | Each creates independent todos; no race condition |
| Category string with special characters | Stored as UTF-8 TEXT; no restrictions |
| Description > 500 chars | `400` – "Description must be ≤ 500 characters" |
| `due_date_offset_days` negative | Allowed; creates todo due in the past (e.g., -1 = yesterday) |

---

## 11. Out of Scope

- Editing an existing template's subtask list through the UI (delete + recreate is the workaround)
- Sharing templates between users
- Template versioning or history
- Scheduling template use automatically (cron-style)
- Template import/export (covered by PRP-09)
- Template usage analytics (number of times used)
- Nested templates

---

## 12. Singapore Timezone Considerations

- `getSingaporeNow()` from `lib/timezone.ts` MUST be used when computing `due_date` from `due_date_offset_days`.
- Date arithmetic:
  ```typescript
  import { getSingaporeNow, toSingaporeISO } from '@/lib/timezone'
  import { addDays } from 'date-fns'    // or manual offset

  const now = getSingaporeNow()  // returns Date in Singapore TZ
  const dueDate = addDays(now, due_date_offset_days)
  const dueDateISO = toSingaporeISO(dueDate)  // e.g. "2026-04-15T09:00:00+08:00"
  ```
- Never use `new Date()` + raw UTC offset; always go through `lib/timezone.ts`.
- `created_at` on `templates` stored as `datetime('now')` (UTC in SQLite). Converted to Singapore ISO 8601 by API layer before returning to client.
- E2E tests that assert on calculated due dates must account for Singapore timezone: `TZ=Asia/Singapore` set in `playwright.config.ts` ensures `new Date()` in test helpers is Singapore-local.
- When `due_date_offset_days = 0`, the resulting todo's due date is today in Singapore time, not UTC midnight.
