# Agent Memory: Phase 5 — Feature 09 Export & Import

**Feature:** Export & Import (JSON backup and restore)
**Implemented by:** Sonnet 4.6
**Date:** 2026-04-08

---

## Files Created / Modified

### New Files
- `app/api/todos/export/route.ts` — GET endpoint, builds ExportPayload from user data
- `app/api/todos/import/route.ts` — POST endpoint, runs import in a SQLite transaction
- `lib/hooks/useExportImport.ts` — useExport and useImport TanStack mutation hooks
- `components/export-import/ExportButton.tsx` — Download trigger button with loading state
- `components/export-import/ImportButton.tsx` — File picker with validation and error display
- `tests/10-export-import.spec.ts` — Playwright E2E tests
- `PRDs/agents/phase5-feature09-export.md` — This memory file

### Modified Files
- `lib/api/export-import.ts` — Replaced stub with real Blob-returning exportTodos() and importTodos()
- `app/page.tsx` — Added ExportButton and ImportButton to header toolbar

---

## Key Implementation Decisions

### Export Route
- Fetches `todoDB.findAll(userId)` (includes subtasks and tags relations via joins)
- Fetches `tagDB.findAll(userId)` for all user tags
- Builds ExportPayload with stripped user_id fields
- Sets `Content-Disposition: attachment; filename="todos-export-{SG-DATE}.json"`
- Uses Singapore timezone for filename date via `Intl.DateTimeFormat`

### Import Route
- Runs entire import in a single `db.transaction()` for atomicity (rollback on failure)
- ID remapping strategy:
  1. Tags: match by lowercased name → reuse or create; build `oldTagId → newId` map
  2. Todos: insert and build `oldTodoId → newId` map
  3. Subtasks: remap `todo_id` via map
  4. TodoTags: remap both `todo_id` and `tag_id` via maps
- Returns `{ imported: { todos, subtasks, tags } }` counts

### API Client
- `exportTodos()` returns `Blob` (not parsed JSON) for browser download
- `importTodos()` returns `ImportResult` by parsing the JSON response directly (not via apiClient wrapper)
- Needed separate implementation because the export response is a raw Blob, not an ApiResponse wrapper

### Components
- ExportButton creates blob URL → hidden anchor element → programmatic click → revoke URL
- ImportButton uses hidden `<input type="file">` triggered by visible Button
- FileReader reads file as text → JSON.parse → calls importMutation
- Success message via browser `alert()` (simple approach consistent with spec)

### Type Notes
- `ImportResult` in `lib/types/api.ts` uses `imported: { todos, subtasks, tags }` structure
- `ExportPayload` uses `version: number` (not literal `1`) in the local types — compatible with interface contract

---

## Edge Cases Handled
- Tag deduplication by lowercased name match
- Optional `subtasks`, `tags`, `todoTags` arrays (default to `[]` if absent)
- Version validation: missing → 400 "Missing required field: version"; wrong → 400 "Unsupported export version"
- Missing `todos` array → 400
- Subtask references unknown `todo_id` → throws inside transaction → rolled back → 400
- TodoTag references unknown `tag_id` or `todo_id` → same rollback path

---

## Known Limitations
- Success notification uses browser `alert()` — should be replaced with toast if a toast system is added
- No client-side file size check before upload (spec mentions 10MB guard, out of scope per PRP)
- E2E tests rely on `alert()` dialog interception for success verification

---

## Potential Future Work
- Replace `alert()` with a proper toast notification system
- Add unit tests for import/export DB helpers
- Add integration tests for the route handlers
