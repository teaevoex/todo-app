# PRP 04: Reminders & Notifications

## Feature Overview

Implement a browser notification system that alerts users before their todos are due. Users can configure reminder timing from 15 minutes to 1 week before a due date. The system uses a polling mechanism to check for pending reminders and fires browser notifications with duplicate prevention via `last_notification_sent` tracking. All timing calculations use **Singapore timezone** (`Asia/Singapore`). This feature builds on **PRP 01** (CRUD) and works alongside **PRP 03** (Recurring — reminder inheritance).

---

## User Stories

### As a user, I want to:

1. **Enable browser notifications** so I can receive reminder alerts
2. **Set a reminder timing** on a todo with a due date so I get notified before the deadline
3. **Choose from predefined timing options** (15m, 30m, 1h, 2h, 1d, 2d, 1w) so I can pick the right advance notice
4. **See a visual indicator** (🔔 badge) on todos with reminders so I know which tasks will alert me
5. **Receive a browser notification** at the correct time so I don't miss deadlines
6. **Only receive each reminder once** so I'm not spammed with duplicate notifications
7. **Have reminders disabled** when no due date is set since there's nothing to remind about

---

## User Flow

### Enabling Notifications

```
1. User sees an orange "🔔 Enable Notifications" button (top-right area)
2. User clicks the button
3. Browser prompts for notification permission
4. If granted:
   a. Button changes to green "🔔 Notifications On" badge
   b. Polling begins — system checks every 30-60 seconds for due reminders
5. If denied:
   a. Button remains orange
   b. User cannot receive notifications until permission is granted via browser settings
```

### Setting a Reminder

```
1. User creates or edits a todo
2. User sets a due date (REQUIRED for reminders)
3. Reminder dropdown becomes enabled (disabled without due date)
4. User selects a timing option:
   - 15 minutes before
   - 30 minutes before
   - 1 hour before
   - 2 hours before
   - 1 day before
   - 2 days before
   - 1 week before
5. User saves the todo
6. 🔔 badge appears on the todo with abbreviated timing (e.g., "🔔 1h")
```

### Receiving a Notification

```
1. Polling endpoint checks for todos where:
   a. reminder_minutes is set
   b. due_date minus reminder_minutes <= now (Singapore time)
   c. last_notification_sent is null (not already notified)
   d. todo is not completed
2. For each matching todo, the system:
   a. Fires a browser notification with the todo title
   b. Updates last_notification_sent to current timestamp
3. User sees browser notification (even if tab is in background)
4. Notification persists until user dismisses it
```

### Removing a Reminder

```
1. User edits a todo with a reminder
2. User selects "None" from the reminder dropdown
3. User clicks "Update"
4. 🔔 badge disappears from the todo
5. No future notification will fire for this todo
```

---

## Technical Requirements

### Database Schema

Reminder fields in the `todos` table (defined in PRP 01):

```sql
-- Reminder columns in todos table
reminder_minutes INTEGER,           -- Minutes before due date to send reminder (NULL = no reminder)
last_notification_sent TEXT          -- ISO timestamp of last notification (NULL = not yet sent)
```

**`reminder_minutes` Values:**

| User Selection | Stored Value |
|---------------|-------------|
| None | `NULL` |
| 15 minutes before | `15` |
| 30 minutes before | `30` |
| 1 hour before | `60` |
| 2 hours before | `120` |
| 1 day before | `1440` |
| 2 days before | `2880` |
| 1 week before | `10080` |

No additional tables needed.

### TypeScript Types

```typescript
// lib/db.ts — within the Todo interface

export interface Todo {
  // ... other fields from PRP 01
  reminder_minutes: number | null
  last_notification_sent: string | null
}

// Reminder timing options for UI dropdowns
export const REMINDER_OPTIONS = [
  { value: '', label: 'None' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '1440', label: '1 day before' },
  { value: '2880', label: '2 days before' },
  { value: '10080', label: '1 week before' },
] as const
```

