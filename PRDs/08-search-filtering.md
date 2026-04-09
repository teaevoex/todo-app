# PRP-08: Search & Filtering

**Depends on:** PRP-02 (Priority System), PRP-06 (Tag System)
**Feature:** Real-time client-side search and multi-criteria filtering
**Last updated:** 2026-04-08

---

## 1. Feature Overview

Search & Filtering adds a powerful but lightweight client-side query layer over the existing todo list. Users can type a query in a search bar and immediately see matching todos filtered in real time. Separately, they can narrow results by priority, tag, or completion status via dropdown controls. All active filters are applied simultaneously using AND logic—a todo must satisfy every active criterion to appear.

The feature is intentionally client-side only: no new API endpoints or database tables are required. The full `todos` list is already fetched by `useTodos`; filtering applies over the in-memory array. This keeps the implementation simple, avoids additional network round trips, and ensures responsiveness. For the expected dataset (≤1 000 todos), client-side filtering runs in well under 100 ms.

A `FilterSummary` row displays all active filters as removable chips so users can see at a glance what constraints are applied. A single "Clear all filters" button resets everything. Search state lives in component-local state (not in the URL) to keep navigation simple and avoid polluting browser history with transient search queries.

---

## 2. User Stories

1. **As a user**, I want to type in a search box and see matching todos instantly so that I can find a specific task quickly.
2. **As a user**, I want to filter by priority level so that I can focus on high-priority work.
3. **As a user**, I want to filter by a tag so that I can see all todos in a particular category.
4. **As a user**, I want to filter by completion status (all / pending / completed) so that I can focus on outstanding work.
5. **As a user**, I want to combine search and multiple filters simultaneously so that I can narrow results very precisely.
6. **As a user**, I want to see a summary of all active filters so that I never forget which filters are applied.
7. **As a user (edge case)**, when no todos match the combined filters, I see a helpful empty state message rather than a blank list.
8. **As a user (edge case)**, clearing all filters immediately restores the full todo list.

---

## 3. Technical Requirements

### 3.1 Architecture Reference

| Layer | File | Responsibility |
|-------|------|---------------|
| Hook | `lib/hooks/useSearch.ts` | Debounced search query state |
| Hook | `lib/hooks/useFilters.ts` | Combined filter state + filtered todos derivation |
| Hook | `lib/hooks/useDebounce.ts` | Generic debounce (already exists; reused here) |
| Components | `components/search/SearchBar.tsx` | Search input with clear button |
| Components | `components/search/FilterBar.tsx` | Priority + tag + status dropdowns |
| Components | `components/search/FilterSummary.tsx` | Active filter chip list |
| Components | `components/search/ClearFiltersButton.tsx` | Resets all filter state |
| Types | `lib/types/filters.ts` | `FilterState`, `CompletionFilter` |
| Consumers | `app/page.tsx` | Passes `filteredTodos` to `TodoList` instead of raw `todos` |

**No new DB tables. No new API endpoints.**

### 3.2 Database Schema

*None required.* All filtering runs over the in-memory `todos` array returned by `useTodos()`.

### 3.3 API Endpoints

*None required.* The feature is entirely client-side.

### 3.4 TypeScript Types

```typescript
// lib/types/filters.ts

export type CompletionFilter = 'all' | 'pending' | 'completed'

export interface FilterState {
  searchQuery:       string                    // raw text, debounced before use
  priorityFilter:    'high' | 'medium' | 'low' | null
  tagFilter:         number | null             // tagId; null = all tags
  completionFilter:  CompletionFilter          // default 'all'
  dateFrom:          string | null             // ISO date string (optional)
  dateTo:            string | null             // ISO date string (optional)
}

export const DEFAULT_FILTER_STATE: FilterState = {
  searchQuery:      '',
  priorityFilter:   null,
  tagFilter:        null,
  completionFilter: 'all',
  dateFrom:         null,
  dateTo:           null,
}
```

```typescript
// lib/hooks/useFilters.ts (return shape)
export interface UseFiltersReturn {
  filterState:    FilterState
  filteredTodos:  Todo[]
  activeCount:    number            // number of non-default filters currently active
  setSearch:      (q: string) => void
  setPriority:    (p: FilterState['priorityFilter']) => void
  setTag:         (tagId: number | null) => void
  setCompletion:  (c: CompletionFilter) => void
  setDateFrom:    (d: string | null) => void
  setDateTo:      (d: string | null) => void
  clearAll:       () => void
}
```

