# Agent Memory: Phase 3 — Feature 06 — Tag System

**Implemented by:** Feature 06 agent (Sonnet 4.6)
**Date:** 2026-04-08
**Status:** Complete — TypeScript check passes with zero errors

---

## What Was Built

### 1. Database Module (`lib/db/tags.ts`)
Full implementation of `TagDBContract`:
- `create`: INSERT with UNIQUE(user_id, name) constraint; catches SQLite error and rethrows as `'Tag name already exists'`
- `findAll`: SELECT ORDER BY name ASC
- `findById`: SELECT with user_id guard
- `update`: UPDATE with UNIQUE conflict rethrow
- `delete`: DELETE with existence check
- `getTagsForTodo`: JOIN tags + todo_tags WHERE todo_id = ?
- `assignTag`: INSERT OR IGNORE (idempotent)
- `removeTag`: DELETE FROM todo_tags

All operations synchronous (better-sqlite3).

### 2. API Routes
- `app/api/tags/route.ts` — GET (list), POST (create with 409 on duplicate)
- `app/api/tags/[id]/route.ts` — PUT (update), DELETE
- `app/api/todos/[id]/tags/route.ts` — POST (assign tagIds[]), DELETE (remove tagIds[])
- `app/api/todos/[id]/route.ts` — **Updated** PUT to handle `tagIds` diff (add/remove by computing set difference vs current tags)

### 3. API Client (`lib/api/tags.ts`)
Already implemented as a stub — no changes needed.

### 4. TanStack Query Hook (`lib/hooks/useTags.ts`)
Full implementation using `@/lib/queryKeys` (separate file, not from `@/lib/types`):
- `tagsQuery` (staleTime: 60s, gcTime: 300s)
- `createTag`, `updateTag`, `deleteTag` mutations → invalidate tags (+ todos for update/delete)
- `assignTag`, `removeTag` mutations → invalidate todos

### 5. Components (all in `components/tags/`)
- **TagBadge.tsx**: Colored pill with dynamic inline styles (15% opacity bg, full color text); `role="button"` when onClick provided; `onRemove` shows X button
- **TagSelector.tsx**: Multi-select dropdown with checkboxes; shows selected tags as removable pills; empty state handled
- **TagFilter.tsx**: shadcn Select dropdown for filtering by tag; shows colored dot per option
- **TagManager.tsx**: shadcn Dialog modal; create form + list with inline edit + delete confirmation

### 6. Integrations
- **TodoBadges.tsx**: Extended to show `TagBadge` components; max 5 visible + "+N more" chip; accepts `onTagClick` prop
- **TodoItem.tsx**: Added `onTagClick` prop, passes to `TodoBadges`
- **TodoList.tsx**: Added `TagFilter` + tag filter state; `applyTagFilter` function; passes `onTagClick` to `TodoItem`
- **TodoForm.tsx**: Added `TagSelector` with `useTags` hook, submits `tagIds`
- **TodoEditModal.tsx**: Added `TagSelector` pre-populated with `todo.tags`, submits `tagIds` for diff update
- **app/page.tsx**: Added "Manage Tags" button (data-testid="manage-tags-button") and `<TagManager>` modal

### 7. E2E Tests (`tests/07-tags.spec.ts`)
8 test cases covering: open/close manager, create tag, assign to todo, filter by clicking badge, rename propagation, delete cascade, duplicate conflict error, remove tag from todo.

---

## Key Design Decisions

### queryKeys location
`queryKeys` is in `lib/queryKeys.ts` (standalone file), NOT exported from `lib/types`. The linter auto-corrected the import path.

### Tag assignment on todo update
When `tagIds` is present in PUT `/api/todos/[id]`, the route computes a set diff against current tags using `tagDB.getTagsForTodo()` and calls `removeTag`/`assignTag` accordingly. This is atomic enough for single-user usage.

### Dynamic colors via inline styles
Tag color cannot use Tailwind (arbitrary hex), so all color application uses `style={{ backgroundColor: ... }}`. The `${color}26` pattern gives ~15% opacity (26 = 0x26 = 38/255 ≈ 15%).

### TagSelector interaction model
The selector shows a dropdown with checkboxes. Selected tags appear as removable TagBadge pills in the trigger area. The trigger button toggles open/close.

### useTodos tagIds integration
The existing `todoDB.create()` and the `POST /api/todos` route already handled `tagIds` (Feature 01 agent pre-wired this). The PUT route was the only place that needed updating.

---

## Files Modified

| File | Change |
|------|--------|
| `lib/db/tags.ts` | Full implementation |
| `lib/hooks/useTags.ts` | Full implementation |
| `app/api/tags/route.ts` | New |
| `app/api/tags/[id]/route.ts` | New |
| `app/api/todos/[id]/tags/route.ts` | New |
| `app/api/todos/[id]/route.ts` | Added tagIds diff logic to PUT |
| `components/tags/TagBadge.tsx` | New |
| `components/tags/TagSelector.tsx` | New |
| `components/tags/TagFilter.tsx` | New |
| `components/tags/TagManager.tsx` | New |
| `components/todos/TodoBadges.tsx` | Added TagBadge rendering + onTagClick |
| `components/todos/TodoItem.tsx` | Added onTagClick prop |
| `components/todos/TodoList.tsx` | Added TagFilter + tag filtering logic |
| `components/todos/TodoForm.tsx` | Added TagSelector + selectedTagIds |
| `components/todos/TodoEditModal.tsx` | Added TagSelector + pre-selection |
| `app/page.tsx` | Added "Manage Tags" button + TagManager |
| `tests/07-tags.spec.ts` | New E2E tests |

---

## Notes for Future Agents

- Feature 08 (Search & Filtering) will consume `TagFilter` in a unified `FilterBar`; the `tagFilter` prop on `TodoList` is already wired for external control
- Feature 07 (Templates) can call `tagDB.assignTag(newTodoId, tagId)` to copy tags when instantiating a template
- Feature 09 (Export/Import) can call `tagDB.findAll(userId)` and reference `ExportTag`/`ExportTodoTag` types already in contracts
- The `TodoBadges` component now accepts `Todo | TodoWithRelations` — it safely checks for the `tags` field
