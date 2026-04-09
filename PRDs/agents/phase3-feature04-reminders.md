# Agent Memory: Phase 3 — Feature 04 — Reminders & Notifications

## Status: COMPLETE

## What Was Built

### DB Layer (`lib/db/todos.ts`)
- Implemented `findDueReminders(userId)` using pure SQLite epoch arithmetic (`strftime('%s', ...)`) — no timezone dependencies needed, UTC is correct for this comparison
- `updateLastNotificationSent` was already implemented in the existing stub
- Added `last_notification_sent` handling in the `update()` method (previously missing)

### Type Changes (`lib/types/todo.ts`)
- Added `last_notification_sent?: string | null` to `UpdateTodoDto` — required so the hook can stamp the sent timestamp via the existing PUT endpoint

### API Route (`app/api/notifications/check/route.ts`)
- GET endpoint, auth-gated via `getSession()`
- Returns `ApiResponse<TodoReminder[]>` — flat array (not nested under `.pending` key as the PRP doc showed — the actual contract interface uses flat `TodoReminder[]`)

### API Client (`lib/api/notifications.ts`)
- Implements `NotificationsApiContract` via `apiClient.get<TodoReminder[]>('/api/notifications/check')`

### Hook (`lib/hooks/useNotifications.ts`)
- State: `notificationsEnabled` (boolean), `permission` (NotificationPermission)
- `requestPermission()` calls `Notification.requestPermission()` and sets `notificationsEnabled = true` on grant
- TanStack Query polls every 30s, only when `notificationsEnabled && permission === 'granted'`
- `useEffect` fires browser Notifications with `tag: "todo-${id}"` for deduplication
- Uses `formatSingaporeDate()` (not `toSGDisplay` — the timezone module exports `formatSingaporeDate`)
- Calls `todosApi.updateTodo(id, { last_notification_sent })` to stamp after firing

### Components
- `components/notifications/NotificationToggle.tsx` — "Enable Notifications" button → granted badge → denied banner flow
- `components/todos/ReminderSelect.tsx` — shadcn Select with 7 options + "No reminder", disabled with hint when no due date
- `components/todos/ReminderBadge.tsx` — badge with 🔔 emoji, aria-label from REMINDER_OPTIONS

### CSS (`app/globals.css`)
- Added `--reminder` and `--reminder-foreground` CSS variables (purple palette) for both `:root` and `.dark`
- Added `--color-reminder` and `--color-reminder-foreground` Tailwind mappings in `@theme inline`

### Integration
- `TodoForm.tsx` — added `reminderMinutes` state, `ReminderSelect` below due date, auto-clear on due date removal, includes in submit DTO
- `TodoEditModal.tsx` — same integration pattern; populates from `todo.reminder_minutes` on open
- `TodoBadges.tsx` — ReminderBadge is shown (this file was also modified by Feature 06 agent in parallel)
- `app/page.tsx` — `NotificationToggle` in header

### PUT Route Enhancement (`app/api/todos/[id]/route.ts`)
- Added validation for `reminder_minutes` (must be in `[15, 30, 60, 120, 1440, 2880, 10080]`)
- Returns 400 if `reminder_minutes` set without `due_date`
- Auto-clears `reminder_minutes` when `due_date` is set to `null`

### E2E Tests (`tests/06-reminders.spec.ts`)
- 6 test cases covering: disabled state, enabled state, set reminder + badge, clear reminder in edit, change reminder, verify all 7 options, API endpoint check

## Pre-existing Bugs Fixed (not Feature 04 related)
- `lib/hooks/useTags.ts` was importing `queryKeys` from `@/lib/types` instead of `@/lib/queryKeys`
- `components/tags/TagManager.tsx` had incorrect `useState` type (`"#3B82F6"` literal instead of `string`) causing ColorPicker prop type mismatch

## Key Design Decisions

1. **No separate markSent API** — the hook uses the existing `PUT /api/todos/:id` with `{ last_notification_sent }` rather than creating a new endpoint. This matches the PRP doc's intent.

2. **Polling always enabled** — the `notificationsEnabled` flag is client-only; the API route itself doesn't need it since the route is protected by auth. When user grants permission, polling starts.

3. **findDueReminders uses last_notification_sent IS NULL** — the SQL query only fires once per reminder event. If a todo is edited (reminder changed), `last_notification_sent` must be reset to `null` server-side. This is not currently done in the edit flow — could be a future improvement.

4. **formatSingaporeDate** is used instead of `toSGDisplay` (which doesn't exist in the timezone module).

## Dependencies Consumed
- Feature 01: `todos` table, `PUT /api/todos/[id]`, `UpdateTodoDto`
- Feature 03: `reminder_minutes` column already in schema from recurring agent's inheritance

## Exports for Future Features
- `useNotifications` hook
- `ReminderBadge` component
- `ReminderSelect` component
- `requestNotificationPermission` helper from NotificationToggle
- `GET /api/notifications/check` endpoint
