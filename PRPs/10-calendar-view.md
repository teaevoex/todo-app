# PRP 10: Calendar View

## Feature Overview
Implement a monthly calendar page that visualizes todos by due date and supports month navigation. The calendar should reflect Singapore timezone dates and optionally highlight Singapore public holidays if seeded in the database.

## User Stories
- As a user, I want a calendar view so I can see workload across the month.
- As a user, I want todos to appear on the correct date cells.
- As a user, I want to move between months easily.
- As a user, I want holiday context for Singapore dates when available.

## User Flow
1. User navigates to `/calendar`.
2. Calendar shows the current month.
3. User sees todos distributed by due date.
4. User clicks previous or next month.
5. Calendar updates to that month while keeping todos aligned to date cells.

## Technical Requirements

### Route
- Create `app/calendar/page.tsx`
- Protect route with existing auth middleware pattern
- Provide URL state management via `?month=YYYY-MM`

### Data Requirements
Calendar uses todos that have `due_date`.
Optional holiday data comes from the `holidays` table if present.
- Add `GET /api/holidays`
- Seed `holidays` table with Singapore holidays

### Rendering Rules
- Display a monthly grid with weekday headings.
- Day headers must be `Sun-Sat`.
- Use Singapore timezone to determine:
  - current month
  - day boundaries
  - placement of todos into date cells
- Highlight the current day.
- Apply weekend styling.
- Show a todo count badge on days with one or more todos.
- Show todo title and priority signal in the date cell.
- Handle days from adjacent months as empty or muted cells depending on design choice.

### Navigation
- Previous month button
- Next month button
- Today button
- Current month label, for example `November 2025`

### Holiday Integration
If holiday data exists:
- highlight holiday dates
- optionally show holiday name
- keep styling secondary to todo visibility

## UI Components
- Month header with navigation controls
- Calendar grid
- Day cells
- Todo chips or short list within each day cell
- Optional holiday label
- Click day to open a modal listing that day's todos

## Edge Cases
- Multiple todos on one day causing crowded cells.
- Todos without due dates should not appear.
- Month boundaries across years, such as December to January.
- Leap-year February.
- User timezone differs from Singapore timezone; app still uses Singapore placement.

## Acceptance Criteria
- Calendar route loads for authenticated users.
- Current month displays by default.
- Todos appear on the correct due-date cells using Singapore timezone.
- Month navigation works across month and year boundaries.
- Todos without due dates are excluded.
- Holiday highlights appear when holiday data is available.

## Testing Requirements

### E2E
- Visit `/calendar` and confirm current month renders.
- Create todos on different dates and verify placement.
- Navigate to previous and next months.
- Verify a todo without due date does not appear.

### Unit / Integration
- Month grid generation
- Date-to-cell mapping using Singapore timezone
- Navigation state transitions
- Holiday lookup integration

## Out of Scope
- Weekly/day calendar modes
- Drag-and-drop rescheduling in calendar
- ICS sync
- Shared team calendars

## Success Metrics
- Users can visually plan by month.
- Date placement is consistent with the app’s Singapore timezone contract.
- Calendar remains readable even with moderate todo volume.

## Evaluation Alignment

### Required Implementation Checklist
- Database `holidays` table seeded with Singapore holidays
- API endpoint: `GET /api/holidays`
- Calendar route: `/calendar`
- Calendar generation logic for weeks and days
- Month navigation with previous, next, and today buttons
- Day headers `Sun-Sat`
- Current day highlighted
- Weekend styling
- Holiday display with names
- Todos appear on due dates
- Todo count badge on days
- Click day opens todos modal
- URL state management with `?month=YYYY-MM`

### Required Testing
- E2E: calendar loads current month
- E2E: navigate to previous and next month
- E2E: today button works
- E2E: todo appears on correct date
- E2E: holiday appears on correct date
- E2E: click day opens modal
- Unit test: calendar generation

### Required Acceptance Criteria
- Calendar displays correctly
- Holidays shown
- Todos on correct dates
- Navigation works
- Modal shows day's todos
