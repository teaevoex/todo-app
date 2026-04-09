# PRP-09: Export & Import

**Depends on:** PRP-01 (Todo CRUD), PRP-05 (Subtasks), PRP-06 (Tag System)
**Feature:** JSON backup and restore of all user data with relationship preservation
**Last updated:** 2026-04-08

---

## 1. Feature Overview

The Export & Import feature allows users to create a complete JSON snapshot of their todo data — including todos, subtasks, tags, and tag assignments — and restore it on the same or a different account. The export downloads a structured JSON file directly in the browser. The import reads a JSON file, validates its structure, and writes all records to the database using a remapping strategy that preserves relationships while assigning fresh IDs.

No new database tables are introduced. The feature reads from and writes to the existing `todos`, `subtasks`, `tags`, and `todo_tags` tables. The export captures all data owned by the authenticated user at the moment of the request. The import is additive: it creates new records rather than overwriting existing ones. Existing todos and tags are left untouched; existing tags matched by name are reused rather than duplicated.

Errors during import are reported to the user with specific messages ("Invalid JSON structure", "Missing required field: todos", "Import failed at subtask step"). A success notification reads "Imported X todos, Y subtasks, Z tags" where each number reflects the count of newly created records. The import UI shows a simple progress indicator while the server is processing.

---

## 2. User Stories

**US-01 — Export all data**
As a user, I want to click an Export button and immediately download a JSON file containing all my todos, subtasks, tags, and tag assignments so that I have a portable backup.

**US-02 — Import a backup**
As a user, I want to click an Import button, select a previously exported JSON file, and have all my todos, subtasks, and tags restored so that I can migrate data between accounts or environments.

**US-03 — Duplicate tag handling**
As a user importing a backup, if a tag with the same name already exists in my account, I want the import to reuse that existing tag rather than creating a duplicate.

**US-04 — Invalid file feedback**
As a user who selects a non-JSON file or a JSON file with an unexpected structure, I want to see a clear error message explaining what is wrong so that I can take corrective action.

**US-05 — Large dataset import**
As a user with hundreds of todos, I want to see a loading indicator during import so that I know the operation is in progress and have not accidentally closed the browser.

**US-06 — Edge: empty export**
As a user with no todos, I want to be able to export an empty dataset (valid JSON with empty arrays) without errors.

**US-07 — Edge: missing optional fields**
As a user importing a file that omits the `subtasks` or `todoTags` arrays (e.g., an older export format), the import should handle the omission gracefully (treat as empty arrays).

**US-08 — Edge: import version mismatch**
As a user who tries to import a file with `version` > 1, the import should reject it with "Unsupported export version" rather than silently corrupting data.

---

## 3. Technical Requirements

### 3.1 Architecture Reference

| Concern | Location |
|---------|----------|
| DB operations | `lib/db/todos.ts`, `lib/db/subtasks.ts`, `lib/db/tags.ts` — synchronous (better-sqlite3) |
| Export DB helper | `lib/db/todos.ts#exportUserData(userId)` — reads all four tables |
| Import DB helper | `lib/db/todos.ts#importUserData(userId, payload)` — writes to all four tables in a transaction |
| API routes | `app/api/todos/export/route.ts`, `app/api/todos/import/route.ts` |
| API client | `lib/api/export-import.ts` — `exportTodos()`, `importTodos(file)` |
| Shared types | `lib/types/export.ts` |
| TanStack hooks | `lib/hooks/useExportImport.ts` |
| Components | `components/export-import/ExportButton.tsx`, `components/export-import/ImportButton.tsx` |
| Session auth | `lib/auth.ts#getSession()` — every API route verifies the session |

> **Next.js 16 rule:** Route params are async. Always `const { id } = await params` inside route handlers.
> **better-sqlite3 rule:** All DB calls are synchronous — do NOT `await` them.
> **Import is wrapped in a single SQLite transaction** so that a failure at any step rolls back the entire import.

### 3.2 Database Schema

No new tables. The feature reads from and writes to the following existing tables:

```sql
-- Read for export, write for import:
todos       (id, user_id, title, completed, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes, created_at, updated_at)
subtasks    (id, todo_id, title, completed, position, created_at)
tags        (id, user_id, name, color, created_at)
todo_tags   (todo_id, tag_id)
```

**Import transaction (pseudo-SQL order):**
```sql
-- Step 1: Upsert tags (match by name, insert if new)
INSERT OR IGNORE INTO tags (user_id, name, color) VALUES (?, ?, ?);
SELECT id FROM tags WHERE user_id = ? AND name = ?;

-- Step 2: Insert todos (capture new IDs)
INSERT INTO todos (user_id, title, completed, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- Step 3: Insert subtasks (remap todo_id)
INSERT INTO subtasks (todo_id, title, completed, position, created_at)
VALUES (?, ?, ?, ?, ?);

-- Step 4: Insert todo_tags (remap both todo_id and tag_id)
INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?);
```

### 3.3 API Endpoints

#### `GET /api/todos/export`

Exports all data for the authenticated user as a downloadable JSON file.

**Request headers:** `Cookie: session=<token>`

**Response `200 OK`:**
```
Content-Type: application/json
Content-Disposition: attachment; filename="todos-export-2026-04-08.json"
```

**Response body (JSON):**
```json
{
  "version": 1,
  "exportedAt": "2026-04-08T10:30:00.000Z",
  "todos": [...ExportTodo[]],
  "subtasks": [...ExportSubtask[]],
  "tags": [...ExportTag[]],
  "todoTags": [...ExportTodoTag[]]
}
```

**Error `401 Unauthorized`:**
```json
{ "success": false, "error": "Unauthorized" }
```

---

#### `POST /api/todos/import`

Imports data from a validated JSON payload.

**Request body (JSON):**
```json
{
  "version": 1,
  "exportedAt": "2026-04-08T10:30:00.000Z",
  "todos": [...ExportTodo[]],
  "subtasks": [...ExportSubtask[]],
  "tags": [...ExportTag[]],
  "todoTags": [...ExportTodoTag[]]
}
```

**Validation rules (server-side):**
- Body must be valid JSON (400 if parsing fails)
- `version` must be present and equal to `1`
- `todos` must be a present array (may be empty)
- `subtasks`, `tags`, `todoTags` are optional; default to `[]` if absent
- Each todo must have `title` (non-empty string) and `id` (number used for remapping only)
- Each subtask must have `todo_id` (old ID), `title`, `completed`, `position`
- Each tag must have `id` (old ID for remapping), `name` (non-empty string), `color` (valid hex)
- Each todoTag must have `todo_id` (old ID) and `tag_id` (old ID)

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "todosImported": 12,
    "subtasksImported": 7,
    "tagsImported": 3
  }
}
```

**Error `400 Bad Request`:**
```json
{
  "success": false,
  "error": "Invalid JSON structure: missing required field 'todos'"
}
```

**Error `400 — version mismatch`:**
```json
{
  "success": false,
  "error": "Unsupported export version: 2. Expected version 1."
}
```

**Error `401 Unauthorized`:**
```json
{ "success": false, "error": "Unauthorized" }
```

**Error `500 — transaction failure`:**
```json
{
  "success": false,
  "error": "Import failed: database transaction rolled back"
}
```

### 3.4 TypeScript Types

```typescript
// lib/types/export.ts

export interface ExportTodo {
  id: number               // original ID — used only for relationship remapping
  title: string
  completed: boolean
  due_date: string | null  // ISO-8601 UTC
  priority: 'high' | 'medium' | 'low'
  is_recurring: boolean
  recurrence_pattern: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  reminder_minutes: number | null
  created_at: string       // ISO-8601 UTC
  updated_at: string       // ISO-8601 UTC
}

export interface ExportSubtask {
  id: number               // original ID — not remapped, only carried for completeness
  todo_id: number          // original todo ID — remapped during import
  title: string
  completed: boolean
  position: number
  created_at: string       // ISO-8601 UTC
}

export interface ExportTag {
  id: number               // original ID — used for todo_tags remapping
  name: string
  color: string            // hex e.g. '#3B82F6'
  created_at: string       // ISO-8601 UTC
}