### Badge Abbreviation Map

```typescript
const REMINDER_LABELS: Record<number, string> = {
  15: '15m',
  30: '30m',
  60: '1h',
  120: '2h',
  1440: '1d',
  2880: '2d',
  10080: '1w',
}
```

---

### Notification Check API

#### `GET /api/notifications/check` — Find todos needing notification

```typescript
// app/api/notifications/check/route.ts

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getSingaporeNow } from '@/lib/timezone'
import db from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const now = getSingaporeNow()

  // Find todos where:
  // 1. Has a reminder set (reminder_minutes IS NOT NULL)
  // 2. Has a due date
  // 3. Not completed
  // 4. Reminder time has arrived (due_date - reminder_minutes <= now)
  // 5. Not already notified (last_notification_sent IS NULL)
  const todos = db.prepare(`
    SELECT * FROM todos
    WHERE user_id = ?
      AND reminder_minutes IS NOT NULL
      AND due_date IS NOT NULL
      AND completed = 0
      AND last_notification_sent IS NULL
      AND datetime(due_date, '-' || reminder_minutes || ' minutes') <= datetime(?)
  `).all(session.userId, now.toISOString())

  return NextResponse.json(todos)
}
```

**Query Logic:**

```
reminder_time = due_date - reminder_minutes
if reminder_time <= now AND last_notification_sent IS NULL:
  → this todo needs a notification
```

**Example:**
- Todo due at `2025-11-10 14:00` with `reminder_minutes: 60`
- Reminder time = `2025-11-10 13:00`
- If current Singapore time is `13:05`, the notification fires
- `last_notification_sent` is set to `2025-11-10 13:05` to prevent duplicates

### Marking Notification as Sent

After the client fires the browser notification, it calls back to mark the todo:

```typescript
// Option A: Inline in the check endpoint (update in the same request)
// After selecting todos needing notification, update them:

for (const todo of todos) {
  db.prepare(
    'UPDATE todos SET last_notification_sent = ? WHERE id = ?'
  ).run(now.toISOString(), todo.id)
}

// Option B: Separate endpoint
// POST /api/notifications/mark-sent
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { todoIds } = await request.json()

  for (const id of todoIds) {
    db.prepare(
      'UPDATE todos SET last_notification_sent = ? WHERE id = ? AND user_id = ?'
    ).run(getSingaporeNow().toISOString(), id, session.userId)
  }

  return NextResponse.json({ success: true })
}
```

---

### Client-Side Notification Hook

```typescript
// lib/hooks/useNotifications.ts

import { useEffect, useCallback, useState, useRef } from 'react'

const POLL_INTERVAL = 30000 // 30 seconds

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return

    const result = await Notification.requestPermission()
    setPermission(result)
  }, [])

  const checkAndNotify = useCallback(async () => {
    if (permission !== 'granted') return

    try {
      const res = await fetch('/api/notifications/check')
      if (!res.ok) return

      const todos = await res.json()

      for (const todo of todos) {
        new Notification(`Todo Reminder: ${todo.title}`, {
          body: `Due: ${todo.due_date}`,
          icon: '/favicon.ico',
          tag: `todo-${todo.id}`, // Prevents duplicate OS notifications
        })
      }

      // Mark notifications as sent
      if (todos.length > 0) {
        await fetch('/api/notifications/mark-sent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            todoIds: todos.map((t: { id: number }) => t.id),
          }),
        })
      }
    } catch (error) {
      console.error('Notification check failed:', error)
    }
  }, [permission])

  // Start/stop polling based on permission
  useEffect(() => {
    if (permission === 'granted') {
      // Check immediately on mount
      checkAndNotify()
      // Then poll at interval
      intervalRef.current = setInterval(checkAndNotify, POLL_INTERVAL)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [permission, checkAndNotify])

  return {
    permission,
    requestPermission,
    isEnabled: permission === 'granted',
  }
}
```

