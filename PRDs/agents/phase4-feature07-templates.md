# Agent Memory: Phase 4 — Feature 07 — Template System

**Implemented by:** Feature 07 agent (claude-sonnet-4-6)
**Date:** 2026-04-08
**Status:** Complete — TypeScript check passes with zero errors

---

## What Was Built

### 1. Database Module (`lib/db/templates.ts`)
Full implementation of `TemplateDBContract`:
- `create`: INSERT with subtasks serialized to `subtasks_json` JSON string, tag_ids to `tag_ids_json`
- `findAll`: SELECT ORDER BY created_at DESC
- `findById`: SELECT with user_id guard
- `update`: UPDATE with partial fields; serializes subtasks/tag_ids if provided
- `delete`: DELETE with existence check
- Helper methods: `parseSubtasks()` and `parseTagIds()` for safely deserializing JSON fields

Idempotent migration at module load time adds `tag_ids_json` column to `templates` table if it doesn't exist (the table schema in `connection.ts` didn't include it initially).

### 2. Type Update (`lib/types/template.ts`)
Added `tag_ids_json: string | null` field to `Template` interface.
Added `tag_ids?: number[]` field to `CreateTemplateDto` interface.
These additions are backward-compatible (no existing consumers break).

### 3. API Routes
- `app/api/templates/route.ts` — GET (list all templates for user), POST (create with validation)
- `app/api/templates/[id]/route.ts` — PUT (update), DELETE
- `app/api/templates/[id]/use/route.ts` — POST: creates todo + subtasks + tag assignments from template

The `use` endpoint logic:
1. Loads template (verifies ownership)
2. Calculates `due_date` from `due_date_offset_days` using `getSingaporeNow()` + `toSingaporeISO()` or uses `due_date_override`
3. Creates todo via `todoDB.create()`
4. Creates each subtask via `subtaskDB.create()`
5. Assigns tags via `tagDB.assignTag()` (silently skips stale IDs)
6. Returns created `Todo`

### 4. API Client (`lib/api/templates.ts`)
Was already correctly stubbed — no changes needed.

### 5. TanStack Query Hook (`lib/hooks/useTemplates.ts`)
Full implementation replacing the stub:
- `templatesQuery` (staleTime: 60s, gcTime: 300s)
- `createTemplate`, `updateTemplate`, `deleteTemplate` mutations → invalidate `['templates']`
- `useTemplateMutation` → invalidates `['todos']` on success
- Returns: `{ templates, isLoading, error, createTemplate, updateTemplate, deleteTemplate, useTemplateMutation }`

### 6. Token Constants (`lib/tokens/templates.ts`)
`TEMPLATE_CATEGORIES` array: `['Work', 'Personal', 'Project', 'Health', 'Finance', 'Learning', 'Other']`

### 7. Components (all in `components/templates/`)
- **TemplateCard.tsx**: shadcn Card showing template preview with name, description, priority badge, category badge, recurrence/reminder/subtask count/due offset badges, tag pills. Use + Delete action buttons.
- **SaveTemplateModal.tsx**: shadcn Dialog for saving current todo as template. Pre-fills name from todo title. Fields: name, description, category (with datalist suggestions), due offset. Shows preview of settings being saved. Calls `createTemplate.mutateAsync()`.
- **TemplateManager.tsx**: shadcn Dialog showing all templates. Category filter via shadcn Tabs. Grid of TemplateCards. "Use" triggers `useTemplateMutation`. "Delete" shows ConfirmDialog. Closes after successful "Use".

### 8. Page Integration (`app/page.tsx`)
Feature 08 (Search & Filtering) was already integrated when this feature was implemented. Added:
- "Templates" button in header (data-testid="manage-templates-button")
- `TemplateManager` modal with state
- `SaveTemplateModal` rendered conditionally when `savingAsTodoTemplate !== null`
- `onSaveAsTemplate` prop passed to `TodoList`

