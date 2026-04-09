# PRP-04: Reminders & Notifications

> **Push-free reminder system** — polls the server every 30 seconds and fires browser notifications.
> An agent reading only this file + `ARCHITECTURE.md` + PRP-01 has enough context to implement the feature completely.

**Status:** Ready for implementation
**Priority:** P1
**Dependencies:** PRP-01 (Todo CRUD Operations)
**Depended on by:** None

---

## 1. Feature Overview

The Reminders & Notifications feature allows users to attach a time-based reminder to any todo that has a due date. Seven timing options are available: 15 minutes, 30 minutes, 1 hour, 2 hours, 1 day, 2 days, and 1 week before the due date. When the reminder fires, the browser shows a native notification with the todo's title and a formatted due-date string.

The implementation uses a **polling architecture** rather than WebSockets or server-sent events, keeping the stack simple. A TanStack Query hook calls `GET /api/notifications/check` every 30 seconds. The server returns all todos for the authenticated user where the reminder threshold has been crossed but `last_notification_sent` is still null (or was set before a re-activation). The client receives those todos, fires a `Notification` for each, and then calls a follow-up API to stamp `last_notification_sent`, preventing duplicate notifications.

Browser Notification permission is requested lazily — only when the user activates their first reminder — using the `NotificationToggle` component. If permission is denied, an inline fallback message is shown instead of a native notification.

---

## 2. User Stories

**US-01 — Set a reminder on create**
As a user, when I create a todo with a due date, I want to choose a reminder time (15m / 30m / 1h / 2h / 1d / 2d / 1w before) so that I receive a notification before the due date.

**US-02 — Set a reminder via edit**
As a user, I want to open the edit modal for an existing todo and add or change its reminder, or remove it entirely.

**US-03 — Receive a browser notification**
As a user who has granted notification permission, I want to see a browser notification when the reminder time arrives (within 30 seconds of the threshold crossing), showing the todo title and due date.

**US-04 — Grant notification permission**
As a first-time user, when I select a reminder time, I want the app to ask for notification permission if it hasn't already been granted. If I deny, I should see an inline warning.

**US-05 — Reminder disabled without due date**
As a user, if I have not set a due date on a todo, the reminder dropdown should be disabled with a tooltip explaining why.

**US-06 — Notification deduplication**
As a user, if the app is open in two tabs, I should receive the notification only once — not once per tab.

**US-07 — Edge: reminder after todo completed**
As a user who completes a todo before the reminder fires, I should NOT receive a notification for the completed todo.

**US-08 — Edge: permission revoked**
As a user who revokes notification permission in the browser, if a reminder fires the app should silently fail to show a native notification and display a console warning (not crash).

**US-09 — Edge: no due date → no reminder**
As a user, if I remove the due date from a todo that already has a reminder set, the reminder should be automatically cleared.

---

## 3. Technical Requirements

### 3.1 Architecture Reference

| Concern | Location |
|---------|----------|
| DB schema migration | `lib/db/migrations/004-reminders.sql` |
| DB operations | `lib/db/notifications.ts` — `getPendingReminders`, `markNotificationSent` |
| API route | `app/api/notifications/check/route.ts` — `GET` handler |
| API client | `lib/api/notifications.ts` — `checkNotifications`, `markSent` |
| Types | `lib/types/notification.ts` |
| Hook | `lib/hooks/useNotifications.ts` |
| Components | `components/todos/ReminderSelect.tsx`, `components/notifications/NotificationToggle.tsx` |
| Timezone | `lib/timezone.ts` — reminder threshold computed in UTC |

### 3.2 Database Schema