**Hook API:**

| Property | Type | Description |
|----------|------|-------------|
| `permission` | `NotificationPermission` | `'default'`, `'granted'`, or `'denied'` |
| `requestPermission` | `() => Promise<void>` | Triggers browser permission prompt |
| `isEnabled` | `boolean` | `true` when notifications are granted |

---

### Validation Rules

```typescript
const VALID_REMINDER_MINUTES = [15, 30, 60, 120, 1440, 2880, 10080]

// In POST /api/todos and PUT /api/todos/[id]

// 1. Reminder requires a due date
if (body.reminder_minutes && !body.due_date) {
  return NextResponse.json(
    { error: 'Reminder requires a due date' },
    { status: 400 }
  )
}

// 2. Validate reminder_minutes value
if (body.reminder_minutes && !VALID_REMINDER_MINUTES.includes(body.reminder_minutes)) {
  return NextResponse.json(
    { error: 'Invalid reminder timing' },
    { status: 400 }
  )
}

// 3. Clearing reminder
if (body.reminder_minutes === null || body.reminder_minutes === '') {
  // Set to NULL in database, also reset last_notification_sent
}
```

---

## UI Components

### Enable Notifications Button

```tsx
// In app/page.tsx

const { permission, requestPermission, isEnabled } = useNotifications()

{/* Notification toggle button */}
{isEnabled ? (
  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full
                    bg-green-100 text-green-800 text-sm font-medium
                    dark:bg-green-900/30 dark:text-green-300">
    🔔 Notifications On
  </span>
) : (
  <button
    onClick={requestPermission}
    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full
               bg-orange-100 text-orange-800 text-sm font-medium
               hover:bg-orange-200 transition-colors
               dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
  >
    🔔 Enable Notifications
  </button>
)}
```

**Button States:**

| State | Appearance | Behavior |
|-------|-----------|----------|
| Not enabled | Orange "🔔 Enable Notifications" | Click → browser permission prompt |
| Enabled | Green "🔔 Notifications On" badge | Static indicator, polling active |
| Denied | Orange button (unchanged) | Click → prompt again (browser may block) |

### Reminder Dropdown (Create Form)

```tsx
<select
  value={reminderMinutes ?? ''}
  onChange={(e) => setReminderMinutes(e.target.value ? Number(e.target.value) : null)}
  disabled={!newDueDate} // Disabled when no due date is set
  className="border rounded-lg px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed
             dark:bg-gray-700 dark:border-gray-600 dark:text-white"
>
  <option value="">None</option>
  <option value="15">15 minutes before</option>
  <option value="30">30 minutes before</option>
  <option value="60">1 hour before</option>
  <option value="120">2 hours before</option>
  <option value="1440">1 day before</option>
  <option value="2880">2 days before</option>
  <option value="10080">1 week before</option>
</select>
```

**Dropdown Behavior:**
- **Disabled** when no due date is set (greyed out, `cursor-not-allowed`)
- **Enabled** when a due date is present
- **Resets to "None"** if the user removes the due date after setting a reminder

### Reminder Dropdown (Edit Modal)

```tsx
<label className="block text-sm font-medium mb-1 dark:text-gray-300">Reminder</label>
<select
  value={editReminderMinutes ?? ''}
  onChange={(e) => setEditReminderMinutes(e.target.value ? Number(e.target.value) : null)}
  disabled={!editDueDate}
  className="w-full border rounded-lg px-3 py-2 disabled:opacity-50
             dark:bg-gray-700 dark:border-gray-600 dark:text-white"
>
  <option value="">None</option>
  <option value="15">15 minutes before</option>
  <option value="30">30 minutes before</option>
  <option value="60">1 hour before</option>
  <option value="120">2 hours before</option>
  <option value="1440">1 day before</option>
  <option value="2880">2 days before</option>
  <option value="10080">1 week before</option>
</select>
```

### Reminder Badge

