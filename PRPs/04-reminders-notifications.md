# PRP 04: Reminders & Notifications

## Feature Overview
Implement browser-based reminder notifications for todos with due dates. Users can select from a fixed set of reminder lead times, grant browser permission, and receive a notification when the reminder threshold is reached.

## User Stories
- As a user, I want reminders before a todo is due so I can act in time.
- As a user, I want a simple enable-notifications flow so setup is easy.
- As a user, I want reminders to fire only once per todo occurrence.

## User Flow
1. User clicks `Enable Notifications`.
2. Browser permission prompt appears.
3. User creates or edits a todo with a due date.
4. User selects a reminder offset.
5. Frontend polls for reminders that are now due.
6. Browser notification appears with todo details.
7. System records that reminder as sent so it is not repeated.

## Technical Requirements

### Data Model
Todo fields:
- `reminder_minutes: number | null`
- `last_notification_sent: string | null`

### Supported Reminder Values
- 15 minutes
- 30 minutes
- 60 minutes
- 120 minutes
- 1440 minutes (1 day)
- 2880 minutes (2 days)
- 10080 minutes (1 week)

### Validation
- Reminder requires a due date.
- Reminder must be one of the supported preset values.
- Clearing reminder should set `reminder_minutes` to `null`.

### Architecture
- Client hook: `lib/hooks/useNotifications.ts`
- API route: `GET /api/notifications/check`
- Polling interval: follow project documentation; user guide says every minute, copilot instructions mention polling endpoint and evaluation references 30 seconds. Choose one consistent implementation and document it in code and tests. Prefer one-minute polling unless the repo already standardizes otherwise.

### Notification Check Logic
For each incomplete todo with a due date and reminder:
1. Compute reminder timestamp from due date minus reminder offset.
2. Compare against current Singapore time.
3. Include todo if reminder time has arrived and `last_notification_sent` is null or outdated for the current occurrence.
4. After notifying, persist a `last_notification_sent` timestamp.

### API Contract
`GET /api/notifications/check`
- Auth required
- Returns todos requiring notification
- Response should include enough info for client notification text

Potential supporting route or update logic:
- mark reminder sent after notification dispatch

### UI Requirements
- `Enable Notifications` button near top-right area
- Button state reflects permission:
  - enable prompt
  - on/enabled state
- Reminder dropdown in create/edit forms
- Dropdown disabled unless due date exists
- Reminder badge on todos using concise labels:
  - `15m`
  - `30m`
  - `1h`
  - `2h`
  - `1d`
  - `2d`
  - `1w`

## Edge Cases
- Browser denies permission.
- Browser does not support Notifications API.
- Reminder time is already in the past when todo is created.
- Due date changes after reminder already sent.
- Recurring todo spawns next instance and must not reuse old sent timestamp.
- Multiple tabs are open and polling simultaneously.

## Acceptance Criteria
- Users can enable browser notifications.
- Reminder options are available only when due date exists.
- Notifications fire at the correct reminder threshold using Singapore time.
- Each reminder is sent only once per todo occurrence.
- Reminder badge renders correctly in the todo list.
- Editing due date or reminder recalculates notification timing properly.

## Testing Requirements

### E2E / Manual
- Enable notification permissions successfully.
- Create todo with due date and reminder.
- Verify reminder badge appears.
- Simulate or wait for reminder window and verify notification behavior.
- Update due date and confirm reminder schedule changes.

### Unit / Integration
- Reminder timestamp calculation
- Notification eligibility query logic
- Duplicate prevention using `last_notification_sent`
- Mapping reminder minutes to badge labels

## Out of Scope
- Email or SMS reminders
- Push notifications when browser is fully closed
- Custom reminder offsets
- Snooze actions

## Success Metrics
- Reminder system is reliable and non-duplicative.
- Users can trust the fixed reminder presets.
- Notification logic remains aligned with recurring todo behavior and Singapore time handling.

## Evaluation Alignment

### Required Implementation Checklist
- Database fields: `reminder_minutes` and `last_notification_sent`
- Custom hook: `useNotifications` in `lib/hooks/`
- API endpoint: `GET /api/notifications/check`
- `Enable Notifications` button with permission request
- Reminder dropdown with 7 timing options
- Reminder dropdown disabled without due date
- Browser notification on reminder time
- Polling system every 30 seconds to match evaluation criteria
- Duplicate prevention via `last_notification_sent`
- Reminder badge display with timing label

### Required Testing
- Manual: enable notifications
- Manual: receive notification at correct time
- E2E: set reminder on todo
- E2E: reminder badge displays correctly
- E2E: API returns todos needing notification
- Unit test: reminder time calculation in Singapore timezone

### Required Acceptance Criteria
- Permission request works
- All 7 timing options available
- Notifications fire at correct time
- Only one notification per reminder
- Works in Singapore timezone
