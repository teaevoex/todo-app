# Agent Memory: Feature 08 — Search & Filtering

## Phase
Phase 4b

## Completed
2026-04-08T00:00:00+08:00

## Agent
feature agent (claude-sonnet-4-6)

---

## What Was Planned

Full implementation of Search & Filtering as defined in PRDs/08-search-filtering.md:
- Implement useSearch hook with debounce
- Implement useFilters hook combining all filter state + AND logic filtering
- Create SearchBar, FilterBar, CompletionFilter, FilterSummary, ClearFiltersButton components
- Remove internal filtering from TodoList (renders only, no filter logic)
- Integrate FilterBar + FilterSummary into app/page.tsx
- Pass filtered todos to TodoList via useMemo
- Create E2E tests: tests/09-search-filtering.spec.ts
- Write agent memory file

## What Was Built

### Updated Files

1. **`lib/hooks/useSearch.ts`** (complete rewrite of stub): Exports `useSearch(initialQuery?)` returning `{ searchQuery, debouncedQuery, setSearchQuery, clearSearch }`. Uses `useDebounce` at 300ms. Simple, focused hook.

2. **`lib/hooks/useFilters.ts`** (new): Core filter state manager. Holds all FilterState fields, exposes `filterTodos(todos)` (pure filter function using memoized filter values), `activeFilterCount`, `clearAllFilters()`, and per-field setters. Uses `useSearch` internally for debounced search.

3. **`components/todos/TodoList.tsx`** (updated — major refactor): Removed all internal filtering state, PriorityFilter, TagFilter, and applyPriorityFilter/applyTagFilter functions. Now purely a render component. Accepts `isFiltered?: boolean` prop to show appropriate empty state message ("No todos match your filters" vs. "No todos yet."). Also added `onTagClick?: (tagId: number) => void` prop (now passed from page.tsx).

4. **`components/todos/EmptyState.tsx`** (minor update): Added `action?: ReactNode` prop for optional action button below the message.

5. **`app/page.tsx`** (updated): Integrated `useFilters` and `useTags`. Renders FilterBar + FilterSummary between TodoForm and TodoList. Applies `filterTodos()` via `useMemo`. Wires `handleTagClick` (sets tag filter when clicking a tag badge on a todo). Handles `handleRemoveFilter` for individual chip removal.

### New Files

| File | Purpose | Lines |
|------|---------|-------|
| `lib/hooks/useSearch.ts` | Debounced search state hook | 25 |
| `lib/hooks/useFilters.ts` | Combined filter state + filter logic | 105 |
| `components/search/SearchBar.tsx` | Search input with icon + clear button | 42 |
| `components/search/FilterBar.tsx` | Container for all filter controls | 60 |
| `components/search/CompletionFilter.tsx` | "All / Active / Completed" shadcn Select | 48 |
| `components/search/FilterSummary.tsx` | Active filter badge chips | 75 |
| `components/search/ClearFiltersButton.tsx` | Ghost button to clear all filters | 28 |
| `tests/09-search-filtering.spec.ts` | Playwright E2E tests | 180 |

## Key Design Decisions

### FilterState uses 'incomplete' not 'pending'
The `FilterState` interface in `lib/types/api.ts` (Phase 0 owned) uses `'incomplete'` as the completion filter value (not `'pending'` as the PRP spec suggested). This was preserved to match the existing contract. The UI labels say "Active" for `'incomplete'`.

### filterTodos is NOT memoized inside useFilters
The `filterTodos` function is re-created each render, so `app/page.tsx` wraps filtered results in `useMemo([todos, filters])`. The filters object is itself memoized inside `useFilters` so reference equality holds when nothing changes.

### PriorityFilter remains in components/todos/
The existing `PriorityFilter` component was not moved — it is imported by `FilterBar` from its current location. This avoids breaking the Phase 2 agent contract.

### TagFilter remains in components/tags/
Same approach — `FilterBar` imports and delegates to the existing `TagFilter` component.

### TodoList no longer imports useTags or PriorityFilter
Removes that coupling entirely. All filter state lives in `app/page.tsx` via `useFilters`.

## Interface Deviations from PRP

| Deviation | Reason |
|-----------|--------|
| `completionFilter: 'incomplete'` not `'pending'` | Matches existing `FilterState` contract in `lib/types/api.ts` |
| `useFilters` returns `filterTodos(todos)` function instead of pre-filtered `filteredTodos` | Allows page.tsx to use `useMemo` at the right level |
| No `setDateFrom`/`setDateTo` UI controls in FilterBar | Date range pickers not in scope for this iteration; state is wired but no UI rendered |
| `ClearFiltersButton` also appears inside `FilterSummary` | Dual presence provides convenience in both locations |

## Files Modified

| File | Changes |
|------|---------|
| `lib/hooks/useSearch.ts` | Complete rewrite from stub to working implementation |
| `components/todos/TodoList.tsx` | Removed all filter logic; now render-only |
| `components/todos/EmptyState.tsx` | Added optional `action` prop |
| `app/page.tsx` | Integrated useFilters, FilterBar, FilterSummary; passes filtered todos |

## Integration Notes for Downstream Agents

### How to Use useFilters
```tsx
import { useFilters } from '@/lib/hooks/useFilters'
const { filters, filterTodos, activeFilterCount, setSearch, setPriority, setTag, setCompletion, clearAllFilters } = useFilters()
const filtered = useMemo(() => filterTodos(todos), [todos, filters])
```

### How to Use FilterBar
```tsx
import { FilterBar } from '@/components/search/FilterBar'
<FilterBar
  filterState={filters}
  tags={tags}
  activeFilterCount={activeFilterCount}
  onSearchChange={setSearch}
  onPriorityChange={setPriority}
  onTagChange={setTag}
  onCompletionChange={setCompletion}
  onClearAll={clearAllFilters}
/>
```

### Tag Click Integration
When a user clicks a tag badge on a `TodoItem`, call `setTag(tagId)` from `useFilters`. Wire this via `onTagClick` prop on `TodoList` → `TodoItem`.

### TodoList is now render-only
`TodoList` no longer accepts `tagFilter` or `onTagFilterChange` props. Pass already-filtered todos and an `isFiltered` boolean flag.

## Known Issues / Tech Debt

- **Date range filter UI**: State wiring exists in `useFilters` but no date picker inputs are rendered in `FilterBar`. Can be added in a later iteration using `DateTimePicker` from `components/ui/`.
- **Search in URL**: Filter state is local only; not persisted to URL. Per spec, this is intentional.
- **Unit tests for useFilters**: Not created; covered by E2E tests. Recommend adding `lib/hooks/useFilters.test.ts` in a quality pass.
- **Performance test**: The 1000-todo Playwright performance test was not implemented (requires seeding via API helper which is not built).