Displayed inline on todos that have a reminder set:

```tsx
function ReminderBadge({ minutes }: { minutes: number }) {
  const LABELS: Record<number, string> = {
    15: '15m',
    30: '30m',
    60: '1h',
    120: '2h',
    1440: '1d',
    2880: '2d',
    10080: '1w',
  }

  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full border
                      bg-amber-100 text-amber-800 border-amber-200
                      dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
      🔔 {LABELS[minutes] ?? `${minutes}m`}
    </span>
  )
}

// Usage in todo item
{todo.reminder_minutes && (
  <ReminderBadge minutes={todo.reminder_minutes} />
)}
```

**Badge Examples:**

| `reminder_minutes` | Badge Text | Color |
|--------------------|-----------|-------|
| 15 | 🔔 15m | Amber |
| 30 | 🔔 30m | Amber |
| 60 | 🔔 1h | Amber |
| 120 | 🔔 2h | Amber |
| 1440 | 🔔 1d | Amber |
| 2880 | 🔔 2d | Amber |
| 10080 | 🔔 1w | Amber |

### Badge Placement

```
☐  Pay rent  [High]  [🔄 monthly]  [🔔 1d]  [Finance]
                                     ^^^^^^^
                                     Reminder badge after recurrence badge
```

---

## Polling Architecture

### Flow Diagram

```
Client (useNotifications hook)
  │
  ├─ Every 30 seconds ───► GET /api/notifications/check
  │                              │
  │                              ├─ Query: todos WHERE reminder_time <= now
  │                              │          AND last_notification_sent IS NULL
  │                              │          AND completed = 0
  │                              │
  │                              └─ Returns: Array of todos needing notification
  │
  ├─ For each todo ───► new Notification(title, { body, icon, tag })
  │
  └─ POST /api/notifications/mark-sent ───► Updates last_notification_sent
                                              for each notified todo
```

### Polling Details

| Setting | Value | Notes |
|---------|-------|-------|
| Poll interval | 30 seconds | Balance of responsiveness vs. server load |
| Initial check | On mount | Catch reminders missed while page was closed |
| Cleanup | On unmount | `clearInterval` in useEffect cleanup |
| Error handling | Catch + ignore | Failed polls silently retry on next interval |
| Tab visibility | Works in background | Browser notifications fire even if tab is not focused |

### Duplicate Prevention

Three layers prevent duplicate notifications:

1. **Database**: `last_notification_sent IS NULL` in SQL query — once set, the todo won't appear in future checks
2. **Notification tag**: `tag: 'todo-${todo.id}'` — browser replaces notifications with the same tag instead of stacking
3. **Immediate mark**: After firing notifications, immediately POST to `/api/notifications/mark-sent`

---

## Reminder Timing Calculations

### How Reminder Time is Determined

```
reminder_time = due_date - reminder_minutes (in minutes)
```

**Examples (Singapore Time):**

| Due Date | Reminder | Reminder Time | Notification Fires At |
|----------|----------|---------------|----------------------|
| Nov 10 14:00 | 15m | Nov 10 13:45 | 13:45–14:15 (next poll after 13:45) |
| Nov 10 14:00 | 1h | Nov 10 13:00 | 13:00–13:30 (next poll after 13:00) |
| Nov 10 14:00 | 1d | Nov 9 14:00 | Nov 9 14:00–14:30 |
| Nov 10 14:00 | 1w | Nov 3 14:00 | Nov 3 14:00–14:30 |

**Note:** Actual notification time depends on when the polling interval coincides with the reminder time. With 30-second polling, the delay is at most 30 seconds.

### Singapore Timezone Calculation

```typescript
// In the SQL query, the comparison uses Singapore time
// getSingaporeNow() ensures the "now" comparison is in SGT

const now = getSingaporeNow()

// SQL comparison:
// datetime(due_date, '-' || reminder_minutes || ' minutes') <= datetime(now)
```

---