### 9. Component Prop Additions
- **TodoItem.tsx**: Added optional `onSaveAsTemplate?: (todo: TodoWithRelations) => void` prop. Renders save-as-template button (data-testid="save-as-template-{id}") when prop is provided.
- **TodoList.tsx**: Added optional `onSaveAsTemplate?: (todo: TodoWithRelations) => void` prop, forwarded to all `TodoItem` instances.

### 10. E2E Tests (`tests/08-templates.spec.ts`)
6 test cases:
1. Save a todo as a template → verify template card appears
2. Open and close Template Manager
3. Use a template → new todo created
4. Template with no offset → todo has no due date
5. Delete template → existing todos unaffected
6. Category filter (Work/Personal/All) works correctly
7. Save template with subtasks (conditional based on subtask UI availability)

---

## Key Design Decisions

### tag_ids_json column migration
The `connection.ts` schema did NOT include `tag_ids_json` in the `CREATE TABLE templates` statement. Added an idempotent `ALTER TABLE` at module load in `lib/db/templates.ts`. Since `connection.ts` ran first and created the table, this migration runs immediately after. Pattern matches the existing migrations for `todos` table.

### Type extension
Added `tag_ids_json` and `tag_ids` fields to the local `lib/types/template.ts` (NOT the contracts file `PRDs/contracts/interfaces.ts` which is read-only). This is a local extension.

### Immutable patterns
All template data flows use spread operators; no mutation.

### tagDB.assignTag silently skips
`tagDB.assignTag` uses `INSERT OR IGNORE` — it already handles non-existent tag IDs gracefully at the SQLite level (FK constraint would fail but OR IGNORE prevents that). Added try-catch in the `use` route for extra safety.

---

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `app/api/templates/route.ts` | GET list, POST create | 80 |
| `app/api/templates/[id]/route.ts` | PUT update, DELETE | 95 |
| `app/api/templates/[id]/use/route.ts` | POST use template | 88 |
| `components/templates/TemplateCard.tsx` | Template card component | 95 |
| `components/templates/SaveTemplateModal.tsx` | Save-as-template dialog | 140 |
| `components/templates/TemplateManager.tsx` | Template browser modal | 105 |
| `lib/tokens/templates.ts` | Category constants | 12 |
| `tests/08-templates.spec.ts` | E2E tests | 195 |

## Files Modified

| File | Change |
|------|--------|
| `lib/db/templates.ts` | Full implementation (was stub) |
| `lib/hooks/useTemplates.ts` | Full implementation (was stub) |
| `lib/types/template.ts` | Added tag_ids_json, tag_ids fields |
| `components/todos/TodoItem.tsx` | Added onSaveAsTemplate prop + button |
| `components/todos/TodoList.tsx` | Added onSaveAsTemplate prop forwarding |
| `app/page.tsx` | Added Templates button + TemplateManager + SaveTemplateModal |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/templates | Yes | List all user templates |
| POST | /api/templates | Yes | Create template, returns 201 |
| PUT | /api/templates/[id] | Yes | Update template fields |
| DELETE | /api/templates/[id] | Yes | Delete template |
| POST | /api/templates/[id]/use | Yes | Create todo from template, returns 201 |

---

## Notes for Downstream Agents

- Feature 09 (Export/Import): `templateDB.findAll(userId)` returns all templates; `lib/types/template.ts` exports `Template` and `CreateTemplateDto`
- The `useTemplateMutation` in `useTemplates` returns the created `Todo` on success
- `templateDB.parseSubtasks(template)` and `templateDB.parseTagIds(template)` are safe to call (return empty array on parse error)
- The `TemplateManager` component automatically closes after a successful template use
- `SaveTemplateModal` requires `sourceTodo: TodoWithRelations` (not plain `Todo`) to access subtasks and tags

## Known Limitations

- The `use` route returns `Todo` (not `TodoWithRelations` with subtasks/tags). If calling code needs the full subtask list immediately, it should refetch via the todos query (which is invalidated on `useTemplateMutation` success).
- Template editing (changing subtask list) is not implemented in UI — delete and recreate is the workaround (per PRP-07 out-of-scope section).