```sql
-- Migration: 004-reminders.sql
-- Adds two columns to todos (safe ALTER TABLE — idempotent)

ALTER TABLE todos ADD COLUMN reminder_minutes INTEGER;
-- e.g. 15, 30, 60, 120, 1440 (1d), 2880 (2d), 10080 (1w)

ALTER TABLE todos ADD COLUMN last_notification_sent TEXT;
-- ISO-8601 UTC timestamp, null = not yet sent

-- Index to speed up the polling query
CREATE INDEX IF NOT EXISTS idx_todos_reminder
  ON todos(user_id, completed, reminder_minutes, last_notification_sent, due_date);
```

**Reminder → minutes mapping:**
```
15 minutes  → 15
30 minutes  → 30
1 hour      → 60
2 hours     → 120
1 day       → 1440
2 days      → 2880
1 week      → 10080
```

**Server-side query logic for `GET /api/notifications/check`:**
```sql
SELECT * FROM todos
WHERE
  user_id = ?
  AND completed = 0
  AND reminder_minutes IS NOT NULL
  AND due_date IS NOT NULL
  AND last_notification_sent IS NULL
  AND (
    -- reminder time = due_date minus reminder_minutes
    -- as epoch: strftime('%s', due_date) - (reminder_minutes * 60)
    -- fire when reminder_time <= now (i.e., we've passed the threshold)
    CAST(strftime('%s', due_date) AS INTEGER) - (reminder_minutes * 60)
      <= CAST(strftime('%s', 'now') AS INTEGER)
  )
```

This query returns only todos where the reminder threshold has been crossed but no notification has been sent yet. The `completed = 0` guard ensures we skip completed todos.

### 3.3 API Endpoints

#### `GET /api/notifications/check`

Checks for todos whose reminder time has passed but no notification has been sent yet.

**Request headers:** `Cookie: session=<token>`

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "pending": [
      {
        "id": 42,
        "title": "Submit quarterly report",
        "due_date": "2026-04-10T02:00:00.000Z",
        "reminder_minutes": 60
      }
    ]
  }
}
```

**Returns empty array when no reminders pending:**
```json
{ "success": true, "data": { "pending": [] } }
```

**Error `401 Unauthorized`:**
```json
{ "success": false, "error": "Unauthorized" }
```

---

#### `PUT /api/todos/[id]` — used to stamp `last_notification_sent`

After firing a notification client-side, the hook calls:
```
PUT /api/todos/{id}
Body: { "last_notification_sent": "<current UTC ISO string>" }
```

This reuses the existing update endpoint from PRP-01. No new endpoint needed.

---

#### Extended validation for `POST /api/todos` and `PUT /api/todos/[id]`

```typescript
// Valid reminder_minutes values
const VALID_REMINDER_MINUTES = [15, 30, 60, 120, 1440, 2880, 10080]

if (body.reminder_minutes !== undefined && body.reminder_minutes !== null) {
  if (!VALID_REMINDER_MINUTES.includes(body.reminder_minutes)) {
    return Response.json(
      { success: false, error: 'Invalid reminder time', field: 'reminder_minutes' },
      { status: 400 }
    )
  }
  // Cannot have reminder without due_date
  const effectiveDueDate = body.due_date ?? existingTodo?.due_date
  if (!effectiveDueDate) {
    return Response.json(
      { success: false, error: 'A due date is required to set a reminder', field: 'due_date' },
      { status: 400 }
    )
  }
}

// If due_date is being cleared, also clear reminder_minutes
if (body.due_date === null && existingTodo?.reminder_minutes) {
  body.reminder_minutes = null
  body.last_notification_sent = null
}
```

### 3.4 TypeScript Types

```typescript
// lib/types/notification.ts

export type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080

export interface ReminderOption {
  value: ReminderMinutes
  label: string          // e.g. "15 minutes before"
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  { value: 15,    label: '15 minutes before' },
  { value: 30,    label: '30 minutes before' },
  { value: 60,    label: '1 hour before'     },
  { value: 120,   label: '2 hours before'    },
  { value: 1440,  label: '1 day before'      },
  { value: 2880,  label: '2 days before'     },
  { value: 10080, label: '1 week before'     },
]