## Recurring Todo Reminder Inheritance

When a recurring todo is completed and a new instance is created (see PRP 03):

```typescript
// In PUT /api/todos/[id] — when completing a recurring todo

const nextTodo = todoDB.create(session.userId, {
  title: existingTodo.title,
  due_date: nextDueDate,
  priority: existingTodo.priority,
  is_recurring: true,
  recurrence_pattern: existingTodo.recurrence_pattern,
  reminder_minutes: existingTodo.reminder_minutes ?? null,  // ← Inherited
  // last_notification_sent is NOT set (defaults to NULL)
  // so the new instance gets its own fresh reminder
})
```

**Key Points:**
- `reminder_minutes` is copied from the completed todo
- `last_notification_sent` starts as `NULL` for the new instance (so it will fire)
- The new reminder will fire based on the new `due_date`

---

## Edge Cases

### Permission & Browser Support

| Scenario | Expected Behavior |
|----------|-------------------|
| Browser doesn't support Notifications API | Button hidden or disabled gracefully |
| User denies notification permission | Button stays orange, polling does not start |
| User grants then revokes permission (via browser settings) | Next poll detects `permission !== 'granted'`, stops notifying |
| Multiple tabs open | Each tab polls independently — `last_notification_sent` prevents duplicates |
| Browser closed when reminder fires | Notification missed, no retry (stateless polling) |
| Tab in background | Browser notification still fires (background-capable) |

### Reminder + Due Date Interactions

| Scenario | Expected Behavior |
|----------|-------------------|
| Set reminder without due date | Dropdown disabled, cannot select a timing |
| Remove due date after setting reminder | Reminder cleared (set to NULL) |
| Change due date after setting reminder | Reminder timing recalculates from new due date |
| Due date in the past with reminder | Notification fires immediately on next poll (if not already sent) |
| Reminder time already passed when todo is created | Notification fires on next poll |

### Notification Lifecycle

| Scenario | Expected Behavior |
|----------|-------------------|
| Reminder fires, todo completed before user sees notification | Notification already sent, no duplicate |
| Reminder fires, todo deleted | Notification already sent; no cleanup needed |
| Reminder fires, due date changed | `last_notification_sent` already set, no new notification (reset by clearing reminder first) |
| Change reminder timing on a todo that was already notified | Must reset `last_notification_sent` to NULL for a new notification to fire |
| Complete todo before reminder time | Todo marked completed, excluded from check query (`completed = 0`) |

### Recurring + Reminders

| Scenario | Expected Behavior |
|----------|-------------------|
| Complete recurring todo with reminder | Next instance inherits `reminder_minutes`, gets `last_notification_sent: null` |
| Recurring instance reminder fires, then completed | Next instance created with fresh null state, will fire at new time |
| Edit reminder on recurring, complete it | Next instance inherits the updated reminder timing |
| Remove reminder from recurring, complete it | Next instance has `reminder_minutes: null`, no reminder |

### Data Integrity

| Scenario | Expected Behavior |
|----------|-------------------|
| `reminder_minutes` is `undefined` from database | Use `?? null` — never pass undefined |
| `last_notification_sent` is `undefined` | Use `?? null` |
| Invalid `reminder_minutes` value via API | Reject with 400 "Invalid reminder timing" |
| Negative `reminder_minutes` | Reject with 400 |
| Zero `reminder_minutes` | Reject with 400 (not in valid list) |

---

## Acceptance Criteria

### Notification Permission

- [ ] "🔔 Enable Notifications" button is visible when notifications are not enabled
- [ ] Clicking the button triggers the browser permission prompt
- [ ] Button changes to green "🔔 Notifications On" badge when permission is granted
- [ ] Button remains orange when permission is denied
- [ ] Polling starts automatically when permission is granted
- [ ] Polling stops when component unmounts (cleanup)

### Reminder Dropdown

