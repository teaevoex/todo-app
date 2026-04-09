# Agent Memory: Feature 03 — Recurring Todos

## Phase
Phase 2b

## Completed
2026-04-08T00:00:00+08:00

## Agent
feature agent on claude-sonnet-4-6

---

## What Was Planned

Full implementation of Recurring Todos as defined in PRDs/03-recurring-todos.md:
- `lib/recurrence.ts` — `calculateNextDueDate()` with Singapore timezone arithmetic
- Update `lib/db/todos.ts` — import from recurrence module (was inline)
- Add recurring validation to API routes (POST /api/todos, PUT /api/todos/[id])
- `components/todos/RecurrenceCheckbox.tsx` — toggle checkbox for recurring
- `components/todos/RecurrencePatternSelect.tsx` — dropdown for pattern selection
- `components/todos/RecurrenceBadge.tsx` — visual badge showing recurrence pattern
- Update `components/todos/TodoBadges.tsx` — add RecurrenceBadge
- Update `components/todos/TodoForm.tsx` — add recurrence fields
- Update `components/todos/TodoEditModal.tsx` — add recurrence fields
- Add recurrence CSS tokens to `app/globals.css`
- E2E tests: `tests/04-recurring-todos.spec.ts`

## What Was Built

All planned items implemented. Key decisions:

1. **Recurrence math in lib/recurrence.ts**: Uses pure JavaScript Date UTC arithmetic with a manual SG offset (UTC+8 = 8*60*60*1000 ms). No external date libraries needed. Converts UTC timestamps to SG "virtual UTC" components, performs arithmetic in SG calendar space, then converts back. This is reliable since Singapore has no DST (fixed UTC+8).

2. **Month-end clamping**: Uses `daysInMonth(year, month)` helper that exploits `Date.UTC(year, month, 0).getUTCDate()` (day 0 of the next month = last day of this month). Then `Math.min(sg.day, maxDay)` clamps naturally.

3. **Yearly leap year handling**: Same approach — compute `daysInMonth(nextYear, sg.month)` then clamp. Feb 29 2024 → Feb 28 2025 handled correctly.

4. **DB todos.ts**: The inline `calculateNextDueDate` function was replaced with an import from `lib/recurrence.ts`. The recurring completion logic (creating next instance on `completed: true`) was already in place from Feature 01.

5. **API validation**: Added recurring validation guards to both POST `/api/todos` and PUT `/api/todos/[id]`. For PUT, checks the existing todo's due_date when the request doesn't include a new one.

6. **TodoBadges**: Feature 02 agent had already modified TodoBadges to use a `PriorityBadge` component. Updated to also import and use `RecurrenceBadge`. The old inline `↻` badge was replaced with the new `RecurrenceBadge` component.

7. **RecurrenceCheckbox auto-uncheck**: When due date is cleared in `TodoForm` or `TodoEditModal`, `isRecurring` is automatically set to false (via `handleDueDateChange`).

8. **Default recurrence pattern**: `'weekly'` when checkbox is first checked (per PRP spec).

## Interface Deviations

### None from PRP spec
All components match the PRP specification exactly.

