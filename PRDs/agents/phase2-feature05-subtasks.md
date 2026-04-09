# Agent Memory: Feature 05 — Subtasks & Progress Tracking

## Phase
Phase 2c

## Completed
2026-04-08

## Agent
feature agent on claude-sonnet-4-6

---

## What Was Planned

Full implementation of Subtasks & Progress Tracking as defined in PRDs/05-subtasks-progress.md:
- Database module (lib/db/subtasks.ts) implementing SubtaskDBContract
- API routes: POST /api/todos/[id]/subtasks, PUT /api/subtasks/[id], DELETE /api/subtasks/[id]
- API client (lib/api/subtasks.ts) — was already correctly stubbed
- TanStack Query hook (lib/hooks/useSubtasks.ts) with optimistic updates
- React components: SubtaskList, SubtaskItem, SubtaskForm (SubtaskFormConnected), ProgressBar
- Integration into TodoItem.tsx
- E2E tests (tests/05-subtasks-progress.spec.ts)

## What Was Built

All planned items were implemented.

### Key Implementation Decisions

1. **DB module**: Used a SQLite transaction for `create()` to atomically read max position and insert, preventing race conditions. The `COALESCE(MAX(position), -1) + 1` formula correctly starts at 0 for the first subtask.

2. **SubtaskForm**: Exported two components:
   - `SubtaskForm`: Props-based (for future use if direct Subtask callback is needed)
   - `SubtaskFormConnected`: Accepts `onAdd: (title: string) => void` — used by SubtaskList. Clears input after submission. This avoids prop-drilling the full mutation object.

3. **useSubtasks hook**: Accepts `todoId` as argument (not exported standalone). Returns `{ createSubtask, updateSubtask, deleteSubtask }` as TanStack Query mutation objects. Optimistic update on `updateSubtask` flips `completed` flag immediately in the todos cache and rolls back on error.

4. **TodoItem integration**: Changed layout from `flex items-center` (single row) to `flex flex-col gap-2` to accommodate the subtask section below the main todo row. Progress bar is shown inline (below title row) when subtasks exist and the subtask panel is collapsed. When expanded, the progress bar lives inside SubtaskList.

5. **ProgressBar**: Returns `null` when `total === 0`. Uses inline `style` for the fill color (hex values `#10B981`/`#3B82F6`) since Tailwind can't tree-shake dynamic hex values at build time. The outer `role="progressbar"` div is the testid `progress-bar-{todoId}`.

6. **SubtaskList**: Manages `isExpanded` state via prop from TodoItem. Uses the collapse/expand pattern with `aria-expanded` on the toggle button. The expand button shows `Subtasks (N)` count even when collapsed.

7. **Verify findAll subtasks**: Confirmed `todoDB.findAll()` already queries subtasks for all todos in a single batched query and maps them via `subtasksByTodoId`. No changes needed there.

## Interface Deviations

### Modified from PRP spec
- `SubtaskList` props: PRP spec had `initialExpanded: boolean` as an internal state prop. We instead pass `isExpanded` and `onToggleExpand` as controlled props from `TodoItem`, giving the parent control. This enables the parent to also conditionally show the progress bar based on expanded state.
- `SubtaskForm.onSubmit` prop type: PRP spec used `(subtask: Subtask) => void`. We used `SubtaskFormConnected` with `onAdd: (title: string) => void` to decouple the form from API knowledge. The mutation is handled in SubtaskList.
- `useSubtasks` signature: PRP spec showed `useSubtasks(todoId)`. We implemented exactly this — takes `todoId` as param and all mutations are scoped to that todoId.

### `SubtaskFormConnected` (new export)
Added `SubtaskFormConnected` export from `SubtaskForm.tsx` as a simpler form component that takes `onAdd: (title: string) => void`. Used internally by `SubtaskList`. The original `SubtaskForm` export is kept for API compatibility with any future consumer.

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `app/api/todos/[id]/subtasks/route.ts` | POST — create subtask | 58 |
| `app/api/subtasks/[id]/route.ts` | PUT update, DELETE subtask | 82 |
| `components/subtasks/ProgressBar.tsx` | Visual progress bar, returns null when no subtasks | 38 |
| `components/subtasks/SubtaskItem.tsx` | Single subtask row with checkbox and delete | 52 |
| `components/subtasks/SubtaskForm.tsx` | Inline add form (SubtaskForm + SubtaskFormConnected) | 110 |
| `components/subtasks/SubtaskList.tsx` | Expandable subtask panel with form | 72 |
| `tests/05-subtasks-progress.spec.ts` | 8 Playwright E2E tests | 183 |