export interface PendingReminder {
  id: number
  title: string
  due_date: string        // ISO-8601 UTC
  reminder_minutes: ReminderMinutes
}

export interface NotificationsCheckResponse {
  success: true
  data: {
    pending: PendingReminder[]
  }
}

export type NotificationPermission = 'default' | 'granted' | 'denied'
```

---

## 4. React Components

### 4.1 Component Tree ASCII

```
app/layout.tsx (or app/page.tsx)
└── AppProviders
    └── NotificationToggle        ← NEW: sits at app level, handles permission + polling

TodoForm (create + edit)
└── ReminderSelect                ← NEW: dropdown inside form

TodoItem
└── TodoBadges
    ├── PriorityBadge             (PRP-02)
    ├── RecurrenceBadge           (PRP-03)
    └── ReminderBadge             ← NEW: 🔔 icon shown when reminder is set
```

### 4.2 Component Specs

#### `ReminderSelect`

**File:** `components/todos/ReminderSelect.tsx`
**Purpose:** Dropdown for choosing a reminder time relative to the due date. Disabled and labelled when no due date is set.

**Props:**
```typescript
interface ReminderSelectProps {
  value: ReminderMinutes | null
  onChange: (value: ReminderMinutes | null) => void
  disabled?: boolean         // true when no due_date in parent form
}
```

**Render:**
```tsx
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

<div>
  <Label htmlFor="todo-reminder">Remind me</Label>
  <Select
    value={value?.toString() ?? ''}
    onValueChange={v => onChange(v ? Number(v) as ReminderMinutes : null)}
    disabled={disabled}
  >
    <SelectTrigger id="todo-reminder" data-testid="todo-reminder-select"
      aria-describedby={disabled ? 'reminder-disabled-hint' : undefined}>
      <SelectValue placeholder="No reminder" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="">No reminder</SelectItem>
      {REMINDER_OPTIONS.map(opt => (
        <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
      ))}
    </SelectContent>
  </Select>
  {disabled && (
    <span id="reminder-disabled-hint" className="text-xs text-muted-foreground">
      Set a due date to enable reminders
    </span>
  )}
</div>
```

**Behaviour in parent `TodoForm`:**
- When `dueDate` field is empty: `disabled={true}`, `value` forced to `null`
- When user clears `dueDate` while a reminder is set: auto-clear reminder to `null`

**Design tokens:** uses shadcn classes — `text-muted-foreground`, `bg-input`, `border-border`

**Accessibility:**
- `disabled` attribute prevents interaction
- `aria-describedby` explains disabled state
- `data-testid="todo-reminder-select"`

---

#### `NotificationToggle`

**File:** `components/notifications/NotificationToggle.tsx`
**Purpose:** Manages browser Notification API permission. Rendered once at app level. Shows a persistent banner if permission is denied after being requested.

**Props:** none (manages its own state; reads/writes `Notification.permission`)

**Local state:**
```typescript
const [permission, setPermission] = useState<NotificationPermission>(
  typeof Notification !== 'undefined' ? Notification.permission : 'default'
)
```

**Render logic:**
```
if (permission === 'denied') → show <DeniedBanner>
if (permission === 'default') → render nothing (permission requested lazily on first reminder selection)
if (permission === 'granted') → render nothing (notifications active)
if (typeof Notification === 'undefined') → render nothing (SSR / no support)
```

**`DeniedBanner`:**
```tsx
<div role="alert" data-testid="notification-denied-banner"
  className="bg-warning/15 text-warning-foreground p-3 rounded-md text-sm">
  Notifications are blocked. Enable them in your browser settings to receive reminders.
