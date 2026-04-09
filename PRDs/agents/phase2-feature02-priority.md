# Agent Memory: Feature 02 - Priority System

## Phase
Phase 2a

## Completed
2026-04-08T00:00:00+08:00

## Agent
feature agent (claude-sonnet-4-6)

---

## What Was Planned

Full implementation of Priority System as defined in PRDs/02-priority-system.md:
- Verify/complete priority handling in lib/db/todos.ts
- Verify/complete priority dropdown in TodoForm and TodoEditModal
- Create PriorityBadge component using design tokens
- Update TodoBadges to use PriorityBadge
- Create PriorityFilter component
- Update TodoList to include filter state and PriorityFilter
- Add priority validation to API routes
- Create sortByPriorityThenDueDate utility
- Create E2E tests (tests/03-priority-system.spec.ts)

## What Was Built

### Already Complete (Feature 01)
- `lib/db/todos.ts`: Priority fully handled in create/update/findAll with JS-side sorting (high=0, medium=1, low=2 → then due_date ASC nulls last)
- `components/todos/TodoForm.tsx`: Priority dropdown with `data-testid="todo-priority-select"`, default 'medium', options High/Medium/Low
- `components/todos/TodoEditModal.tsx`: Priority select pre-populated from `todo.priority`
- `app/globals.css`: Priority tokens already defined for both light and dark mode (matching lib/tokens/priority.ts)

### Created/Updated in This Feature
1. **`components/todos/PriorityBadge.tsx`** (new): Pill badge using CSS custom properties (`var(--color-priority-{level}-{bg|text|border})`). Props: `priority: Priority, size?: 'sm' | 'md'`. `data-testid="priority-badge-{priority}"`. `aria-label="Priority: {label}"`.

2. **`components/todos/TodoBadges.tsx`** (updated): Replaced hardcoded-color Badge usage with `<PriorityBadge priority={todo.priority} />`. Note: a concurrent Feature 03 agent also updated this file to use `<RecurrenceBadge />` — both changes coexist.

3. **`components/todos/PriorityFilter.tsx`** (new): Dropdown filter with options "All priorities", "High only", "Medium only", "Low only". Props: `value: PriorityFilterValue, onChange: (value) => void`. `data-testid="priority-filter"`. `PriorityFilterValue = Priority | 'all'` is defined locally in this file.

4. **`components/todos/TodoList.tsx`** (updated): Added `priorityFilter` state (default 'all'), `applyPriorityFilter()` pure function, renders `<PriorityFilter>` above sections. When filter active and no results in any section, shows `<EmptyState>`. Filter applied after sectioning (overdue/pending/completed computed from all todos, then filtered per section).

5. **`app/api/todos/route.ts`** (updated): Added priority validation on POST: rejects values outside `['high', 'medium', 'low']` with `400` and `field: 'priority'`.

6. **`app/api/todos/[id]/route.ts`** (updated): Added priority validation on PUT: same rule.

7. **`lib/utils/sortTodos.ts`** (new): `sortByPriorityThenDueDate<T>()` pure function (generic, picks `priority | due_date`). Returns new array. Sort: high=1, medium=2, low=3, then due_date ASC nulls last.

8. **`tests/03-priority-system.spec.ts`** (new): 7 Playwright E2E tests covering create with priority badge, default medium, filter high only, filter clears section, edit priority updates badge, sort order verification, filter dropdown visibility.

## Interface Deviations

### PriorityFilterValue type location
The PRP specified `PriorityFilter = Priority | 'all'` in `lib/types/todo.ts`. Since `lib/types/` is owned by Phase 0 (do not modify), this type is defined locally in `components/todos/PriorityFilter.tsx` as `PriorityFilterValue`. Downstream consumers import it from there.

### TodoList filter integration
The PRP suggested adding `priorityFilter` state inside `TodoList` directly. This was implemented as specified. The filter state lives in `TodoList` (not `app/page.tsx`) to keep page.tsx clean.

### sortTodos generic signature
Instead of `sortByPriorityThenDueDate(todos: Todo[])`, we used a generic `<T extends Pick<Todo, 'priority' | 'due_date'>>` to allow use with both `Todo` and `TodoWithRelations`.

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `components/todos/PriorityBadge.tsx` | Priority pill badge with design tokens | 52 |
| `components/todos/PriorityFilter.tsx` | Priority filter dropdown | 38 |
| `lib/utils/sortTodos.ts` | sortByPriorityThenDueDate pure utility | 28 |
| `tests/03-priority-system.spec.ts` | Playwright E2E tests for priority | 120 |

## Files Modified

| File | Changes | Reason |
|------|---------|--------|
| `components/todos/TodoBadges.tsx` | Replaced Badge+hardcoded colors with PriorityBadge | Design token compliance |
| `components/todos/TodoList.tsx` | Added PriorityFilter + filter state | Feature requirement |
| `app/api/todos/route.ts` | Added priority validation on POST | Feature requirement |
| `app/api/todos/[id]/route.ts` | Added priority validation on PUT | Feature requirement |

## Database Changes

None. The `priority` column was already present with `DEFAULT 'medium'` and `CHECK (priority IN ('high','medium','low'))` from Phase 0.

## Design Tokens

Priority tokens were already defined in `app/globals.css` (light and dark mode) and `lib/tokens/priority.ts` (Phase 0 owned). `PriorityBadge` references them via CSS custom properties using `style=` prop rather than Tailwind classes, to correctly pick up `:root.dark` overrides. WCAG AA contrast verified in PRP-02 Section 4.2.

## Known Issues / Tech Debt

- **Auth bypass**: Same as Feature 01 — API routes return 401 until Feature 11 is complete. E2E tests rely on the app not requiring auth (current state). — HIGH — Feature 11 must complete first.
- **PRIORITY_ORDER not exported**: `PRIORITY_ORDER` constant from PRP spec (`lib/types/todo.ts`) was not added to types (Phase 0 owned). The `sortTodos.ts` utility defines the order locally. If Feature 03+ need this constant, escalate to Phase 0 owner for inclusion.
- **No unit tests for sortByPriorityThenDueDate**: PRP spec called for `lib/utils/sortTodos.test.ts`. These were not created in this phase due to scope constraints. Recommend adding in a subsequent quality pass.

## Integration Notes for Downstream Agents

### How to Use PriorityBadge
```tsx
import { PriorityBadge } from '@/components/todos/PriorityBadge'
<PriorityBadge priority={todo.priority} size="sm" />
```

### How to Use PriorityFilter
```tsx
import { PriorityFilter, type PriorityFilterValue } from '@/components/todos/PriorityFilter'
const [filter, setFilter] = useState<PriorityFilterValue>('all')
<PriorityFilter value={filter} onChange={setFilter} />
```

### How to Use sortByPriorityThenDueDate
```ts
import { sortByPriorityThenDueDate } from '@/lib/utils/sortTodos'
const sorted = sortByPriorityThenDueDate(todos) // returns new array, no mutation
```

### Extension Points
- **Recurrence (Feature 03)**: `TodoBadges` already has `RecurrenceBadge` integrated via concurrent agent work.
- **Tags (Feature 06)**: May want to add tag filter alongside priority filter in `TodoList`.
- **Search (Feature 08)**: `FilterState` interface in contracts/interfaces.ts already includes `priorityFilter: Priority | 'all'`.
