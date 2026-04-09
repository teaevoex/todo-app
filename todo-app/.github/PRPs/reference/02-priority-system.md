# PRP 02: Priority System

## Feature Overview
Implement a three-level priority system for todos with consistent colors, sorting, filtering, and edit support. Priority is part of the core todo model and should feel first-class across creation, display, and search/filter views.

## User Stories
- As a user, I want to label todos as high, medium, or low priority so I can focus on important work.
- As a user, I want visual priority badges so I can scan my list quickly.
- As a user, I want high-priority items to appear first automatically.
- As a user, I want to filter by priority so I can narrow my workload.

## User Flow
1. User opens the todo creation form.
2. User selects `High`, `Medium`, or `Low` from a dropdown.
3. Todo is created with that priority, defaulting to `Medium` if omitted.
4. Todo list shows a color-coded priority badge.
5. User changes priority later in edit mode if needed.
6. User uses the priority filter to show only matching todos.

## Technical Requirements

### Types and Data
Define shared type in `lib/db.ts`:
```ts
export type Priority = 'high' | 'medium' | 'low';
```

Todo records must include:
- `priority` with default `'medium'`

### Validation
- Accept only `high`, `medium`, or `low`.
- Reject unknown values with `400`.
- Normalize casing from UI if needed before persistence.

### DB Layer
Ensure todo CRUD methods read and write `priority` consistently.

### API Requirements
- `POST /api/todos` accepts `priority`
- `PUT /api/todos/[id]` can update `priority`
- `GET /api/todos` returns `priority` for each todo

## UI Components
- Priority dropdown in create form
- Priority dropdown in edit modal/form
- Priority badge on each todo
- Priority filter dropdown in the filter area

Suggested badge semantics:
- `high`: red
- `medium`: yellow or amber
- `low`: blue

Support light and dark mode with sufficient contrast.

## Sorting Rules
- Sort order is `high` before `medium` before `low`.
- Within the same priority:
  - due date ascending
  - then creation order or id for stability

## Filter Behavior
- Filter choices:
  - All Priorities
  - High Priority
  - Medium Priority
  - Low Priority
- Priority filter combines with search, tag, date, and completion filters using AND logic.

## Edge Cases
- Todo created without explicit priority should become `medium`.
- Invalid priority string in API request should not be silently accepted.
- Editing a todo should preserve the current value when unchanged.
- Dark mode must not make the badge unreadable.

## Acceptance Criteria
- Three priority levels are available in create and edit flows.
- New todos default to `medium` if no priority is set.
- Badge colors are distinct and readable.
- Sorting shows high before medium before low.
- Priority filter limits visible todos correctly.
- Priority persists through create, read, update, export, import, templates, and recurring inheritance once those features exist.

## Testing Requirements

### E2E
- Create one todo per priority level.
- Verify the displayed badges and labels.
- Verify high-priority item appears before medium and low.
- Edit a low-priority todo to high and confirm reorder.
- Filter to each priority and verify only matching todos show.

### Unit / Integration
- Priority validation helper
- Priority sort comparator
- Default priority assignment in create flow

## Out of Scope
- Custom priority levels
- User-defined badge colors
- Priority weights beyond high/medium/low

## Success Metrics
- Users can visually distinguish urgency at a glance.
- Lists stay predictably sorted.
- The filter integrates cleanly with the advanced filtering feature.

## Evaluation Alignment

### Required Implementation Checklist
- Database `priority` field added to todos table
- Type definition: `type Priority = 'high' | 'medium' | 'low'`
- Priority validation in API routes
- Default priority set to `medium`
- Priority badge component with red, yellow, and blue variants
- Priority dropdown in create and edit forms
- Priority filter dropdown in UI
- Todos auto-sort by priority
- Dark mode color compatibility

### Required Testing
- E2E: create todo with each priority level
- E2E: edit priority
- E2E: filter by priority
- E2E: verify sorting high -> medium -> low
- Visual test: badge colors in light and dark mode

### Required Acceptance Criteria
- Three priority levels functional
- Color-coded badges visible
- Automatic sorting by priority works
- Filter shows only selected priority
- WCAG AA contrast compliance