- [ ] Reminder dropdown appears in both the create form and edit modal
- [ ] Dropdown shows 8 options: None + 7 timing options
- [ ] Dropdown is disabled when no due date is set
- [ ] Dropdown is enabled when a due date is present
- [ ] Removing the due date clears the reminder selection
- [ ] Selected timing is saved correctly to the API
- [ ] Edit modal pre-fills with the current reminder value

### Reminder Badge

- [ ] 🔔 badge appears on todos with `reminder_minutes` set
- [ ] Badge shows correct abbreviated label (15m, 30m, 1h, 2h, 1d, 2d, 1w)
- [ ] Badge is amber-colored in light mode
- [ ] Badge adapts for dark mode visibility
- [ ] Badge appears after the recurrence badge (if present)
- [ ] No badge when `reminder_minutes` is null

### Notification Delivery

- [ ] Browser notification fires when `due_date - reminder_minutes <= now` (Singapore time)
- [ ] Notification title includes the todo title
- [ ] Notification body includes the due date
- [ ] Each reminder fires only once (duplicate prevention via `last_notification_sent`)
- [ ] Notification fires even if tab is in background
- [ ] Polling runs every 30 seconds when enabled
- [ ] Immediate check on initial page load

### Notification Check API

- [ ] `GET /api/notifications/check` returns only todos needing notification
- [ ] Query filters: `reminder_minutes IS NOT NULL`, `completed = 0`, `last_notification_sent IS NULL`
- [ ] Query uses Singapore timezone for comparison
- [ ] Returns 401 for unauthenticated requests
- [ ] Returns only the current user's todos

### Mark Sent API

- [ ] `POST /api/notifications/mark-sent` updates `last_notification_sent` timestamp
- [ ] Only updates todos belonging to the authenticated user
- [ ] Accepts array of todo IDs
- [ ] Returns 401 for unauthenticated requests

### Recurring Todo Inheritance

- [ ] Next recurring instance inherits `reminder_minutes` from the completed instance
- [ ] Next instance has `last_notification_sent: null` (fresh state)
- [ ] Next instance's reminder fires based on its new due date

### Validation

- [ ] API rejects reminder without due date (400)
- [ ] API rejects invalid `reminder_minutes` values (400)
- [ ] NULL/empty reminder clears the field in the database
- [ ] `reminder_minutes` uses `?? null` for undefined handling

---

## Testing Requirements

### E2E Tests (Playwright)