---

## 4. React Components

### 4.1 Component Tree (ASCII)

```
app/page.tsx
├── SearchBar                       (search input, debounced)
├── FilterBar
│   ├── PrioritySelect              (common/Select wrapping priority options)
│   ├── TagFilter (from PRP-06)     (tag dropdown)
│   ├── CompletionSelect            (All / Pending / Completed)
│   └── DateRangePicker             (optional; dateFrom + dateTo)
├── FilterSummary                   (shown only when activeCount > 0)
│   ├── FilterChip[]                (one per active filter)
│   └── ClearFiltersButton
└── TodoList                        (receives filteredTodos, not raw todos)
    └── EmptyState                  (shown when filteredTodos.length === 0 AND todos.length > 0)
```

---

### 4.2 Component Specifications

#### `SearchBar`

**File:** `components/search/SearchBar.tsx` (≤ 80 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | ✓ | Current raw (non-debounced) query |
| `onChange` | `(q: string) => void` | ✓ | Called on every keystroke |
| `onClear` | `() => void` | ✓ | Called when × clear button clicked |

**Rendering:**
- `<input type="search">` with magnifier icon on left
- Show `×` clear button only when `value.length > 0`
- Placeholder: "Search todos and tags…"

**Implementation:** Uses shadcn `Input` from `@/components/ui/input`:
```tsx
import { Input } from '@/components/ui/input'

<div className="relative">
  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
  <Input
    type="search"
    className="pl-9 h-10"
    placeholder="Search todos and tags…"
    value={value}
    onChange={e => onChange(e.target.value)}
    aria-label="Search todos"
    data-testid="search-input"
  />
  {value.length > 0 && <button className="absolute right-3 ..." onClick={onClear} aria-label="Clear search" data-testid="search-clear" />}
</div>
```

**Design tokens:** uses shadcn classes — `h-10` for height, `border-input focus:ring-ring` on focus, `text-muted-foreground` for icon, `rounded-md`

**Accessibility:**
- `aria-label="Search todos"`
- `role="searchbox"` on input
- Clear button: `aria-label="Clear search"`
- `data-testid="search-input"`
- `data-testid="search-clear"`

---

#### `FilterBar`

**File:** `components/search/FilterBar.tsx` (≤ 120 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `filterState` | `FilterState` | ✓ | Current filter values |
| `onPriorityChange` | `(p: FilterState['priorityFilter']) => void` | ✓ | Priority selection |
| `onTagChange` | `(tagId: number \| null) => void` | ✓ | Tag selection |
| `onCompletionChange` | `(c: CompletionFilter) => void` | ✓ | Completion status selection |
| `onDateFromChange` | `(d: string \| null) => void` | ✓ | Date from change |
| `onDateToChange` | `(d: string \| null) => void` | ✓ | Date to change |

**Rendering:**
- Row of dropdowns: Priority | Tag | Status | Date From | Date To
- On mobile: wraps to two rows or collapses behind a "Filters" expand button

**Implementation:** Uses shadcn `Select` from `@/components/ui/select` for each dropdown:
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
```

**Design tokens:** uses shadcn classes — `gap-2` for row gap, `min-w-[128px]` for dropdown minimum width

**Accessibility:**
- `role="toolbar"` `aria-label="Filter todos"`
- `data-testid="filter-bar"`
- Priority select: `data-testid="priority-filter"`
- Completion select: `data-testid="completion-filter"`
- Date inputs: `data-testid="date-from-filter"`, `data-testid="date-to-filter"`

---

#### `FilterSummary`

**File:** `components/search/FilterSummary.tsx` (≤ 80 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `filterState` | `FilterState` | ✓ | Current state |
| `tags` | `Tag[]` | ✓ | All user tags (for resolving tagFilter name) |
| `onRemove` | `(key: keyof FilterState) => void` | ✓ | Remove single filter |
| `onClearAll` | `() => void` | ✓ | Clear all filters |

**Rendering (shown only when at least one filter is active):**
- `FilterChip` for each active filter:
  - Search: `"Search: {query}"` with `×`
  - Priority: `"Priority: {High|Medium|Low}"` with `×`
  - Tag: `"Tag: {tagName}"` with `×`
  - Completion: `"Status: {Pending|Completed}"` with `×` (not shown for "all")
  - Date from: `"From: {date}"` with `×`
  - Date to: `"To: {date}"` with `×`
- `ClearFiltersButton` at end of row

**Implementation:** Uses shadcn `Badge` from `@/components/ui/badge` for each filter chip:
```tsx
import { Badge } from '@/components/ui/badge'

<Badge variant="secondary" className="gap-1 text-xs rounded-full" data-testid={`filter-chip-${key}`}>
  {label}
  <button aria-label={`Remove ${description} filter`} onClick={() => onRemove(key)}>×</button>
</Badge>
```

**Design tokens:** uses shadcn classes — `bg-secondary text-secondary-foreground`, `rounded-full`, `text-xs`, `gap-2`

**Accessibility:**
- `aria-label="Active filters"`
- Each chip: `data-testid="filter-chip-{key}"` e.g. `filter-chip-search`
- Remove button on chip: `aria-label="Remove {filter description} filter"`

---

#### `ClearFiltersButton`

**File:** `components/search/ClearFiltersButton.tsx` (≤ 30 lines)

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onClick` | `() => void` | ✓ | Handler |
| `disabled` | `boolean` | — | Disabled when `activeCount === 0` |

**Accessibility:**
- `aria-label="Clear all filters"`
- `data-testid="clear-all-filters"`

---

## 5. TanStack Query Hooks

### `useSearch(initialQuery?: string)`

**File:** `lib/hooks/useSearch.ts`

```typescript
import { useState } from 'react'
import { useDebounce } from './useDebounce'

export function useSearch(initialQuery = '') {
  const [rawQuery, setRawQuery] = useState(initialQuery)
  const debouncedQuery = useDebounce(rawQuery, 300)

  return {
    rawQuery,          // bind to SearchBar value prop
    debouncedQuery,    // use for actual filtering
    setQuery: setRawQuery,
    clearQuery: () => setRawQuery(''),
  }
}
```

**Note:** `useDebounce` already exists in `lib/hooks/useDebounce.ts`. Reuse it.

---

### `useFilters(todos: Todo[])`

**File:** `lib/hooks/useFilters.ts`

```typescript
import { useState, useMemo } from 'react'
import { useSearch } from './useSearch'
import type { FilterState, UseFiltersReturn } from '@/lib/types/filters'

export function useFilters(todos: Todo[]): UseFiltersReturn {
  const { rawQuery, debouncedQuery, setQuery, clearQuery } = useSearch()
  const [priorityFilter, setPriority]     = useState<FilterState['priorityFilter']>(null)
  const [tagFilter,      setTag]           = useState<number | null>(null)
  const [completionFilter, setCompletion] = useState<CompletionFilter>('all')
  const [dateFrom, setDateFrom]           = useState<string | null>(null)
  const [dateTo,   setDateTo]             = useState<string | null>(null)

  const filteredTodos = useMemo(() => {
    const query = debouncedQuery.toLowerCase().trim()
    return todos.filter(todo => {
      // 1. Search: matches title OR any tag name
      if (query) {
        const titleMatch = todo.title.toLowerCase().includes(query)
        const tagMatch   = (todo.tags ?? []).some(t => t.name.toLowerCase().includes(query))
        if (!titleMatch && !tagMatch) return false
      }
      // 2. Priority filter
      if (priorityFilter && todo.priority !== priorityFilter) return false
      // 3. Tag filter
      if (tagFilter !== null && !(todo.tags ?? []).some(t => t.id === tagFilter)) return false
      // 4. Completion filter
      if (completionFilter === 'pending'   && todo.completed)  return false
      if (completionFilter === 'completed' && !todo.completed) return false
      // 5. Date range filter (due_date)
      if (dateFrom && todo.due_date && todo.due_date < dateFrom) return false
      if (dateTo   && todo.due_date && todo.due_date > dateTo)   return false
      return true
    })
  }, [todos, debouncedQuery, priorityFilter, tagFilter, completionFilter, dateFrom, dateTo])

  const activeCount = [
    debouncedQuery,
    priorityFilter,
    tagFilter,
    completionFilter !== 'all' ? completionFilter : null,
    dateFrom,
    dateTo,
  ].filter(Boolean).length

  const clearAll = () => {
    clearQuery()
    setPriority(null)
    setTag(null)
    setCompletion('all')
    setDateFrom(null)
    setDateTo(null)
  }

  return {
    filterState: { searchQuery: rawQuery, priorityFilter, tagFilter, completionFilter, dateFrom, dateTo },
    filteredTodos,
    activeCount,
    setSearch: setQuery,
    setPriority,
    setTag,
    setCompletion,
    setDateFrom,
    setDateTo,
    clearAll,
  }
}
```

**No TanStack Query involvement** — this hook is pure React state + `useMemo`. It does not call `useQuery` or `useMutation`.

**Performance:** `useMemo` dependency array includes all filter values + the `todos` array reference. TanStack Query returns a stable array reference when data has not changed, so unnecessary recomputations are avoided.

---

## 6. State Management

| Context | Read | Written |
|---------|------|---------|
| `useTodos()` QueryClient | `todos` data read via hook | Not written by this feature |
| `useTags()` QueryClient | `tags` data read for `FilterSummary` tag name resolution | Not written |

**Local state (all in `app/page.tsx` or a custom `useFilters` hook instance):**
- `rawQuery: string`
- `debouncedQuery: string` (derived via `useDebounce`)
- `priorityFilter: 'high' | 'medium' | 'low' | null`
- `tagFilter: number | null`
- `completionFilter: CompletionFilter`
- `dateFrom: string | null`
- `dateTo: string | null`

**URL state:** None. Filter state is transient local state only. Persisting filters to the URL is out of scope for this PRP.

**Integration with PRP-06 TagFilter:**
- `TagFilter` component from PRP-06 is reused inside `FilterBar` for the tag filter dropdown.
- When a user clicks a `TagBadge` on a `TodoItem` (PRP-06), it calls `setTag(tagId)` from this feature's filter state. The `TodoItem` component receives `onTagClick: (tagId: number) => void` prop wired to `setTag`.

---

## 7. Test Specifications

### 7.1 E2E Tests (Playwright)

**File:** `tests/09-search-filtering.spec.ts`

#### Test: "Search by todo title filters results"
```
1. Create todos "Buy milk", "Write report", "Buy groceries"
2. Type "buy" into [data-testid="search-input"]
3. Assert "Buy milk" visible
4. Assert "Buy groceries" visible
5. Assert "Write report" NOT visible
```

#### Test: "Search is case-insensitive"
```
1. Create todo "Meeting Notes"
2. Type "meeting" into [data-testid="search-input"]
3. Assert "Meeting Notes" visible
```

#### Test: "Search by tag name filters results"
```
1. Create tag "Work"; create todos "Task A" (tagged Work), "Task B" (no tag)
2. Type "work" into [data-testid="search-input"]
3. Assert "Task A" visible
4. Assert "Task B" NOT visible
```

#### Test: "Priority filter"
```
1. Create "High task" (priority=high), "Low task" (priority=low)
2. Select "High" in [data-testid="priority-filter"]
3. Assert "High task" visible
4. Assert "Low task" NOT visible
```

#### Test: "Completion filter - pending only"
```
1. Create "Pending task" (not completed), "Done task" (completed)
2. Select "Pending" in [data-testid="completion-filter"]
3. Assert "Pending task" visible
4. Assert "Done task" NOT visible
```

#### Test: "Combined search + priority filter (AND logic)"
```
1. Create "High buy task" (priority=high), "Low buy task" (priority=low), "High other" (priority=high)
2. Type "buy" in search
3. Select "High" in priority filter
4. Assert only "High buy task" visible
```

#### Test: "Filter summary chips appear and can be removed"
```
1. Type "buy" in search
2. Select "High" in priority filter
3. Assert [data-testid="filter-chip-searchQuery"] visible with text "Search: buy"
4. Assert [data-testid="filter-chip-priorityFilter"] visible with text "Priority: High"
5. Click × on [data-testid="filter-chip-searchQuery"]
6. Assert search chip gone; priority chip still visible
7. Assert "High buy task" and "High other" visible (only priority filter remains)
```

#### Test: "Clear all filters restores full list"
```
1. Apply search "buy" + priority "High"
2. Click [data-testid="clear-all-filters"]
3. Assert [data-testid="search-input"] value is empty
4. Assert all todos visible
5. Assert [data-testid="filter-chip-searchQuery"] NOT present
```

#### Test: "Empty state shown when no results match"
```
1. Create todo "Buy milk"
2. Type "zzznomatch" in search
3. Assert [data-testid="empty-state"] visible with appropriate message
4. Assert no todo cards visible
```

#### Test: "Performance: 1000 todos filter in <100ms"
```
1. Seed 1000 todos via API helper
2. Start timer
3. Type "task" into search
4. Measure time until DOM settles (MutationObserver or waitForFunction)
5. Assert elapsed time < 100ms
```

---

### 7.2 Unit Tests

**File:** `lib/hooks/useFilters.test.ts`

| Scenario | Input | Expected `filteredTodos.length` |
|----------|-------|--------------------------------|
| No filters | 10 todos | 10 |
| Search "buy" | todos with "Buy milk", "Buy bread", "Write report" | 2 |
| Search "WRITE" (uppercase) | same list | 1 ("Write report") |
| Search by tag name "work" | "Task A" tagged "work", "Task B" no tag | 1 |
| Priority filter "high" | 3 high + 2 medium | 3 |
| Completion "pending" | 4 pending + 6 completed | 4 |
| Completion "completed" | same | 6 |
| Tag filter tagId=5 | 2 todos with tagId=5, 3 without | 2 |
| Combined: search "buy" + priority "high" | "Buy milk" (high), "Buy bread" (low) | 1 |
| Empty search string | 10 todos | 10 (no filtering) |
| All filters match nothing | any todos | 0 |
| dateFrom filter | todos: due 2026-01-01, 2026-06-01; dateFrom=2026-03-01 | 1 (2026-06-01 only) |
| dateTo filter | same todos; dateTo=2026-03-01 | 1 (2026-01-01 only) |
| date range: both from and to | dateFrom=2026-01-15, dateTo=2026-06-15 | 1 (2026-06-01 only) |

**File:** `lib/hooks/useSearch.test.ts`

| Scenario | Action | Expected |
|----------|--------|----------|
| Initial state | - | `rawQuery=''`, `debouncedQuery=''` |
| Set query | `setQuery('buy')` | `rawQuery='buy'` immediately |
| Debounce | `setQuery('buy')` then wait <300ms | `debouncedQuery=''` still |
| Debounce settled | `setQuery('buy')` then wait 300ms | `debouncedQuery='buy'` |
| Clear | `setQuery('buy')` → `clearQuery()` | `rawQuery=''`, `debouncedQuery=''` |

---

### 7.3 Integration Tests

*No new API integration tests required.* All integration behavior is covered by the existing `useTodos` contract tests. The following verifications are recommended as part of page-level integration:

```
1. Mount app/page.tsx with mocked useTodos returning 10 todos
2. Render SearchBar + FilterBar + TodoList
3. Fire change event on search input with "buy"
4. After 300ms debounce: assert only matching todos in rendered TodoList
5. Change priority filter select to "high"
6. Assert combined filter applied (AND logic)
7. Click "Clear all filters"
8. Assert all 10 todos rendered
```

---

## 8. Acceptance Criteria

1. Typing in the search box filters todos in real time with a 300 ms debounce.
2. Search matches on todo title and on tag names (case-insensitive).
3. Priority filter shows only todos with the selected priority level; "All" shows all.
4. Tag filter shows only todos with the selected tag; "All tags" shows all.
5. Completion filter supports "All" / "Pending" / "Completed" options.
6. Date-from filter hides todos whose due date is before the selected date.
7. Date-to filter hides todos whose due date is after the selected date.
8. All active filters are combined with AND logic.
9. `FilterSummary` is visible whenever at least one filter is active and hidden otherwise.
10. Each `FilterChip` has a remove button that clears only that filter.
11. "Clear all filters" resets all filter state simultaneously and immediately.
12. An appropriate empty state is shown when the filtered list is empty but the full list is not.
13. Filtering 1 000 todos completes in under 100 ms (measured client-side).
14. Search state is not stored in the URL; refreshing the page clears all filters.
15. Clicking a `TagBadge` on a `TodoItem` sets the tag filter to that tag.
16. `useDebounce` hook from `lib/hooks/useDebounce.ts` is reused (not reimplemented).

---

## 9. Integration Points

### 9.1 What This Feature Consumes

| Feature | Usage |
|---------|-------|
| PRP-01 Todo CRUD | `useTodos()` — reads the full todos array (with `tags` field populated) |
| PRP-02 Priority System | `priority` field on `Todo`; priority filter options match `Priority` enum |
| PRP-06 Tag System | `useTags()` — resolves tag names in `FilterSummary`; `TagFilter` component reused; `Todo.tags` field |
| `lib/hooks/useDebounce.ts` | Debounces search input (300 ms) |
| `components/ui/select` | Priority and completion filter dropdowns |
| `components/ui/input` | Search input in SearchBar |
| `components/ui/badge` | Filter chips in FilterSummary |
| `common/EmptyState.tsx` | No-results empty state (custom component) |
| `TagFilter` (PRP-06) | Reused inside `FilterBar` |

### 9.2 What This Feature Exposes

| Artifact | Consumed by |
|----------|-------------|
| `lib/types/filters.ts` (`FilterState`, `CompletionFilter`) | Any future feature needing to share or persist filter state |
| `lib/hooks/useFilters.ts` | `app/page.tsx` (main page), potential calendar filter in PRP-10 |
| `lib/hooks/useSearch.ts` | `app/page.tsx`, any future page needing debounced search |
| `SearchBar` component | Any page requiring search functionality |
| `FilterBar` component | Main page; potentially calendar view |
| `FilterSummary` component | Main page |

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Search input cleared with × | Immediately shows full unfiltered list (debounce bypassed on explicit clear) |
| Search query is only whitespace | Trimmed to empty string; treated as no search filter |
| Todo has `tags = undefined` | Treated as `[]`; tag search and tag filter safely skip |
| Todo has `due_date = null` | Date range filters skip this todo (null due date is excluded from date comparisons) |
| `dateFrom > dateTo` | Both filters applied independently; results will be empty (user error, not caught by UI) |
| 0 todos in system | Empty state shows "No todos yet" (not search-specific empty state) |
| `useTodos` is loading | Show skeleton/spinner; filter controls disabled |
| `useTodos` returns error | Show error state; filter controls disabled |
| Tag id in `tagFilter` no longer exists (tag deleted) | `filteredTodos` returns 0 matches; user sees empty state; `FilterSummary` shows stale tag name from last `useTags` cache |
| Very long search query (>200 chars) | No server validation needed; client search simply finds no matches |
| Special regex characters in search (e.g. `(`, `[`) | Use `String.includes()` not regex; special characters treated literally |
| Rapid typing (faster than debounce) | Each keystroke resets debounce timer; only last value fires |
| `useMemo` returns same reference | When filters unchanged and todos unchanged; no re-render |

---

## 11. Out of Scope

- Server-side search / API-level filtering
- URL persistence of filter state (local state only)
- Saved filter presets (future feature)
- Full-text search across description fields (only title + tag names)
- Sorting (separate feature)
- Multi-tag filter (AND multiple tags simultaneously)
- Fuzzy / typo-tolerant search
- Search history or autocomplete suggestions
- Highlighting matched text in todo titles

---

## 12. Singapore Timezone Considerations

- Date range filters (`dateFrom`, `dateTo`) compare `todo.due_date` ISO strings lexicographically. Since `due_date` values are stored as Singapore timezone ISO 8601 strings (e.g. `"2026-04-15T09:00:00+08:00"`), string comparison is valid only when all dates are in the same timezone format.
- The `DateTimePicker` used for `dateFrom`/`dateTo` inputs in `FilterBar` must emit Singapore-timezone ISO strings using `lib/timezone.ts → toSingaporeISO()`. Do **not** use `new Date().toISOString()` (which returns UTC).
- E2E tests that exercise date range filtering must use dates expressed in `Asia/Singapore` timezone to match stored `due_date` values. Use helpers from `tests/helpers.ts` that wrap `lib/timezone.ts`.
- `useDebounce` operates on strings; no timezone logic needed there.
- `FilterSummary` displays `dateFrom`/`dateTo` values using `formatSingaporeDate()` from `lib/timezone.ts` for human-readable display (e.g. "15 Apr 2026").