</div>
```

**Exported helper function (used by `useNotifications` hook):**
```typescript
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  const result = await Notification.requestPermission()
  return result
}
```

**Design tokens:** uses shadcn semantic extensions — `bg-warning/15`, `text-warning-foreground`

**Accessibility:**
- Denied banner has `role="alert"`
- `data-testid="notification-denied-banner"`

---

#### `ReminderBadge`

**File:** `components/todos/ReminderBadge.tsx`
**Purpose:** Small badge in `TodoBadges` showing 🔔 when a reminder is set.

**Props:**
```typescript
interface ReminderBadgeProps {
  reminderMinutes: ReminderMinutes
}
```

**Render:**
```tsx
import { Badge } from '@/components/ui/badge'

const label = REMINDER_OPTIONS.find(o => o.value === reminderMinutes)?.label ?? 'Reminder set'
return (
  <Badge
    data-testid="reminder-badge"
    variant="outline"
    className="gap-1 text-xs font-medium bg-reminder/15 text-reminder-foreground border-reminder/30"
    aria-label={label}
    title={label}
  >
    <span aria-hidden="true">🔔</span>
  </Badge>
)
```

**Custom CSS variables to add to `app/globals.css`:**
```css
:root {
  --reminder:             270 100% 40%;   /* purple-700 */
  --reminder-foreground:  270 100% 98%;
}
.dark {
  --reminder:             270 91% 65%;    /* purple-400 */
  --reminder-foreground:  270 100% 10%;
}
```

**Accessibility:**
- Emoji is `aria-hidden="true"`
- `aria-label` + `title` provide the reminder time text
- `data-testid="reminder-badge"`

---

#### `TodoBadges` (extended — PRP-04 update)

```tsx
// components/todos/TodoBadges.tsx
import { PriorityBadge }   from './PriorityBadge'
import { RecurrenceBadge } from './RecurrenceBadge'
import { ReminderBadge }   from './ReminderBadge'

export function TodoBadges({ todo }: TodoBadgesProps) {
  return (
    <div className="flex gap-1 items-center flex-wrap" data-testid={`todo-badges-${todo.id}`}>
      <PriorityBadge priority={todo.priority} />
      {todo.is_recurring && todo.recurrence_pattern && (
        <RecurrenceBadge pattern={todo.recurrence_pattern} />
      )}
      {todo.reminder_minutes != null && (
        <ReminderBadge reminderMinutes={todo.reminder_minutes} />
      )}
    </div>
  )
}
```

---

#### `TodoForm` (extended — PRP-04 update)

**New local state:**
```typescript
const [reminderMinutes, setReminderMinutes] = useState<ReminderMinutes | null>(
  initialValues?.reminder_minutes ?? null
)
```

**Render addition (after due date field, before recurrence):**
```tsx
<ReminderSelect
  value={reminderMinutes}
  onChange={setReminderMinutes}
  disabled={!dueDate}
/>
```

**Auto-clear reminder when due date is cleared:**
```typescript
function handleDueDateChange(value: string) {
  setDueDate(value)
  if (!value) {
    setReminderMinutes(null)
    // Also uncheck recurring (PRP-03 logic)
    setIsRecurring(false)
  }
}
```

**On submit payload:**
```typescript
const payload: CreateTodoInput = {
  ...previousFields,
  reminder_minutes: dueDate ? reminderMinutes : null,
}
```

---

## 5. TanStack Query Hooks

### `useNotifications`

**File:** `lib/hooks/useNotifications.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { checkNotifications } from '@/lib/api/notifications'
import { updateTodo } from '@/lib/api/todos'
import { requestNotificationPermission } from '@/components/notifications/NotificationToggle'
import { toSGDisplay } from '@/lib/timezone'
import { todoKeys } from './useTodos'
import type { PendingReminder, NotificationPermission } from '@/lib/types/notification'

const POLL_INTERVAL_MS = 30_000   // 30 seconds

