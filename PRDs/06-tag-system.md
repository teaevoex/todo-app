# PRP-06: Tag System

**Depends on:** PRP-01 (Todo CRUD Operations)
**Feature:** Color-coded labels with many-to-many relationship
**Last updated:** 2026-04-08

---

## 1. Feature Overview

The Tag System lets users attach one or more color-coded labels to any todo, enabling them to categorise work across different dimensions (e.g., "work", "personal", "urgent"). Tags are user-scoped: each user creates and manages their own tag vocabulary independent of other users.

Tags and todos have a many-to-many relationship implemented via the `todo_tags` junction table. Each tag carries a `name` (unique per user) and a `color` (hex string). When a tag is deleted, the cascade rule removes all `todo_tags` rows referencing it, so todos lose that label automatically. Similarly, deleting a todo cascades to `todo_tags` (covered by PRP-01's CASCADE rule on `todos`).

Users can filter their todo list by selecting one or more tags. Clicking a tag badge on a todo card immediately applies that tag as a filter, enabling quick drill-down. Tag editing propagates to all todos in real time via TanStack Query cache invalidation.

---

## 2. User Stories

1. **As a user**, I want to create named, color-coded tags so that I can categorise my todos visually.
2. **As a user**, I want to attach multiple tags to a todo so that I can classify it from several angles.
3. **As a user**, I want to click a tag badge on any todo to instantly filter the list by that tag.
4. **As a user**, I want to rename or recolor an existing tag and see the change reflected across all todos immediately.
5. **As a user**, I want to delete a tag and have it removed from all todos automatically.
6. **As a user (edge case)**, when I try to create a tag with a name I already use, I receive a clear conflict error.
7. **As a user (edge case)**, I can assign a tag to the same todo only once (duplicate assignments are silently ignored).
8. **As a user (edge case)**, with no tags created yet, the tag selector shows an empty state with a prompt to create one.

---

## 3. Technical Requirements

### 3.1 Architecture Reference

| Layer | File | Responsibility |
|-------|------|---------------|
| DB module | `lib/db/tags.ts` | CRUD for `tags` + `todo_tags`; all synchronous |
| DB migration | `lib/db/connection.ts` | `CREATE TABLE IF NOT EXISTS tags …` and `todo_tags` |
| API routes | `app/api/tags/route.ts` | GET list, POST create |
| API routes | `app/api/tags/[id]/route.ts` | PUT update, DELETE delete |
| API routes | `app/api/todos/[id]/tags/route.ts` | POST assign, DELETE remove |
| API client | `lib/api/tags.ts` | `fetchTags`, `createTag`, `updateTag`, `deleteTag`, `assignTag`, `removeTag` |
| Types | `lib/types/tag.ts` | `Tag`, `CreateTagDto`, `UpdateTagDto` |
| Tokens | `lib/tokens/tags.ts` | Default palette of 10 colors |
| Hook | `lib/hooks/useTags.ts` | TanStack Query queries + mutations |
| Components | `components/tags/` | `TagManager`, `TagSelector`, `TagBadge`, `TagFilter` |

### 3.2 Database Schema

```sql
-- Add to lib/db/connection.ts schema initialisation block

CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  name       TEXT    NOT NULL,
  color      TEXT    NOT NULL DEFAULT '#3B82F6',   -- hex string e.g. '#10B981'
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (todo_id, tag_id),
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_todo_tags_todo_id ON todo_tags(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id  ON todo_tags(tag_id);
```

### 3.3 API Endpoints

#### GET `/api/tags`

Returns all tags owned by the authenticated user.

**Response `200`:**
```typescript
{
  success: true,
  data: Tag[]   // ordered by name ASC
}
```

---

#### POST `/api/tags`

Creates a new tag.

**Request body:**
```typescript
{ name: string; color?: string }  // name 1-50 chars; color must be valid hex (#RRGGBB)
```

**Response `201`:**
```typescript
{ success: true, data: Tag }
```

**Errors:**
- `400` – invalid name or color
- `409` – tag name already exists for this user `{ success: false, error: "Tag name already exists" }`
- `401` – unauthenticated

---

#### PUT `/api/tags/[id]`

Updates name and/or color of a tag.

**Request body (at least one required):**
```typescript
{ name?: string; color?: string }
```

**Response `200`:**
```typescript
{ success: true, data: Tag }
```

**Errors:**
- `400` – validation failure
- `404` – tag not found or not owned by user
- `409` – name conflicts with another tag owned by the user
- `401` – unauthenticated

---

#### DELETE `/api/tags/[id]`

Deletes a tag; CASCADE removes `todo_tags` rows.

**Response `200`:**
```typescript
{ success: true }
```

**Errors:**
- `404` – tag not found or unauthorised
- `401` – unauthenticated

---

#### POST `/api/todos/[id]/tags`

Assigns a tag to a todo.

**Request body:**
```typescript
{ tagId: number }
```

**Response `200`:**
```typescript
{ success: true }
```

**Errors:**
- `400` – missing tagId
- `404` – todo or tag not found / not owned by user
- `409` – tag already assigned (return `200` silently or `409` — prefer silent `200`)
- `401` – unauthenticated

---

#### DELETE `/api/todos/[id]/tags`

Removes a tag from a todo.

**Request body:**
```typescript
{ tagId: number }
```

**Response `200`:**
```typescript
{ success: true }
```

**Errors:**
- `404` – assignment does not exist
- `401` – unauthenticated

---

### 3.4 TypeScript Types

```typescript
// lib/types/tag.ts

export interface Tag {
  id:         number
  user_id:    number
  name:       string
  color:      string   // hex, e.g. '#3B82F6'
  created_at: string   // ISO 8601, Singapore TZ
}

export interface CreateTagDto {
  name:   string
  color?: string
}

export interface UpdateTagDto {
  name?:  string
  color?: string
}
```

```typescript
// lib/tokens/tags.ts — default palette
export const DEFAULT_TAG_COLORS: string[] = [
  '#3B82F6',  // blue
  '#10B981',  // green
  '#F59E0B',  // amber
  '#EF4444',  // red
  '#8B5CF6',  // violet
  '#EC4899',  // pink
  '#14B8A6',  // teal
  '#F97316',  // orange
  '#6366F1',  // indigo
  '#84CC16',  // lime
]
```

```typescript
// lib/types/todo.ts — extend existing Todo interface
tags?: Tag[]   // populated when todos are fetched
```

---

## 4. React Components

### 4.1 Component Tree (ASCII)

```
AppShell / Header
└── TagManager (modal, opened from header or "Manage Tags" button)
    ├── TagList
    │   └── TagEditRow[]  (inline edit: name, ColorPicker, delete)
    └── TagCreateForm     (name input + ColorPicker + submit)

TodoForm / TodoEditModal
└── TagSelector (multi-select checkboxes)
    └── TagBadge[]   (selected tags shown as pills)

TodoItem
└── TagBadge[]  (read-only display; click to filter)

FilterBar
└── TagFilter   (dropdown to filter by tag)
```

---

### 4.2 Component Specifications

#### `TagManager`

**File:** `components/tags/TagManager.tsx` (≤ 200 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | ✓ | Controls modal visibility |
| `onClose` | `() => void` | ✓ | Called when modal dismissed |

**State:**
- Reads from `useTags()` query
- Uses `useTags()` mutations for create/update/delete

**Implementation:** Uses shadcn `Dialog` from `@/components/ui/dialog`:
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

<Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
  <DialogContent className="max-w-[480px]">
    <DialogHeader>
      <DialogTitle>Manage Tags</DialogTitle>
    </DialogHeader>
    {/* tag list + create form */}
  </DialogContent>
</Dialog>
```

**Design tokens:** uses shadcn classes — `text-sm`, `font-medium`, `text-muted-foreground`

**Accessibility:**
- `aria-label="Manage Tags"` — set via `DialogTitle`
- Focus trapped inside modal (shadcn Dialog handles this via Radix UI)
- `data-testid="tag-manager-modal"` on `DialogContent`

---

#### `TagSelector`

**File:** `components/tags/TagSelector.tsx` (≤ 120 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `selectedTagIds` | `number[]` | ✓ | Currently selected tag ids |
| `onChange` | `(ids: number[]) => void` | ✓ | Called with updated ids |
| `disabled` | `boolean` | — | Defaults `false` |

**Internal state:**
- `isOpen: boolean` — dropdown open/closed

**Rendering:**
- Shows selected tags as `TagBadge` pills with `×` remove button
- Dropdown lists all user tags as checkboxes; checked = selected
- Empty state: "No tags yet. Create one in Tag Manager."

**Implementation:** Uses shadcn `Checkbox` from `@/components/ui/checkbox` for tag options in the dropdown.

**Design tokens:** uses shadcn classes — `bg-popover shadow-md` for dropdown, `gap-1` for pill gap

**Accessibility:**
- `aria-label="Select tags"` on trigger button
- Checkboxes: `aria-checked`, `data-testid="tag-option-{tagId}"`
- `data-testid="tag-selector"`

---

#### `TagBadge`

**File:** `components/tags/TagBadge.tsx` (≤ 60 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tag` | `Tag` | ✓ | Tag data (name + color) |
| `onClick` | `() => void` | — | If provided, badge is interactive (filter click) |
| `onRemove` | `() => void` | — | If provided, shows `×` remove button |

**Rendering logic:**
```typescript
// Background uses tag.color at 15% opacity; text uses tag.color at full opacity
// Ensures readable contrast on light + dark backgrounds
const badgeBg = `${tag.color}26`   // 26 = ~15% opacity in hex
const badgeText = tag.color
```

**Implementation:** Uses shadcn `Badge` from `@/components/ui/badge` as the base, with inline style for tag-specific color:
```tsx
import { Badge } from '@/components/ui/badge'

<Badge
  variant="outline"
  style={{ backgroundColor: badgeBg, color: badgeText, borderColor: `${tag.color}40` }}
  className="text-xs font-medium"
  data-testid={`tag-badge-${tag.id}`}
>
  {tag.name}
</Badge>
```

**Design tokens:** uses shadcn `Badge` defaults — `rounded-full`, `px-2 py-0.5`, `text-xs`

**Accessibility:**
- When `onClick` provided: `role="button"` `tabIndex={0}` `aria-label="Filter by tag: {name}"`
- `data-testid="tag-badge-{tagId}"`

---

#### `TagFilter`

**File:** `components/tags/TagFilter.tsx` (≤ 80 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `selectedTagId` | `number \| null` | ✓ | Currently active filter |
| `onChange` | `(tagId: number \| null) => void` | ✓ | Called when selection changes |

**Rendering:**
- `<Select>` dropdown listing all user tags + "All tags" (null) option
- Selected option shows tag name prefixed by a colored dot

**Implementation:** Uses shadcn `Select` from `@/components/ui/select`:
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
```

**Design tokens:** uses shadcn classes — `size-2 rounded-full` for color dot, shadcn Select variables for dropdown

**Accessibility:**
- `aria-label="Filter by tag"`
- `data-testid="tag-filter"`

---

#### `ColorPicker`

**File:** `components/common/ColorPicker.tsx` (≤ 80 lines) — custom component, not from shadcn

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | ✓ | Current hex color |
| `onChange` | `(hex: string) => void` | ✓ | Called when color changes |

**Rendering:**
- Displays a grid of swatches from `DEFAULT_TAG_COLORS`
- Includes a native `<input type="color">` for custom colors
- Selected swatch has a ring: `ring-2 ring-offset-2`

**Validation:** Accepts only `/^#[0-9A-Fa-f]{6}$/`; ignores invalid inputs

**Accessibility:**
- `aria-label="Choose tag color"`
- Each swatch: `aria-label="{hex}"` `data-testid="color-swatch-{hex}"`
- Native input: `data-testid="color-picker-custom"`

---

## 5. TanStack Query Hooks

### `useTags()`

**File:** `lib/hooks/useTags.ts`

```typescript
const tagKeys = {
  all: ['tags'] as const,
}

export function useTags() {
  const queryClient = useQueryClient()

  const tagsQuery = useQuery({
    queryKey: tagKeys.all,
    queryFn:  fetchTags,
    staleTime: 60_000,    // 1 minute
    gcTime:    300_000,   // 5 minutes
  })

  const createTag = useMutation({
    mutationFn: (dto: CreateTagDto) => apiCreateTag(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all })
    },
  })

  const updateTag = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateTagDto }) =>
      apiUpdateTag(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all })
      queryClient.invalidateQueries({ queryKey: ['todos'] })  // tags embedded in todos
    },
  })

  const deleteTag = useMutation({
    mutationFn: (id: number) => apiDeleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all })
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })

  const assignTag = useMutation({
    mutationFn: ({ todoId, tagId }: { todoId: number; tagId: number }) =>
      apiAssignTag(todoId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })

  const removeTag = useMutation({
    mutationFn: ({ todoId, tagId }: { todoId: number; tagId: number }) =>
      apiRemoveTag(todoId, tagId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })

  return { tagsQuery, createTag, updateTag, deleteTag, assignTag, removeTag }
}
```

**Stale/cache times:** Tags rarely change — 1 min stale / 5 min gc. Todos query refreshes when tag mutations settle.

**Optimistic updates:** Tag assignment/removal do NOT use optimistic updates to avoid stale tag color/name data. The short network roundtrip is acceptable.

**Invalidation targets:**
- `['tags']` — after create/update/delete tag
- `['todos']` — after update/delete tag (names/colors embedded) and after assign/remove

---

## 6. State Management

| Context | Read | Written |
|---------|------|---------|
| `QueryClient` | `useQueryClient()` | `invalidateQueries(['tags'])`, `invalidateQueries(['todos'])` |
| FilterContext (PRP-08) | `tagFilter: number \| null` | Set when user clicks a `TagBadge` or uses `TagFilter` |

**Local state:**
- `TagManager`: `editingTagId: number | null` — which tag row is in inline-edit mode
- `TagSelector`: `isOpen: boolean` — dropdown open state
- `ColorPicker`: internal — selected hex before confirmation

**URL state:** None (tag filter state is held in local/context state per PRP-08 design).

---

## 7. Test Specifications

### 7.1 E2E Tests (Playwright)

**File:** `tests/07-tag-system.spec.ts`

#### Test: "Create a tag and assign it to a todo"
```
1. Navigate to / (logged in)
2. Open tag manager: click [data-testid="manage-tags-button"]
3. Assert [data-testid="tag-manager-modal"] visible
4. Type "Work" into [data-testid="tag-name-input"]
5. Click [data-testid="color-swatch-#3B82F6"]
6. Click [data-testid="create-tag-submit"]
7. Assert [data-testid="tag-row-Work"] appears in modal
8. Close modal
9. Create todo "Write report"
10. In todo form, click [data-testid="tag-selector"]
11. Check [data-testid="tag-option-{tagId}"]
12. Submit todo form
13. Assert [data-testid="tag-badge-{tagId}"] visible on todo card with text "Work"
```

#### Test: "Filter todos by clicking a tag badge"
```
1. Setup: two todos "Task A" tagged "Work", "Task B" tagged "Personal"
2. Click [data-testid="tag-badge-{workTagId}"] on "Task A"
3. Assert "Task A" visible
4. Assert "Task B" not visible
5. Assert [data-testid="tag-filter"] shows "Work" selected
6. Click [data-testid="clear-tag-filter"] or select "All tags"
7. Assert both todos visible
```

#### Test: "Rename a tag propagates to all todos"
```
1. Setup: tag "Work" assigned to todos "Task A", "Task B"
2. Open tag manager
3. Click edit on "Work" row [data-testid="edit-tag-{tagId}"]
4. Change name to "Office" in [data-testid="tag-name-edit-{tagId}"]
5. Submit: [data-testid="save-tag-{tagId}"]
6. Assert both todo cards show "Office" not "Work"
```

#### Test: "Delete a tag removes it from all todos"
```
1. Setup: tag "Temp" on todo "Task X"
2. Open tag manager
3. Click [data-testid="delete-tag-{tagId}"]
4. Confirm deletion
5. Assert "Task X" card has no tag badge
6. Assert tag not listed in TagFilter dropdown
```

#### Test: "Duplicate tag name shows 409 conflict error"
```
1. Create tag "Work"
2. Attempt to create another tag named "Work"
3. Assert error message "Tag name already exists" visible in form
```

---

### 7.2 Unit Tests

**File:** `lib/db/tags.test.ts`

| Function | Input | Expected Output |
|----------|-------|----------------|
| `tagDB.create(userId, {name:'A', color:'#3B82F6'})` | valid | Returns `Tag` with correct fields |
| `tagDB.create(userId, {name:'A'})` (duplicate) | same user + name | Throws SQLite UNIQUE constraint error |
| `tagDB.create(userId2, {name:'A'})` | different user, same name | Succeeds (different user scope) |
| `tagDB.update(id, {name:'B'})` | existing id | Returns updated tag |
| `tagDB.delete(id)` | existing id | Row removed; associated `todo_tags` rows removed (CASCADE) |
| `tagDB.findByUserId(userId)` | valid userId | Returns array ordered by `name ASC` |
| `tagDB.assignToTodo(todoId, tagId)` | valid | Inserts `todo_tags` row |
| `tagDB.assignToTodo(todoId, tagId)` (duplicate) | same pair | No-op / returns without error (INSERT OR IGNORE) |
| `tagDB.removeFromTodo(todoId, tagId)` | existing | Deletes `todo_tags` row |

**File:** `components/tags/TagBadge.test.tsx`

| Scenario | Props | Expected |
|----------|-------|----------|
| Display only | `tag, onClick=undefined` | No `role="button"`, no remove button |
| Interactive | `tag, onClick=fn` | `role="button"`, click fires handler |
| With remove | `tag, onRemove=fn` | `×` button visible; click fires `onRemove` |
| Color style | `tag.color='#EF4444'` | bg style contains `#EF444426` |

---

### 7.3 Integration Tests

**File:** `tests/contracts/todo-tags.contract.test.ts`

```
1. POST /api/tags {name:"Work", color:"#3B82F6"} → assert 201, tagId saved
2. POST /api/tags {name:"Work"} (same user) → assert 409
3. POST /api/todos {title:"Task"} → todoId saved
4. POST /api/todos/{todoId}/tags {tagId} → assert 200
5. GET /api/todos → todo.tags includes {id:tagId, name:"Work", color:"#3B82F6"}
6. POST /api/todos/{todoId}/tags {tagId} (duplicate) → assert 200 (idempotent)
7. PUT /api/tags/{tagId} {name:"Office"} → assert 200
8. GET /api/todos → todo.tags includes {name:"Office"}
9. DELETE /api/todos/{todoId}/tags {tagId} → assert 200
10. GET /api/todos → todo.tags is empty array
11. POST /api/todos/{todoId}/tags {tagId} → re-assign
12. DELETE /api/tags/{tagId} → assert 200
13. GET /api/todos → todo.tags is empty (CASCADE removed assignment)
```

---

## 8. Acceptance Criteria

1. A user can create a tag with a name (1–50 characters) and a hex color.
2. Tag names are unique per user; creating a duplicate returns HTTP 409 with message "Tag name already exists".
3. A user can assign zero or more tags to any todo.
4. Assigning the same tag to the same todo twice is idempotent (no error, no duplicate row).
5. A user can remove a tag from a todo.
6. A user can rename a tag; all todo cards immediately reflect the new name (via query invalidation).
7. A user can recolor a tag; all tag badges immediately reflect the new color.
8. Deleting a tag removes it from all todos (CASCADE; verified on next todos fetch).
9. Deleting a todo removes all its tag assignments (CASCADE from PRP-01).
10. Clicking a tag badge on a todo card applies that tag as the active filter.
11. The `TagFilter` dropdown lists all user tags plus "All tags"; selecting one filters the todo list.
12. A user can open `TagManager`, create, edit, and delete tags without navigating away.
13. The `ColorPicker` accepts the 10 default palette colors and any valid 6-digit hex input.
14. Invalid hex color input is rejected with a `400` error from the API.
15. Tag badges display background at ~15% opacity of tag color with full-opacity text in the same color.

---

## 9. Integration Points

### 9.1 What This Feature Consumes

| Feature | Usage |
|---------|-------|
| PRP-01 Todo CRUD | `todos` table (FK in `todo_tags`), `useTodos` (tags embedded in response), authenticated session |
| `lib/db/connection.ts` | Schema init must include `tags` and `todo_tags` tables |
| `lib/types/todo.ts` | `Todo.tags?: Tag[]` field added |
| `components/ui/dialog` | `TagManager` uses shadcn Dialog |
| `components/ui/select` | `TagFilter` uses shadcn Select |
| `components/ui/badge` | `TagBadge` uses shadcn Badge with inline color style |
| `components/ui/input` | Tag name input in create/edit form |
| `components/ui/button` | Action buttons in TagManager |
| `components/ui/label` | Form labels in TagManager |
| `components/ui/checkbox` | Tag option checkboxes in TagSelector |
| `common/ColorPicker.tsx` | Color selection inside `TagManager` and `TagSelector` (custom component) |
| `lib/timezone.ts` | `created_at` formatting |

### 9.2 What This Feature Exposes

| Artifact | Consumed by |
|----------|-------------|
| `lib/types/tag.ts` (`Tag`, `CreateTagDto`, `UpdateTagDto`) | PRP-07 Template System (tag associations on template use), PRP-08 Search & Filtering |
| `lib/db/tags.ts` | PRP-07 (assign tags when using a template) |
| `lib/hooks/useTags.ts` | `TodoForm`, `TagSelector`, `TagFilter`, `TagManager`, PRP-08 |
| `TagBadge` component | `TodoItem`, `TodoEditModal`, `TagSelector`, PRP-08 filter summary |
| `TagFilter` component | `FilterBar` (PRP-08) |
| `lib/tokens/tags.ts` (`DEFAULT_TAG_COLORS`) | `ColorPicker`, `TagManager` |

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Empty tag name | `400` – "Name is required" |
| Tag name > 50 characters | `400` – "Name must be ≤ 50 characters" |
| Invalid hex color (e.g. `#GGG`) | `400` – "Color must be a valid hex color (#RRGGBB)" |
| Assigning tag from another user to todo | `404` – tag not found for this user |
| Assigning tag to another user's todo | `404` – todo not found |
| Renaming to an existing tag name | `409` – "Tag name already exists" |
| Deleting a tag with many assignments | CASCADE handles cleanup; no N+1 queries |
| Todo list with many tags per todo | Truncate badge list at 5; show "+N more" chip |
| Tag name with special characters (emojis, unicode) | Allowed; stored as UTF-8 TEXT in SQLite |
| Dark mode contrast for light tag colors | Badge uses color at 15% opacity bg — works across modes |
| Network error on tag assignment | TanStack Query shows error toast; no optimistic rollback needed |
| User has 0 tags | `TagSelector` shows "No tags yet" empty state |
| Rapid create/delete of tags | Each mutation invalidates query; last settled state wins |
| Color picker custom input debouncing | Validate on blur, not on every keystroke |

---

## 11. Out of Scope

- Shared tags across multiple users
- Tag hierarchies / nested tags
- Tag usage analytics (most used, etc.)
- Tag ordering / custom sort
- Bulk tag assignment (assign one tag to many todos at once)
- Tag icons or emoji identifiers
- Filtering by multiple tags simultaneously (single tag filter only in this PRP; AND multi-tag filtering belongs to PRP-08)
- Tag import/export (covered by PRP-09)

---

## 12. Singapore Timezone Considerations

- `created_at` on `tags` table stored as `datetime('now')` (UTC). Exposed via API as Singapore ISO 8601 using `toSingaporeISO()` from `lib/timezone.ts`.
- Tags themselves have no time-dependent display logic beyond `created_at`.
- When sorting tags by `created_at` in the UI, compare the raw ISO strings (lexicographic sort is valid for ISO 8601).
- E2E tests inherit `TZ=Asia/Singapore` from `playwright.config.ts` — ensure any date assertions within tag creation flows use Singapore-local expectations.
- Do **not** call `new Date()` directly anywhere in the tag implementation; use `getSingaporeNow()` from `lib/timezone.ts` if a current timestamp is needed in application code.
