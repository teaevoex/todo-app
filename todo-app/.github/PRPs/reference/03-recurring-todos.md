# PRP 03: Recurring Todos

## Feature Overview
Implement recurring todos that automatically generate the next instance when the current instance is completed. Supported patterns are daily, weekly, monthly, and yearly. This feature depends on reliable todo CRUD behavior and Singapore-time date handling.

## User Stories
- As a user, I want repeating tasks for habits and routines so I do not need to recreate them manually.
- As a user, I want the next recurring instance to be created only when I complete the current one.
- As a user, I want recurring todos to preserve important metadata like priority, tags, and reminders.

## User Flow
1. User creates or edits a todo.
2. User enables `Repeat`.
3. User selects a recurrence pattern.
4. User sets a due date, which is required for recurrence.
5. Todo displays a recurrence badge in the list.
6. User marks the todo complete.
7. System marks the current todo complete and creates the next occurrence automatically.

## Technical Requirements

### Types
```ts
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
```

### Data Model
Todo fields:
- `is_recurring: boolean`
- `recurrence_pattern: RecurrencePattern | null`

### Validation Rules
- Recurring todo must have a due date.
- `is_recurring = true` requires a valid `recurrence_pattern`.
- `is_recurring = false` should clear `recurrence_pattern`.
- Only the four documented patterns are accepted.

### Recurrence Logic
When completing a recurring todo:
1. Mark current todo as completed.
2. Calculate next due date based on the current due date, not the current wall-clock time.
3. Create a new todo with inherited metadata:
   - title
   - priority
   - due time adjusted to next occurrence
   - recurrence settings
   - reminder offset
   - tags
4. New instance should be incomplete.
5. New instance should not inherit completion state or stale `last_notification_sent`.

Suggested rules:
- Daily: add 1 day
- Weekly: add 7 days
- Monthly: same day-of-month when possible, otherwise clamp sensibly
- Yearly: same month/day when possible

Use Singapore timezone helpers for all calculations.

### API Surface
- `POST /api/todos` can create recurring todos.
- `PUT /api/todos/[id]` handles completion and recurrence spawning logic.

### DB Layer
Expose helpers in `lib/db.ts`:
- create recurring todo
- clone metadata for next instance
- reattach tags to newly created instance

## UI Components
- `Repeat` checkbox in create/edit forms
- Recurrence pattern dropdown, shown only when repeat is enabled
- Recurring badge in todo list, for example `weekly`
- Validation message if repeat is enabled without a due date

## Edge Cases
- User enables repeat but leaves due date empty.
- User disables recurrence on an existing recurring todo.
- Month-end recurrence like January 31.
- Leap-year yearly recurrence like February 29.
- User repeatedly toggles completion and accidentally generates duplicates.
- Reminder metadata should carry forward as offset, not as a stale notification timestamp.

## Acceptance Criteria
- User can create recurring todos for daily, weekly, monthly, and yearly patterns.
- Recurring todos require a due date.
- Completing a recurring todo creates the next instance automatically.
- Next instance preserves title, priority, tags, recurrence pattern, and reminder offset.
- Next due date is calculated correctly using Singapore timezone logic.
- Disabling recurrence removes recurring behavior for future updates.

## Testing Requirements

### E2E
- Create one todo for each recurrence pattern.
- Complete a daily recurring todo and verify next day instance.
- Complete a weekly recurring todo and verify plus 7 days.
- Verify badge renders on recurring todo.
- Verify a recurring todo without due date is rejected.
- Verify inherited metadata on spawned instance.

### Unit / Integration
- Date calculation helper for each recurrence pattern
- End-of-month and leap-year cases
- Completion flow does not duplicate instances on a single successful toggle

## Out of Scope
- Custom recurrence rules
- Weekday-only recurrence
- Interval recurrence like every 3 days
- Skipping holidays automatically

## Success Metrics
- Users can maintain recurring routines without manual re-entry.
- Next-instance generation is predictable and metadata-complete.
- No duplicate future todos are created by normal completion flows.

## Evaluation Alignment

### Required Implementation Checklist
- Database fields: `is_recurring` and `recurrence_pattern`
- Type: `type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'`
- Validation: recurring todos require due date
- `Repeat` checkbox in create and edit forms
- Recurrence pattern dropdown
- Next instance creation on completion
- Due date calculation logic for daily, weekly, monthly, yearly
- Inherit priority, tags, reminder, and recurrence pattern
- Badge display with pattern name

### Required Testing
- E2E: create daily recurring todo
- E2E: create weekly recurring todo
- E2E: complete recurring todo creates next instance
- E2E: next instance has correct due date
- E2E: next instance inherits metadata
- Unit test: due date calculations for each pattern

### Required Acceptance Criteria
- All four patterns work correctly
- Next instance created on completion
- Metadata inherited properly
- Date calculations accurate in Singapore timezone
- Can disable recurring on existing todo