export function useNotifications() {
  const qc = useQueryClient()

  // Polling query — enabled only if user has granted permission
  const { data, isError } = useQuery({
    queryKey: ['notifications', 'pending'],
    queryFn:  checkNotifications,             // GET /api/notifications/check
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,       // pause when tab is hidden
    staleTime: 0,                             // always treat as stale (we want fresh data)
    gcTime: 10_000,
    select: (d) => d.data.pending,
  })

  // Fire notifications and stamp sent time
  const { mutate: markSent } = useMutation({
    mutationFn: (id: number) =>
      updateTodo(id, { last_notification_sent: new Date().toISOString() }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'pending'] })
      qc.invalidateQueries({ queryKey: todoKeys.lists() })
    },
  })

  // Effect: fire a notification for each pending reminder
  // (Called from a useEffect in the consuming component)
  async function fireNotifications(pending: PendingReminder[]) {
    for (const todo of pending) {
      try {
        const n = new Notification(todo.title, {
          body: `Due: ${toSGDisplay(todo.due_date)}`,
          icon: '/icon-192.png',
          tag:  `todo-${todo.id}`,      // deduplication: same tag = replace existing
        })
        n.onclick = () => {
          window.focus()
          n.close()
        }
        markSent(todo.id)
      } catch (err) {
        // Notification API may throw if permission revoked mid-session
        console.warn('Failed to show notification for todo', todo.id, err)
      }
    }
  }

  return { pending: data ?? [], isError, fireNotifications }
}
```

**Integration with `NotificationToggle`:**

The `NotificationToggle` component is mounted in the app shell. It uses a `useEffect` to watch the `pending` array and call `fireNotifications` when items arrive:

```typescript
// components/notifications/NotificationToggle.tsx — polling orchestration
function NotificationPoller() {
  const { pending, fireNotifications } = useNotifications()

  useEffect(() => {
    if (pending.length > 0 && Notification.permission === 'granted') {
      fireNotifications(pending)
    }
  }, [pending])   // runs when pending array changes

  return null     // no visible UI — just background polling
}
```

**Query key:** `['notifications', 'pending']`
**Stale time:** 0 (always refetch on every interval)
**Cache time:** 10 seconds (short; data is time-sensitive)
**Refetch interval:** 30 000 ms
**Background refetch:** disabled (not needed when tab is hidden)
**Optimistic updates:** none needed; `markSent` triggers re-fetch via `onSettled`

---

## 6. State Management

| State | Type | Location | Notes |
|-------|------|----------|-------|
| `reminderMinutes` (form) | Local UI | `TodoForm` | Controlled select |
| Notification permission | Browser API | `Notification.permission` | Read-only from JS |
| Pending reminders | Server state | TanStack Query `['notifications', 'pending']` | Polled every 30s |
| Last notification sent | Server state | `todos.last_notification_sent` | Stamped via `PUT /api/todos/[id]` |

No new contexts. No URL state.

**Permission request lifecycle:**
1. User selects any reminder in `ReminderSelect`
2. `onChange` handler checks `Notification.permission`
3. If `'default'`: call `requestNotificationPermission()` → browser prompt
4. If result is `'denied'`: set reminder value back to `null`, show inline warning
5. If result is `'granted'`: proceed normally

---

## 7. Test Specifications

### 7.1 E2E Tests (Playwright)

**File:** `e2e/reminders.spec.ts`

#### Test: Reminder select disabled without due date

```
Steps:
1. Navigate to /
2. Locate [data-testid="todo-reminder-select"]
Assertions:
- select has attribute disabled
- [id="reminder-disabled-hint"] is visible with hint text
```

#### Test: Reminder enabled when due date is set

```
Steps:
1. Navigate to /
2. Fill [data-testid="todo-due-date-input"] with a future date
Assertions:
- [data-testid="todo-reminder-select"] does NOT have disabled attribute
```

#### Test: Set reminder, verify badge

```
Steps:
1. Navigate to /
2. Fill title "Dentist appointment"
3. Fill due date (tomorrow)
4. Select "1 hour before" in [data-testid="todo-reminder-select"]
   (use page.grantPermissions(['notifications']) in beforeAll)