### Observed at runtime
- `TodoBadges.tsx` was modified by Feature 02 agent to use a `PriorityBadge` component and removed the old `Badge` import. The file now imports `PriorityBadge` from `./PriorityBadge`. Our update preserved this and added `RecurrenceBadge` import.
- The `data-testid` for the recurrence pattern select in the PRP says `"todo-recurrence-pattern-select"` but the component spec says `"todo-recurrence-select"`. We used `"todo-recurrence-select"` to match the component spec (shorter, consistent with the PRP's component spec section 4.2).

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `lib/recurrence.ts` | calculateNextDueDate with SG TZ arithmetic | ~110 |
| `components/todos/RecurrenceCheckbox.tsx` | "Repeat" checkbox toggle | ~30 |
| `components/todos/RecurrencePatternSelect.tsx` | Pattern dropdown (daily/weekly/monthly/yearly) | ~30 |
| `components/todos/RecurrenceBadge.tsx` | Visual badge with 🔄 icon | ~35 |
| `tests/04-recurring-todos.spec.ts` | Playwright E2E tests | ~170 |
| `PRDs/agents/phase2-feature03-recurring.md` | This file | — |

## Files Modified

| File | Changes | Reason |
|------|---------|--------|
| `lib/db/todos.ts` | Import calculateNextDueDate from lib/recurrence.ts; remove inline function | Use canonical implementation |
| `app/api/todos/route.ts` | Add is_recurring validation (400 if no due_date or no pattern) | PRP requirement |
| `app/api/todos/[id]/route.ts` | Add is_recurring validation on update | PRP requirement |
| `components/todos/TodoBadges.tsx` | Replace inline recurrence span with RecurrenceBadge component | PRP requirement |
| `components/todos/TodoForm.tsx` | Add isRecurring state, RecurrenceCheckbox, RecurrencePatternSelect | PRP requirement |
| `components/todos/TodoEditModal.tsx` | Add isRecurring state, RecurrenceCheckbox, RecurrencePatternSelect | PRP requirement |
| `app/globals.css` | Add --recurrence-{bg,text,border} tokens (light + dark) | RecurrenceBadge styling |

## calculateNextDueDate: Key Test Cases

| Pattern | Input (UTC) | SGT Wall Clock | Output (UTC) | Notes |
|---------|------------|----------------|--------------|-------|
| daily | 2026-04-08T01:00:00Z | 09:00 Apr 8 | 2026-04-09T01:00:00Z | +1 calendar day |
| weekly | 2026-04-08T01:00:00Z | 09:00 Apr 8 | 2026-04-15T01:00:00Z | +7 calendar days |
| monthly | 2026-03-10T02:00:00Z | 10:00 Mar 10 | 2026-04-10T02:00:00Z | same day next month |
| monthly | 2026-01-30T16:00:00Z | 00:00 Jan 31 | 2026-02-27T16:00:00Z | Jan 31 → Feb 28 (clamped) |
| monthly | 2028-01-30T16:00:00Z | 00:00 Jan 31 | 2028-02-28T16:00:00Z | Jan 31 → Feb 29 leap (clamped) |
| yearly | 2026-06-15T02:00:00Z | 10:00 Jun 15 | 2027-06-15T02:00:00Z | same date next year |
| yearly | 2028-02-28T16:00:00Z | 00:00 Feb 29 | 2029-02-27T16:00:00Z | Feb 29 → Feb 28 non-leap |

## Known Issues / Tech Debt

- **E2E test auth**: Tests in `04-recurring-todos.spec.ts` do not perform login (same as Feature 01). Will need `storageState` fixture once Feature 11 (auth) is complete. — HIGH — Downstream E2E runner should handle this.
- **Optimistic update**: The PRP specifies an optimistic update in `useUpdateTodo` that adds a placeholder next instance immediately. This was not implemented in the hook (Feature 01's unified `useTodos` hook uses `onSettled` invalidation). The server-side recurring creation still works — the UI just needs a refetch to show the new instance. — MEDIUM — UX improvement for Feature refactor sprint.
- **Unit tests for recurrence**: `lib/recurrence.test.ts` was not created (Vitest setup not yet configured). Unit testing logic is documented in the E2E spec file comments. — MEDIUM — Add once test runner is configured.
- **data-testid discrepancy**: PRP section 7.1 references `"todo-recurrence-pattern-select"` but component spec (section 4.2) and our implementation uses `"todo-recurrence-select"`. E2E tests use `"todo-recurrence-select"`. — LOW — Cosmetic naming.

## Integration Notes for Downstream Agents

### How to Use This Feature's Exports

- Import `calculateNextDueDate` from `@/lib/recurrence` for any feature that needs to advance due dates
- Import `RecurrenceBadge` from `@/components/todos/RecurrenceBadge` — takes `pattern: RecurrencePattern`
- `RECURRENCE_META` is local to `RecurrenceBadge.tsx` — if you need it elsewhere, extract to `lib/types/enums.ts`
- CSS variables `--recurrence-{bg,text,border}` are in `app/globals.css` for light/dark modes

### Gotchas

- `calculateNextDueDate` always works in UTC ISO-8601 strings both in and out
- The SG offset is hardcoded as `8 * 60 * 60 * 1000` ms — no DST concerns for Singapore
- `RecurrenceCheckbox` is `disabled` when `disabled={true}` is passed — the parent form controls this based on whether `dueDate` is set
- When the recurring checkbox is unchecked in the form/modal, `recurrence_pattern: null` is sent in the DTO
- The DB `update()` method already handles recurring completion (was in Feature 01) — it checks `dto.completed === true && updatedTodo.is_recurring && updatedTodo.recurrence_pattern && updatedTodo.due_date`

### Extension Points

- **Reminders (Feature 04)**: `reminder_minutes` is already copied in the DB's recurring completion logic
- **Templates (Feature 07)**: `Template` interface already has `is_recurring` and `recurrence_pattern` fields
- **Export/Import (Feature 09)**: `ExportTodo` already includes `is_recurring` and `recurrence_pattern`
