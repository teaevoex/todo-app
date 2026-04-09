# PRP 08: Search & Filtering

## Feature Overview
Implement real-time search and multi-criteria filtering for todos, including support for text search across todo titles and subtasks, quick filters, advanced filters, and saved filter presets stored client-side.

## User Stories
- As a user, I want to find todos quickly by typing a search term.
- As a user, I want to combine filters like priority, tag, completion status, and date range.
- As a user, I want to save frequent filter combinations for reuse.

## User Flow
1. User types into the search field.
2. Results update in real time.
3. User optionally applies priority or tag filters.
4. User expands advanced filters for completion status or date range.
5. User saves a preset for future reuse.
6. User re-applies a saved preset later with one click.

## Technical Requirements

### Search Scope
Search must match:
- todo title
- subtask titles
- tag names in advanced mode and in the combined client-side search index used for evaluation compliance

Case-insensitive partial matching is required.

### Filter Inputs
- Search text
- Priority
- Tag
- Completion status
- Due date from
- Due date to

### Combination Rules
- All active filters use AND logic.
- Date range applies only to todos with due dates.
- Search should remain responsive for normal app data sizes.
- Search input should be debounced at 300ms to match evaluation criteria.

### Saved Presets
Store saved presets in browser `localStorage`.

Suggested structure:
```ts
interface SavedFilterPreset {
  id: string;
  name: string;
  search: string;
  priority: 'all' | 'high' | 'medium' | 'low';
  tagId: number | 'all';
  completion: 'all' | 'complete' | 'incomplete';
  dueDateFrom: string;
  dueDateTo: string;
}
```

Presets are browser-local, not server-synced.

## UI Components
- Search input with clear button
- Priority dropdown
- Tag dropdown
- Filter summary or indicator showing active filters
- Advanced toggle button
- Advanced panel containing:
  - completion status dropdown
  - due date from input
  - due date to input
  - saved preset pills/buttons
- `Clear All` button when any filter is active
- `Save Filter` button when useful state exists
- Empty state message for no results

## Implementation Guidance
- Perform client-side filtering in `app/page.tsx` unless performance clearly requires server support.
- Prefer deriving filtered lists from fetched todos and related metadata.
- Include subtask text in the search index or matching function.
- Keep preset persistence resilient to JSON parse errors from localStorage.

## Edge Cases
- No todos match the active filters.
- User has no tags but tag filter UI should stay graceful.
- Only one side of date range is provided.
- Search text contains mixed case or extra whitespace.
- Preset data in localStorage is malformed.

## Acceptance Criteria
- Search matches todo titles and subtask titles.
- Filters can be combined together.
- `Clear All` resets every active filter.
- Saved presets can be created, applied, and deleted.
- Date range filtering behaves correctly for from-only, to-only, and bounded ranges.
- The UI stays responsive for ordinary user datasets.

## Testing Requirements

### E2E
- Search by todo title.
- Search by subtask text.
- Filter by priority.
- Filter by tag.
- Filter by completion status.
- Filter by date range.
- Combine multiple filters and verify AND logic.
- Save a preset, refresh, and reapply it from localStorage.
- Delete a saved preset.

### Unit / Integration
- Search matcher logic
- Filter combination function
- localStorage save/load/delete helpers
- Date-range comparison behavior in Singapore timezone-aware formatting contexts

## Out of Scope
- Full-text server indexing
- Fuzzy ranking
- Cross-user shared presets
- Natural-language search queries

## Success Metrics
- Users can narrow large todo lists quickly.
- Presets make repeated workflows faster.
- Search/filter interactions remain intuitive and fast.

## Evaluation Alignment

### Required Implementation Checklist
- Search input field at top of page
- Real-time filtering with no submit button
- Case-insensitive search
- Search matches todo titles
- Search matches tag names
- Priority filter dropdown
- Tag filter, including click badge behavior if implemented
- Combined filters with AND logic
- Filter summary or indicator
- Clear all filters button
- Empty state for no results
- Debounced search at 300ms

### Required Testing
- E2E: search by title
- E2E: search by tag name
- E2E: filter by priority
- E2E: filter by tag
- E2E: combine multiple filters
- E2E: clear filters
- Performance test: filter 1000 todos in under 100ms

### Required Acceptance Criteria
- Search is case-insensitive
- Includes tag names in search
- Filters combine with AND
- Real-time updates
- Clear message for empty results