5. Click [data-testid="todo-submit-btn"]
Assertions:
- New todo item in pending section
- [data-testid="reminder-badge"] is visible on that todo item
```

#### Test: Reminder cleared when due date removed in edit

```
Steps:
1. Via API: create todo with due_date and reminder_minutes=60
2. Navigate to /
3. Click [data-testid="todo-edit-btn-{id}"]
4. Clear the due date field in the modal
5. Save
Assertions:
- [data-testid="reminder-badge"] is NOT present on the updated todo
- Via API: todo.reminder_minutes is null
```

#### Test: Notification fires (requires permission grant)

```
// Note: Playwright can intercept notifications via page.waitForEvent('notification') in Chrome
// or via page.grantPermissions(['notifications'])

Setup:
- page.context().grantPermissions(['notifications'])
- Via API: create todo with due_date = NOW + 2 minutes, reminder_minutes = 2 (use test-only value? — see note)
  [Note: 2 minutes is not in REMINDER_OPTIONS for production; use 15-minute option with due_date = NOW + 14min]
  [Alternatively: inject a test todo directly into DB with due_date = NOW + 10s, reminder_minutes = 15]

Steps:
1. Navigate to /
2. Wait 35 seconds (allow polling + clock to advance) — OR mock the polling endpoint
3. Page receives a notification

Assertions:
- Notification title matches the todo title
- Notification body contains "Due:"
```

> For speed, prefer **mocking** `GET /api/notifications/check` to return a pending item immediately, then verify the `Notification` constructor was called with correct args.

#### Test: Denied banner shown when permission denied

```
Setup:
- page.context().clearPermissions()   // or deny via DevTools protocol

Steps:
1. Navigate to /
2. Fill title and due date
3. Select a reminder option
4. Deny notification permission in browser prompt (via Playwright page.on('dialog'))
Assertions:
- Reminder select is reset to empty (no reminder)
- [data-testid="notification-denied-banner"] is visible
```

### 7.2 Unit Tests

**File:** `lib/hooks/useNotifications.test.ts`

| Scenario | Setup | Assertion |
|----------|-------|-----------|
| Returns empty array when no pending | mock API returns `{ data: { pending: [] } }` | `pending` is `[]` |
| Returns pending todos | mock returns 2 items | `pending.length === 2` |
| `fireNotifications` calls Notification constructor | mock `window.Notification`, call `fireNotifications([item])` | `Notification` called with correct title and body |
| `fireNotifications` calls `markSent` | spy on `updateTodo` | called with `{ last_notification_sent: <iso string> }` |
| `fireNotifications` handles Notification error | make Notification constructor throw | does not rethrow; `console.warn` called |

**File:** `components/todos/ReminderSelect.test.tsx`

| Scenario | Setup | Assertion |
|----------|-------|-----------|
| Disabled when no due date | `disabled={true}` | select has `disabled` attribute |
| Shows all 7 options | `disabled={false}` | 8 options total (including "No reminder") |
| Calls onChange with correct value | select "1 hour before" | `onChange(60)` called |
| Calls onChange with null for "No reminder" | select empty option | `onChange(null)` called |

**File:** `components/todos/ReminderBadge.test.tsx`

| Scenario | Setup | Assertion |
|----------|-------|-----------|
| Renders bell emoji (aria-hidden) | `reminderMinutes={60}` | span with `aria-hidden="true"` containing 🔔 |
| aria-label is human-readable | `reminderMinutes={60}` | `aria-label="1 hour before"` |
| Renders for 1-week | `reminderMinutes={10080}` | `aria-label="1 week before"` |

**File:** `lib/db/notifications.test.ts`

| Function | Input | Expected |
|----------|-------|----------|
| `getPendingReminders(userId)` | todo with past reminder time, null sent | Returns that todo |
| `getPendingReminders(userId)` | todo with future reminder time | Does NOT return it |
| `getPendingReminders(userId)` | completed todo with past reminder | Does NOT return it |
| `getPendingReminders(userId)` | todo with reminder sent already | Does NOT return it |
| `getPendingReminders(userId)` | todo with no `due_date` | Does NOT return it |

### 7.3 Integration Tests

**File:** `app/api/notifications/check/route.test.ts`

```
GET /api/notifications/check
- unauthenticated → 401
- authenticated, no due reminders → 200 { data: { pending: [] } }
- authenticated, reminder threshold crossed → 200 { data: { pending: [{ id, title, due_date, reminder_minutes }] } }
- completed todo with crossed threshold → NOT in pending array
- todo whose last_notification_sent is set → NOT in pending array