export interface ExportTodoTag {
  todo_id: number          // original todo ID — remapped during import
  tag_id: number           // original tag ID — remapped during import
}

export interface ExportPayload {
  version: 1
  exportedAt: string       // ISO-8601 UTC
  todos: ExportTodo[]
  subtasks: ExportSubtask[]
  tags: ExportTag[]
  todoTags: ExportTodoTag[]
}

export interface ImportResult {
  todosImported: number
  subtasksImported: number
  tagsImported: number
}

export interface ImportResponse {
  success: true
  data: ImportResult
}
```

---

## 4. React Components

### 4.1 Component Tree ASCII

```
components/export-import/
├── ExportButton.tsx       (triggers GET /api/todos/export → file download)
└── ImportButton.tsx       (file picker → POST /api/todos/import → success/error feedback)
```

These components are rendered in the `Header` or a toolbar area of `AppShell`. They are standalone and do not wrap each other.

### 4.2 Component Specs

#### `ExportButton`

**File:** `components/export-import/ExportButton.tsx`
**Purpose:** Trigger a JSON download by calling the export API and programmatically creating a download link.

**Props:**
```typescript
interface ExportButtonProps {
  className?: string
}
```

**Local state:**
```typescript
const [isExporting, setIsExporting] = useState(false)
```

**Behaviour:**
1. On click: set `isExporting = true`, call `exportTodos()` from `lib/api/export-import.ts`
2. `exportTodos()` fetches `GET /api/todos/export` and returns a `Blob`
3. Create an object URL: `URL.createObjectURL(blob)`
4. Create a hidden `<a>` element, set `href` and `download="todos-export-{YYYY-MM-DD}.json"`, click it, revoke URL
5. On success or error: set `isExporting = false`
6. On error: show toast "Export failed. Please try again."

**Implementation:** Uses shadcn `Button` from `@/components/ui/button`:
```tsx
import { Button } from '@/components/ui/button'

<Button
  onClick={handleExport}
  disabled={isExporting}
  aria-busy={isExporting}
  data-testid="export-button"
>
  {isExporting ? 'Exporting…' : 'Export'}
</Button>
```

**Design tokens:** uses shadcn `Button` default variant — `bg-primary text-primary-foreground hover:bg-primary/90`, `rounded-md`, `px-4 py-2`

**Accessibility:**
- Button has `aria-busy={isExporting}`
- Button text changes to "Exporting…" when `isExporting` is true
- `data-testid="export-button"`

---

#### `ImportButton`

**File:** `components/export-import/ImportButton.tsx`
**Purpose:** File picker with validation feedback and progress state for importing a JSON backup.

**Props:**
```typescript
interface ImportButtonProps {
  onSuccess?: (result: ImportResult) => void
  className?: string
}
```

**Local state:**
```typescript
const [isImporting, setIsImporting] = useState(false)
const [error, setError] = useState<string | null>(null)
```

**Behaviour:**
1. Render a visually styled button that triggers a hidden `<input type="file" accept=".json">` click
2. On file selected:
   a. Read file with `FileReader.readAsText()`
   b. Parse JSON — catch `SyntaxError` → set `error = "Invalid JSON file"`
   c. Call `useImport` mutation with parsed payload
3. While mutation is pending: show spinner, disable button, show "Importing…" text
4. On success: clear `error`, call `onSuccess(result)`, show toast "Imported X todos, Y subtasks, Z tags"
5. On error: set `error` to server error message, display `role="alert"` below button

**Implementation:** Uses shadcn `Button` from `@/components/ui/button` with `variant="outline"` plus a hidden native file input:
```tsx
import { Button } from '@/components/ui/button'

<Button
  variant="outline"
  onClick={() => fileInputRef.current?.click()}
  disabled={isImporting}
  aria-busy={isImporting}
  data-testid="import-button"
>
  {isImporting ? 'Importing…' : 'Import'}