```typescript
// tests/04-reminders.spec.ts

import { test, expect } from '@playwright/test'
import { TodoHelper } from './helpers'

test.describe('Reminders & Notifications', () => {

  test('should show reminder dropdown disabled without due date', async ({ page }) => {
    // Verify the reminder select is disabled when no due date is entered
    const reminderSelect = page.locator('select:has(option:text("15 minutes before"))')
    await expect(reminderSelect).toBeDisabled()
  })

  test('should enable reminder dropdown when due date is set', async ({ page }) => {
    // Set a due date
    await page.fill('input[type="datetime-local"]', '2026-12-15T14:00')

    // Verify reminder dropdown is now enabled
    const reminderSelect = page.locator('select:has(option:text("15 minutes before"))')
    await expect(reminderSelect).toBeEnabled()
  })

  test('should create todo with 1 hour reminder', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Reminder test', {
      dueDate: '2026-12-15T14:00',
      reminderMinutes: 60,
    })

    // Verify 🔔 1h badge is visible
    await expect(page.getByText('🔔 1h')).toBeVisible()
  })

  test('should create todo with 1 day reminder', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Day reminder', {
      dueDate: '2026-12-15T14:00',
      reminderMinutes: 1440,
    })

    await expect(page.getByText('🔔 1d')).toBeVisible()
  })

  test('should display all 7 reminder timing options', async ({ page }) => {
    // Set a due date to enable the dropdown
    await page.fill('input[type="datetime-local"]', '2026-12-15T14:00')

    const reminderSelect = page.locator('select:has(option:text("15 minutes before"))')
    const options = await reminderSelect.locator('option').allTextContents()

    expect(options).toContain('None')
    expect(options).toContain('15 minutes before')
    expect(options).toContain('30 minutes before')
    expect(options).toContain('1 hour before')
    expect(options).toContain('2 hours before')
    expect(options).toContain('1 day before')
    expect(options).toContain('2 days before')
    expect(options).toContain('1 week before')
  })

  test('should edit reminder timing', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Edit reminder', {
      dueDate: '2026-12-15T14:00',
      reminderMinutes: 60,
    })

    await expect(page.getByText('🔔 1h')).toBeVisible()

    // Edit and change to 1 day
    await page.click('button:has-text("Edit")')
    await page.selectOption('select:has(option:text("1 day before"))', '1440')
    await page.click('button:has-text("Update")')

    await expect(page.getByText('🔔 1d')).toBeVisible()
    await expect(page.getByText('🔔 1h')).not.toBeVisible()
  })

  test('should remove reminder', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Remove reminder', {
      dueDate: '2026-12-15T14:00',
      reminderMinutes: 60,
    })

    await expect(page.getByText('🔔 1h')).toBeVisible()

    // Edit and set to None
    await page.click('button:has-text("Edit")')
    await page.selectOption('select:has(option:text("None"))', '')
    await page.click('button:has-text("Update")')

    await expect(page.getByText('🔔 1h')).not.toBeVisible()
  })

  test('should clear reminder when due date is removed', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('Clear on date remove', {
      dueDate: '2026-12-15T14:00',
      reminderMinutes: 30,
    })

    // Edit and remove due date
    await page.click('button:has-text("Edit")')
    await page.fill('input[type="datetime-local"]', '')
    await page.click('button:has-text("Update")')

    // Reminder badge should be gone
    await expect(page.getByText('🔔 30m')).not.toBeVisible()
  })

  test('should not show reminder badge without reminder', async ({ page }) => {
    const helper = new TodoHelper(page)
    await helper.createTodo('No reminder', {
      dueDate: '2026-12-15T14:00',
    })

    // No 🔔 badge should be visible for this todo
    const todoBadges = page.locator('text=/🔔/')
    await expect(todoBadges).toHaveCount(0)
  })
})
```

### Notification Check API Tests

```typescript
// tests/api/notifications.test.ts

test('GET /api/notifications/check returns todos needing notification', async () => {
  // Setup: Create a todo with due date in the past and reminder set
  // (so reminder_time is in the past)

  const res = await fetch('/api/notifications/check')
  expect(res.status).toBe(200)

  const todos = await res.json()
  expect(Array.isArray(todos)).toBe(true)

  // Each todo should have reminder_minutes set and last_notification_sent = null
  for (const todo of todos) {
    expect(todo.reminder_minutes).not.toBeNull()
    expect(todo.last_notification_sent).toBeNull()
    expect(todo.completed).toBe(0)
  }
})

test('GET /api/notifications/check returns 401 without session', async () => {
  const res = await fetch('/api/notifications/check', {
    headers: {}, // No auth cookie
  })
  expect(res.status).toBe(401)
})

test('POST /api/notifications/mark-sent updates last_notification_sent', async () => {
  // Setup: Create a todo, get its ID
  const todo = await createTestTodo()

  const res = await fetch('/api/notifications/mark-sent', {
    method: 'POST',
    body: JSON.stringify({ todoIds: [todo.id] }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(200)

  // Verify the todo now has last_notification_sent set
  const updated = await fetchTodo(todo.id)
  expect(updated.last_notification_sent).not.toBeNull()
})

test('marked todo does not appear in subsequent check', async () => {
  const todo = await createTestTodoWithReminderInPast()

  // First check — should appear
  const check1 = await fetch('/api/notifications/check')
  const todos1 = await check1.json()
  expect(todos1.some((t: { id: number }) => t.id === todo.id)).toBe(true)

  // Mark as sent
  await fetch('/api/notifications/mark-sent', {
    method: 'POST',
    body: JSON.stringify({ todoIds: [todo.id] }),
    headers: { 'Content-Type': 'application/json' },
  })

  // Second check — should NOT appear
  const check2 = await fetch('/api/notifications/check')
  const todos2 = await check2.json()
  expect(todos2.some((t: { id: number }) => t.id === todo.id)).toBe(false)
})
```