PUT /api/todos/[id] (reminder validation)
- reminder_minutes = 999 (invalid) → 400, field: 'reminder_minutes'
- reminder_minutes = 60 with no due_date → 400, field: 'due_date'
- due_date = null on todo with reminder_minutes set → clears reminder_minutes to null
- valid reminder_minutes with valid due_date → 200
```

---

## 8. Acceptance Criteria

1. The `ReminderSelect` shows exactly 7 options plus "No reminder".
2. `ReminderSelect` is disabled and shows a hint when the parent form has no due date set.
3. Selecting a reminder option when `Notification.permission === 'default'` triggers `Notification.requestPermission()`.
4. If permission is denied, `ReminderSelect` resets to "No reminder" and `NotificationToggle` shows the denied banner.
5. A `ReminderBadge` (🔔) appears on any todo with `reminder_minutes !== null`.
6. The polling interval is 30 seconds (configured via `refetchInterval`).
7. Polling does NOT happen when the browser tab is hidden (`refetchIntervalInBackground: false`).
8. When `GET /api/notifications/check` returns pending reminders, a `Notification` is created for each with the correct `title` and `body`.
9. Each notification uses `tag: "todo-{id}"` to prevent duplicate native notifications.
10. After firing, the client calls `PUT /api/todos/{id}` to stamp `last_notification_sent`.
11. The server does NOT return a todo in pending reminders once `last_notification_sent` is set.
12. Completed todos are never returned by `GET /api/notifications/check`.
13. Removing the due date from a todo (create or edit) automatically clears `reminder_minutes` to `null`.
14. `PUT /api/todos/[id]` with an invalid `reminder_minutes` value returns `400`.
15. `PUT /api/todos/[id]` with `due_date: null` on a todo that has `reminder_minutes` clears the reminder.
16. If `Notification` constructor throws (permission revoked), the error is caught and logged — the app does not crash.
17. All time comparisons in the server query use UTC (SQLite `strftime('%s', 'now')` is UTC).

---

## 9. Integration Points

### 9.1 What This Feature Consumes

| Dependency | Usage |
|------------|-------|
| PRP-01: `todos` table | Adds `reminder_minutes`, `last_notification_sent` columns |
| PRP-01: `PUT /api/todos/[id]` | Used to stamp `last_notification_sent` |
| PRP-01: `UpdateTodoInput` type | Adds `reminder_minutes`, `last_notification_sent` fields |
| PRP-01: `TodoForm` component | Adds `ReminderSelect` field |
| PRP-01: `TodoBadges` component | Adds `ReminderBadge` |
| `lib/timezone.ts#toSGDisplay` | Used in notification body text |
| Browser Notification API | Native notifications |

### 9.2 What This Feature Exposes