</Button>
<input type="file" accept=".json" ref={fileInputRef} aria-hidden="true" data-testid="import-file-input" className="hidden" />
{error && <p role="alert" aria-live="assertive" className="text-destructive text-sm mt-1" data-testid="import-error">{error}</p>}
```

**Design tokens:** uses shadcn classes — `Button` outline variant for secondary style, `text-destructive` for error text, `rounded-md`, `px-4 py-2`

**Accessibility:**
- Hidden file input has `aria-hidden="true"`
- Visible button has `aria-busy={isImporting}`
- Error message uses `role="alert"` and `aria-live="assertive"`
- `data-testid="import-button"`, `data-testid="import-file-input"`, `data-testid="import-error"`

---

## 5. TanStack Query Hooks

**File:** `lib/hooks/useExportImport.ts`

```typescript
import { useMutation } from '@tanstack/react-query'
import { exportTodos, importTodos } from '@/lib/api/export-import'
import type { ExportPayload, ImportResult } from '@/lib/types/export'

// No query key needed for export — it is a one-shot download side effect.
export function useExport() {
  return useMutation<Blob, Error, void>({
    mutationFn: exportTodos,
    // No invalidation needed — export is read-only.
  })
}

export function useImport() {
  return useMutation<ImportResult, Error, ExportPayload>({
    mutationFn: importTodos,
    // After a successful import, invalidate all todo-related queries
    // so the UI reflects the newly imported data.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })
}
```

**Hook configuration:**
| Hook | Type | Stale Time | Cache Time | Optimistic | Invalidates |
|------|------|-----------|-----------|-----------|-------------|
| `useExport` | mutation | N/A | N/A | No | None |
| `useImport` | mutation | N/A | N/A | No | `['todos']`, `['tags']` |

**Note:** `useImport` does NOT use optimistic updates because the server assigns new IDs that the client cannot predict. The full invalidation after success ensures the UI fetches fresh data with the correct IDs.

---

## 6. State Management

| State | Type | Location | Notes |
|-------|------|----------|-------|
| Export in-flight | Local UI | `ExportButton` | `useState<boolean>` |
| Import in-flight | TanStack Mutation | `useImport` | `mutation.isPending` |
| Import error | Local UI | `ImportButton` | `useState<string | null>` derived from mutation error |
| Auth user | Context | `AuthContext` | Read to gate the export/import buttons (must be logged in) |

**URL state:** None. Export and import are transient operations with no URL representation.

**Contexts read:**
- `AuthContext` — verify user is logged in before rendering export/import controls

**Contexts written:** None.

---

## 7. Test Specifications

### 7.1 E2E Tests (Playwright)

**File:** `tests/10-export-import.spec.ts`

#### Test: Export downloads a JSON file

```
Setup:
- Log in with a test user (storageState fixture)
- Create 2 todos via API helper
- Create 1 tag via API helper, assign to todo #1

Steps:
1. Navigate to /
2. Set up download listener: const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="export-button"]')])
3. Read downloaded content: const content = await download.path() → fs.readFileSync → JSON.parse

Assertions:
- download.suggestedFilename() matches /^todos-export-\d{4}-\d{2}-\d{2}\.json$/
- parsed.version === 1
- parsed.exportedAt is a valid ISO-8601 string
- parsed.todos.length === 2
- parsed.tags.length === 1
- parsed.todoTags.length === 1
```

#### Test: Import restores todos

```
Setup:
- Log in with a fresh test user (no existing todos)
- Prepare a valid export JSON fixture file with 3 todos, 1 subtask, 2 tags

Steps:
1. Navigate to /
2. Set file input value: await page.setInputFiles('[data-testid="import-file-input"]', fixturePath)
3. Wait for toast notification

Assertions:
- Toast text matches "Imported 3 todos, 1 subtasks, 2 tags"
- [data-testid="section-pending"] is visible
- 3 todo titles from the fixture file are visible on the page
```

#### Test: Import with duplicate tag reuses existing tag

```
Setup:
- Log in with a test user that already has a tag named "work" (color #3B82F6)
- Prepare fixture JSON with a tag named "work" (color #FF0000) and 1 todo assigned to it

Steps:
1. Navigate to /
2. Import the fixture file

Assertions:
- Toast text matches "Imported 1 todos, 0 subtasks, 0 tags" (0 tags created, existing reused)
- The imported todo has the "work" badge with original color #3B82F6, not #FF0000
```

#### Test: Import invalid JSON shows error

```
Steps:
1. Navigate to /
2. Create a temp file with content "not valid json"
3. Set input files to that temp file

Assertions:
- [data-testid="import-error"] is visible
- [data-testid="import-error"] contains "Invalid JSON file"
- No new todos appear
```

#### Test: Import unsupported version shows error

```
Steps:
1. Navigate to /
2. Set input files to a fixture JSON with version: 99

Assertions:
- [data-testid="import-error"] contains "Unsupported export version"
```

### 7.2 Unit Tests

**File:** `lib/db/todos.test.ts` (extend existing file)

| Function | Input | Expected Output |
|----------|-------|-----------------|
| `exportUserData` | `userId=1` with 2 todos, 1 tag, 1 todo_tag | `{ todos: [2 items], subtasks: [], tags: [1 item], todoTags: [1 item] }` |
| `exportUserData` | `userId=99` (no data) | `{ todos: [], subtasks: [], tags: [], todoTags: [] }` |
| `importUserData` | valid payload, 2 todos | Returns `{ todosImported: 2, subtasksImported: 0, tagsImported: 0 }` |
| `importUserData` | payload with duplicate tag name | Returns `{ tagsImported: 0 }` (existing tag reused) |
| `importUserData` | transaction failure (invalid FK) | Throws, database unchanged (rollback verified) |

**File:** `lib/api/export-import.test.ts`

| Function | Input | Expected |
|----------|-------|----------|
| `exportTodos` | mocked fetch returns `{ ok: true, blob }` | Returns `Blob` instance |
| `exportTodos` | mocked fetch returns `{ ok: false, status: 401 }` | Throws `Error('Unauthorized')` |
| `importTodos` | valid `ExportPayload` | Calls `POST /api/todos/import` with correct body |
| `importTodos` | server returns 400 | Throws `Error('Invalid JSON structure: ...')` |

### 7.3 Integration Tests

**File:** `app/api/todos/export/route.test.ts`

```
GET /api/todos/export
- authenticated, has data → 200, Content-Disposition header, valid ExportPayload JSON
- authenticated, empty account → 200, ExportPayload with all empty arrays
- unauthenticated → 401
```

**File:** `app/api/todos/import/route.test.ts`

```
POST /api/todos/import
- valid payload with todos + subtasks + tags → 200 + ImportResult counts
- valid payload, duplicate tag name → 200, tagsImported = 0
- missing 'todos' field → 400, error message mentions 'todos'
- version = 2 → 400, error mentions 'Unsupported export version'
- invalid JSON body → 400
- unauthenticated → 401
- DB error → 500, rolled-back state verified
```

---

## 8. Acceptance Criteria

1. Clicking the Export button downloads a file named `todos-export-YYYY-MM-DD.json` where the date is in Singapore timezone.
2. The exported JSON contains `version: 1`, `exportedAt` (ISO-8601 UTC), and arrays `todos`, `subtasks`, `tags`, `todoTags`.
3. All exported todos belong to the authenticated user only — no cross-user data leakage.
4. Importing a valid export file creates new todos, subtasks, and tags with fresh database IDs.
5. Importing preserves relationships: subtasks are linked to their correct parent todos; tag assignments are preserved.
6. If an imported tag's name already exists for the user, the existing tag is reused; no duplicate is created.
7. A successful import displays a toast: "Imported X todos, Y subtasks, Z tags" with correct counts.
8. After import, the todo list refreshes to display the newly imported todos without a manual page reload.
9. Selecting a non-JSON file shows `[data-testid="import-error"]` with "Invalid JSON file".
10. Selecting a JSON file with `version` ≠ 1 shows an error containing "Unsupported export version".
11. Selecting a JSON file missing the `todos` array shows an error containing the missing field name.
12. If the import transaction fails mid-way, no partial data is committed (full rollback).
13. The Export button shows `aria-busy="true"` and "Exporting…" text while the download is in flight.
14. The Import button shows `aria-busy="true"` and "Importing…" text while the server is processing.
15. Both endpoints return `401` for unauthenticated requests.
16. Exporting an account with zero todos produces a valid JSON with all empty arrays (not an error).

---

## 9. Integration Points

### 9.1 What This Feature Consumes

| Dependency | Location | Usage |
|------------|----------|-------|
| `todos` table | `lib/db/todos.ts` | Read all user todos for export; insert todos during import |
| `subtasks` table | `lib/db/subtasks.ts` | Read all subtasks for export; insert during import |
| `tags` table | `lib/db/tags.ts` | Read all user tags for export; upsert during import |
| `todo_tags` table | `lib/db/tags.ts` | Read assignments for export; insert during import |
| `getSession()` | `lib/auth.ts` | Every API route verifies authentication |
| `todoKeys` | `lib/hooks/useTodos.ts` | `useImport` invalidates `['todos']` after success |
| `tagKeys` | `lib/hooks/useTags.ts` | `useImport` invalidates `['tags']` after success |

### 9.2 What This Feature Exposes

This is a self-contained feature. No downstream consumers.

| Export | Downstream Consumers |
|--------|---------------------|
| `ExportPayload` type | None |
| `ImportResult` type | None |
| `GET /api/todos/export` | None |
| `POST /api/todos/import` | None |

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Export with 0 todos | Returns valid JSON with all empty arrays — no error |
| File is not JSON | `JSON.parse` throws `SyntaxError` → client catches, sets `error = "Invalid JSON file"` |
| File is JSON but wrong shape | Server validation returns 400 with specific missing field name |
| `version` field missing | Server returns 400: "Missing required field: version" |
| `version` > 1 | Server returns 400: "Unsupported export version: {n}. Expected version 1." |
| `todos` is not an array | Server returns 400: "Field 'todos' must be an array" |
| Todo `title` is empty string | Server returns 400: "Todo at index {i}: title must be non-empty" |
| Tag `color` is invalid hex | Server normalises to default `#3B82F6` with a warning in response (non-breaking) |
| Duplicate tag name on import | `INSERT OR IGNORE` + SELECT by name — reuses existing tag, does not fail |
| Subtask `todo_id` has no matching imported todo | Server returns 400: "Subtask references unknown todo_id {id}" |
| `todoTags` references unknown old tag_id | Server returns 400: "TodoTag references unknown tag_id {id}" |
| DB transaction fails mid-import | SQLite ROLLBACK — all or nothing; client receives 500 + "Import failed: database transaction rolled back" |
| File too large (> 10 MB) | Server returns 413 (Next.js body size limit) — client should warn before upload if `file.size > 10_000_000` |
| Concurrent imports from same user | SQLite serialises writes; last import completes fully; no corruption |
| Session expires mid-import | Server returns 401; client redirects to `/login` after showing toast "Session expired" |
| Export download cancelled by user | No server side effect; file handle cleaned up by browser |

---

## 11. Out of Scope

- CSV export format (JSON only)
- Selective export (e.g., export only one tag's todos)
- Import merge strategies (conflict resolution beyond "match by tag name")
- Export of templates (PRP-07 data)
- Scheduled/automated exports
- Import progress percentage (only binary in-flight state shown)
- Undo/rollback of a completed import
- Exporting to cloud storage (Google Drive, Dropbox)
- Streaming large exports (all data fits in memory for typical personal use)

---

## 12. Singapore Timezone Considerations

- `exportedAt` in the JSON payload is stored as **UTC ISO-8601** (e.g., `2026-04-08T02:30:00.000Z`).
- The downloaded filename uses the **Singapore date** (`YYYY-MM-DD` in `Asia/Singapore`). Compute via `lib/timezone.ts#toSGDisplay()` or format with `Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore' })`.
- All `due_date`, `created_at`, `updated_at` fields inside the export are stored as **UTC ISO-8601** — no conversion needed on export or import.
- Do not use `new Date()` for generating the filename date; always go through `lib/timezone.ts#nowSG()`.

```typescript
// Example: generate SG-date filename in export route handler
import { nowSG } from '@/lib/timezone'

const sgDate = nowSG().toISOString().slice(0, 10)  // 'YYYY-MM-DD'
const filename = `todos-export-${sgDate}.json`
headers.set('Content-Disposition', `attachment; filename="${filename}"`)
```