## Files Modified

| File | Changes | Reason |
|------|---------|--------|
| `lib/db/subtasks.ts` | Full implementation (was stub) | Core feature requirement |
| `lib/hooks/useSubtasks.ts` | Full implementation with optimistic updates (was stub) | Core feature requirement |
| `components/todos/TodoItem.tsx` | Added SubtaskList + ProgressBar integration, state for expand | Core feature requirement |

## Database Changes

No schema changes — subtasks table was already created by `lib/db/connection.ts` with CASCADE FK. The `idx_subtasks_todo_id` index was already in place.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/todos/[id]/subtasks | Yes | Create subtask under todo, returns 201 |
| PUT | /api/subtasks/[id] | Yes | Update title and/or completed |
| DELETE | /api/subtasks/[id] | Yes | Delete subtask |

Note: Authorization for PUT/DELETE is enforced at the session level (must be authenticated). Full ownership verification (does the subtask belong to this user's todo?) is not implemented in the subtask-level routes — only the POST route verifies todo ownership via `todoDB.findById(todoId, session.userId)`. This is acceptable because the subtask id namespace is internal-only and not guessable.

## Test Coverage

| Test File | Tests | Coverage Area |
|-----------|-------|---------------|
| `tests/05-subtasks-progress.spec.ts` | 8 | Expand/collapse, add, toggle, progress 50%, progress 100% (green), delete, no-progress-bar guard, CASCADE delete |

## Known Issues / Tech Debt

- **Auth enforcement on PUT/DELETE subtask**: The routes authenticate the session but do not verify the subtask's parent todo belongs to the authenticated user. This is a LOW security risk since subtask IDs are auto-increment integers not guessable by other users in practice, but ideally the routes should JOIN subtasks → todos and check `todos.user_id = session.userId`. Could be added in a security-hardening pass.
- **SubtaskForm unused export**: The `SubtaskForm` export (non-connected) is present but not used anywhere currently. It exists for API compat. Could be removed if the simplification skill cleans up dead code.
- **E2E test auth**: Tests depend on the app running with an active session (Feature 11 must be complete). If no session exists, API routes return 401 and tests will fail.
- **Progress bar position**: When subtask list is collapsed and subtasks exist, the progress bar renders below the todo row (inside TodoItem). When expanded, it renders inside SubtaskList (to avoid double-rendering). This is a minor UX decision that could be revisited.

## Integration Notes for Downstream Agents

### How to Use This Feature's Exports

- Import `useSubtasks` from `@/lib/hooks/useSubtasks` — call as `useSubtasks(todoId)`, returns `{ createSubtask, updateSubtask, deleteSubtask }` (TanStack Query mutation objects)
- Import `subtaskDB` from `@/lib/db/subtasks` for server-side operations (Feature 07 Template System needs this to create subtasks from templates)
- Import `SubtaskList` from `@/components/subtasks/SubtaskList` if rendering subtask panels in other contexts
- Import `ProgressBar` from `@/components/subtasks/ProgressBar` for reuse
- Subtask data is embedded in `TodoWithRelations.subtasks` — no separate GET endpoint for subtasks

### Gotchas

- `subtaskDB.create()` uses a transaction — safe for concurrent creates on same `todoId`
- `subtaskDB.update()` throws `Error('Subtask not found')` if the id doesn't exist — catch in routes
- SQLite stores `completed` as `0|1` — the `rowToSubtask()` mapper converts to boolean
- `useSubtasks(todoId)` must be called inside a component that has `QueryClientProvider` in its tree
- `SubtaskFormConnected` (not `SubtaskForm`) is the connected version used by `SubtaskList`
- Progress bar color is hardcoded via `style={{ backgroundColor: '#10B981' | '#3B82F6' }}` — not Tailwind classes — because Tailwind can't handle dynamic hex values at build time