### Manual Testing Checklist

Browser notifications cannot be fully automated in Playwright. Verify manually:

- [ ] Clicking "🔔 Enable Notifications" shows browser permission dialog
- [ ] Granting permission changes button to green "Notifications On"
- [ ] Creating a todo with a near-future due date and 15m reminder fires a notification
- [ ] Notification shows todo title and due date
- [ ] Notification only fires once (wait through multiple poll cycles)
- [ ] Notification fires when tab is in background
- [ ] Denying permission keeps button orange, no polling occurs

---

## Out of Scope

These are related features handled by other PRPs:

- Todo CRUD basics → **PRP 01**
- Priority system → **PRP 02**
- Recurring todo completion and reminder inheritance → **PRP 03**
- Subtask progress → **PRP 05**
- Tag system → **PRP 06**
- Template reminder presets → **PRP 07**
- Filtering by reminder status → **PRP 08**
- Exporting reminder data → **PRP 09**
- Calendar reminder indicators → **PRP 10**
- Push notification service (server-sent) → Future enhancement
- Mobile app notifications → Future enhancement
- Email/SMS reminders → Future enhancement

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Notification delivery accuracy | 100% — fires within 30s of reminder time |
| Duplicate prevention | 100% — each reminder fires exactly once |
| Polling reliability | 99.9% — graceful error handling on failed polls |
| Permission prompt UX | Single click to enable |
| Dropdown enable/disable correctness | 100% — always synced with due date presence |
| Badge display accuracy | 100% — correct abbreviation for all 7 options |
| Recurring inheritance | 100% — reminder_minutes copied, last_notification_sent reset |
| API validation | 100% — invalid inputs rejected with 400 |

---

## Implementation Notes

### Project-Specific Patterns

1. **Custom hook** (`lib/hooks/useNotifications.ts`) encapsulates all notification logic — permission, polling, and firing.
2. **Polling, not WebSockets** — the system polls every 30 seconds. Simpler architecture, no persistent connections.
3. **`last_notification_sent`** is the duplicate prevention mechanism — once set, the todo is excluded from future checks.
4. **`reminder_minutes ?? null`** — always use null coalescing. The field can be `undefined` from the database.
5. **Singapore timezone** — `getSingaporeNow()` must be used in the check API query, never `new Date()`.
6. **Mark-sent is a separate step** — the client fires the notification first, then calls mark-sent. If the mark-sent call fails, the next poll may re-fire (acceptable trade-off vs. missing notifications).
7. **`Notification` tag** — using `tag: 'todo-${todo.id}'` prevents the OS from stacking duplicate notifications for the same todo.

### File Locations

```
lib/hooks/useNotifications.ts          # Custom hook — permission, polling, notification firing
app/api/notifications/check/route.ts   # GET — find todos needing notification
app/api/notifications/mark-sent/route.ts  # POST — update last_notification_sent
app/page.tsx                           # UI: Enable button, reminder dropdown, 🔔 badge
lib/db.ts                              # Todo interface with reminder_minutes, last_notification_sent
lib/timezone.ts                        # getSingaporeNow() for timing comparisons
```

### Dependencies

No additional npm packages. Uses:
- **Web Notifications API** (browser built-in) — `Notification.requestPermission()`, `new Notification()`
- **`setInterval`/`clearInterval`** — for polling
- **React hooks** — `useState`, `useEffect`, `useCallback`, `useRef`
- **SQLite datetime functions** — `datetime()` with minute offsets in the check query