| Export | Consumers |
|--------|-----------|
| `useNotifications` hook | App shell / `NotificationToggle` |
| `REMINDER_OPTIONS` constant | Any UI that needs to display reminder time labels |
| `ReminderBadge` component | Calendar view, template feature |
| `requestNotificationPermission` helper | Any future permission-requiring feature |
| `GET /api/notifications/check` | Potential future native push upgrade |
| Reminder design tokens | Other badge-style components |

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| `typeof Notification === 'undefined'` (SSR / Firefox nightly) | Guard in `fireNotifications` and `requestNotificationPermission`; return early |
| `Notification.permission === 'denied'` on mount | `NotificationToggle` immediately shows the denied banner |
| Tab is hidden when reminder fires | `refetchIntervalInBackground: false` means polling pauses; fires when tab regains focus (TanStack Query auto-refetches on focus) |
| Two tabs open simultaneously | Both tabs poll; both call `PUT /api/todos/{id}` — second one is a no-op (sets the same timestamp); `tag` on Notification deduplicates the OS-level popup |
| User completes todo between poll intervals | Next poll will NOT return it (server checks `completed = 0`) |
| Reminder set to 1 week, todo due in 3 days | Reminder never fires (threshold not crossed); user set an impossible reminder. No error — the reminder just never triggers. Client-side UX warning could be added (out of scope for PRP-04) |
| `last_notification_sent` needs to be reset | Not exposed in PRP-04 UI; if reminder is changed in edit, `last_notification_sent` is reset to `null` server-side so notifications fire again |
| `updateTodo` (markSent) fails on network error | No retry; next poll returns same item again; `Notification` may fire twice (idempotent from OS perspective due to `tag`) |
| Permission request returns `'default'` (dismissed without choosing) | Treat as `'denied'`; show banner |
| SSR components rendering `NotificationToggle` | Guard with `typeof window !== 'undefined'` before accessing `Notification` |
| Reminder fires while user is editing the todo | No special handling; the notification still fires; user sees both native notification and edit modal |
| `reminder_minutes` not in `VALID_REMINDER_MINUTES` via direct API call | Server rejects with `400`; DB stores arbitrary integers but API enforces the allowed set |

---

## 11. Out of Scope

- Push notifications (Service Worker / Web Push API) — requires VAPID keys and service worker registration
- Notification history / log of past alerts
- Notification sound / vibration customisation
- Email or SMS reminders
- Snooze functionality ("remind me again in 15 minutes")
- Per-user notification preferences (do-not-disturb hours)
- Multiple reminders per todo (only one reminder per todo in PRP-04)
- Notification for overdue todos that have no explicit reminder set
- Background sync when app is closed (Service Worker required)
- Custom reminder intervals beyond the 7 predefined options

---

## 12. Singapore Timezone Considerations

1. **Server-side comparison is in UTC.** The SQLite query uses `strftime('%s', 'now')` which always returns UTC epoch seconds. `due_date` is also stored as UTC. The arithmetic `strftime('%s', due_date) - (reminder_minutes * 60)` is pure UTC epoch math — this is correct and timezone-independent.

2. **Notification body text is in SGT.** `toSGDisplay(todo.due_date)` converts the UTC `due_date` to a human-readable Singapore time string (e.g., `"Apr 10, 2026 10:00"`). This is what appears in the notification body.

3. **No DST complications.** Singapore is fixed UTC+8 with no daylight saving. A reminder set for "1 day before" a due date will fire exactly 86,400 seconds before the due time — no edge cases around clock changes.

4. **"Remind me 1 day before" at midnight.** If a user sets a todo due at 00:00 SGT (16:00 UTC previous day) with a 1-day reminder, the reminder fires at 00:00 SGT the day before (also 16:00 UTC two days prior). The 30-second polling window means it fires within 30 seconds of that exact moment — negligible jitter for a daily reminder.

5. **Testing:** Use `vi.setSystemTime()` / `jest.useFakeTimers()` and mock `checkNotifications` to return a pre-constructed `PendingReminder`. Never rely on real clock for unit/integration tests. For E2E tests, use Playwright's clock API (`page.clock.setFixedTime(...)`) to control `Date.now()` in the browser context.
