# Todo App Core Features

This is the primary Todo App PRP. It consolidates the implementation brief that AI coding assistants should use with a snapshot of the app's current implementation state.

Use this file as the recommended top-level entrypoint. The split PRPs remain in `./reference/` and are referenced from here.

## Purpose

This PRP should work in two modes:

- planning and implementation guidance for building or extending the app
- implementation snapshot for understanding what the current codebase already does

It is aligned with:

- `../copilot-instructions.md`
- `../../USER_GUIDE.md`
- `../../EVALUATION.md`
- `./reference/README.md`

## Product Summary

Build and maintain a full-stack Todo App in Next.js 16 with:

- passwordless WebAuthn authentication
- Singapore timezone handling across all date and time logic
- SQLite persistence via `better-sqlite3`
- Playwright E2E testing

The app supports:

- todo CRUD
- priorities
- recurring todos
- reminders and browser notifications
- subtasks and progress
- tags
- templates
- search and advanced filtering
- export and import
- calendar view
- WebAuthn authentication

## Current Implementation Snapshot

### Stack and App Shape

- Framework: Next.js 16 App Router with React 19 and TypeScript
- Database: SQLite via `better-sqlite3`
- Auth: WebAuthn passkeys with signed JWT session cookie
- Testing: Playwright end-to-end coverage across 11 feature areas
- Timezone rule: Singapore timezone is the app-wide scheduling baseline
- Routing: protected dashboard at `/`, protected calendar at `/calendar`, public login at `/login`

### Current User Experience

Authentication:

- Users register and log in with WebAuthn from `/login`
- Successful auth creates a `todo-app-session` cookie valid for 7 days
- Route protection redirects unauthenticated users away from `/` and `/calendar`
- Visiting `/login` with an active session redirects back to `/`
- Users can explicitly log out from the dashboard

Dashboard:

- Todo creation with title, priority, due date/time, recurrence, reminder, and tag assignment
- Todo editing in a modal
- Completion toggle and deletion
- Automatic grouping into `Overdue`, `Active`, and `Completed`
- Search across todo titles, tag names, and subtask titles
- Filtering by priority, tag, completion state, and due date range
- Saved filter presets stored in browser `localStorage`
- Export and import actions
- Theme toggle
- Browser notification opt-in

Calendar:

- Month grid with previous, next, and today navigation
- Query-string month state such as `?month=2026-04`
- Todo counts per day based on `due_date`
- Holiday labels loaded from the holidays table
- Day modal showing todos scheduled on the selected date
- Theme toggle and navigation back to the dashboard

### Implemented Feature Areas

#### 1. Todo CRUD

- Create todos through `POST /api/todos`
- List current user todos through `GET /api/todos`
- Update a todo through `PUT /api/todos/[id]`
- Delete a todo through `DELETE /api/todos/[id]`
- Todos are returned with attached `tags` and `subtasks`

#### 2. Priority System

- Supported values: `high`, `medium`, `low`
- New todos default to `medium`
- Database ordering prioritizes higher priority first, then due dates, then newer creation dates
- Priority is visible in dashboard cards and template cards

#### 3. Recurring Todos

- Todos and templates can be marked recurring
- Supported recurrence patterns: `daily`, `weekly`, `monthly`, `yearly`
- Recurrence state is stored and displayed in the UI
- Current code stores recurrence metadata, but does not auto-generate the next occurrence on completion

#### 4. Reminders and Notifications

- Todos can store `reminder_minutes`
- Reminder choices in the UI range from 15 minutes to 1 week before due time
- Reminder selection is enabled only when a due date exists
- `GET /api/notifications/check` returns pending notifications for the signed-in user
- Browser notification permission can be enabled from the dashboard
- The app tracks `last_notification_sent` in the database

#### 5. Subtasks and Progress

- Subtasks are created through `POST /api/todos/[id]/subtasks`
- Individual subtasks are updated or deleted through `/api/subtasks/[id]`
- Subtasks are ordered by `position`
- Todo cards show a progress bar and completed/total counts when subtasks exist

#### 6. Tags

- Tags are user-scoped and unique per user by name
- Create and list tags through `POST/GET /api/tags`
- Update and delete tags through `/api/tags/[id]`
- Assign tags to a todo through `POST /api/todos/[id]/tags`
- Tag badges on todo cards can be clicked to apply a tag filter

#### 7. Templates

- Templates are user-scoped and stored in SQLite
- Create and list templates through `POST/GET /api/templates`
- Update and delete templates through `/api/templates/[id]`
- Apply a template through `POST /api/templates/[id]/use`
- Templates support name, description, category, title template, priority, recurrence, reminders, due date offsets, and serialized subtasks JSON
- The dashboard can filter templates by category

#### 8. Search and Filtering

- Free-text search is debounced on the client
- Search covers todo titles, tag names, and subtask titles
- Filters available: priority, tag, completion state, due date from, due date to
- Users can save and reapply filter presets locally in the browser

#### 9. Export and Import

- Export endpoint: `GET /api/todos/export`
- Import endpoint: `POST /api/todos/import`
- Export payload currently includes `version`, `exported_at`, `todos`, `subtasks`, `tags`, and `todo_tags`
- Import creates new todos for the current user
- Import reuses existing tags when names match, otherwise creates them
- Import restores todo-tag relationships and subtasks, but does not preserve original IDs or timestamps

#### 10. Calendar and Holidays

- Calendar reads todos from `/api/todos`
- Holiday data is served from `GET /api/holidays`
- Holiday seed data is loaded by `npm run seed:holidays`
- Calendar display is based on todo `due_date` values

#### 11. WebAuthn Authentication

- Auth route set includes register options, register verify, login options, login verify, `GET /api/auth/me`, and `POST /api/auth/logout`
- Users and authenticators are stored in SQLite
- Authenticator records store credential ID, public key, counter, transports, device type, and backup state

### Data Model Snapshot

Current database tables:

- `users`
- `authenticators`
- `todos`
- `subtasks`
- `tags`
- `todo_tags`
- `templates`
- `holidays`

Current todo fields:

- `id`
- `user_id`
- `title`
- `completed`
- `priority`
- `due_date`
- `is_recurring`
- `recurrence_pattern`
- `reminder_minutes`
- `last_notification_sent`
- `created_at`
- `updated_at`

### API Surface

Current route groups in `app/api`:

- Auth: `/api/auth/*`
- Todos: `/api/todos`, `/api/todos/[id]`
- Todo tags: `/api/todos/[id]/tags`
- Todo subtasks: `/api/todos/[id]/subtasks`
- Subtask item routes: `/api/subtasks/[id]`
- Tags: `/api/tags`, `/api/tags/[id]`
- Templates: `/api/templates`, `/api/templates/[id]`, `/api/templates/[id]/use`
- Notifications: `/api/notifications/check`
- Holidays: `/api/holidays`
- Import/export: `/api/todos/export`, `/api/todos/import`

### Test Coverage Snapshot

Playwright specs currently cover:

- authentication redirects
- todo create/edit/complete/delete
- recurring todo UI flow
- reminder selector behavior
- subtasks and progress updates
- tag creation and filtering
- template save and reuse
- search and filter clearing
- export and import flow
- calendar holiday display and day modal
- logout/session behavior

### Known Implementation Notes

- The app is a single-user-per-session experience, but all persisted entities are scoped by authenticated user ID
- Filter presets are client-side only and are not synced to the backend
- Reminder delivery currently depends on the browser notification flow plus the notifications check endpoint
- Recurring todo metadata is implemented, but automated recurrence generation is not yet part of the current codebase

## Shared Technical Constraints

- Framework: Next.js 16 App Router
- Database: SQLite via `better-sqlite3`
- Authentication: WebAuthn with JWT session cookies
- Timezone: `Asia/Singapore` for all business logic
- Testing: Playwright E2E plus focused unit/integration tests

## Project-Wide Rules

- Always use `getSingaporeNow()` and related helpers from `lib/timezone.ts` for business time logic
- Never use direct client access to `lib/db.ts`; all database writes go through API routes
- All API routes must authenticate first and scope data by `session.userId`
- Dynamic App Router route params must be awaited in Next.js 16 when applicable
- Database operations are synchronous
- Use prepared statements throughout
- Main feature UI may live in the monolithic `app/page.tsx` pattern used by this project
- For WebAuthn authenticator counters, use `counter: authenticator.counter ?? 0`

## Required Features

### 01. Todo CRUD Operations

Implement:

- create, read, update, delete todos
- sectioned display: Overdue, Active, Completed
- optimistic UI updates
- trimmed title validation
- due date validation requiring at least 1 minute in the future
- sorting by priority then due date
- edit and delete interactions

Evaluation-critical requirements:

- `POST /api/todos`
- `GET /api/todos`
- `GET /api/todos/[id]`
- `PUT /api/todos/[id]`
- `DELETE /api/todos/[id]`
- delete cascades to subtasks and tag associations

Reference:

- `./reference/01-todo-crud-operations.md`

### 02. Priority System

Implement:

- `high`, `medium`, `low` priorities
- default `medium`
- red, yellow, blue badges
- priority sorting
- priority filter
- dark mode compatibility

Reference:

- `./reference/02-priority-system.md`

### 03. Recurring Todos

Implement:

- recurrence patterns: daily, weekly, monthly, yearly
- due-date requirement for recurring todos
- next-instance creation upon completion
- inheritance of priority, tags, reminders, and recurrence metadata
- accurate Singapore-time date calculation

Reference:

- `./reference/03-recurring-todos.md`

### 04. Reminders & Notifications

Implement:

- 7 reminder offsets
- permission-driven browser notifications
- notification polling every 30 seconds to satisfy evaluation criteria
- duplicate prevention via `last_notification_sent`
- notification badge display
- `GET /api/notifications/check`

Reference:

- `./reference/04-reminders-notifications.md`

### 05. Subtasks & Progress Tracking

Implement:

- `subtasks` table with cascade delete
- subtask create/update/delete APIs
- expandable subtask UI
- progress bar and percentage text
- green bar at 100 percent, blue otherwise

Reference:

- `./reference/05-subtasks-progress.md`

### 06. Tag System

Implement:

- `tags` and `todo_tags`
- tag CRUD APIs
- tag assignment to todos
- tag management modal
- tag color picker and validation
- filtering by tag
- clickable tag badge filter behavior

Reference:

- `./reference/06-tag-system.md`

### 07. Template System

Implement:

- `templates` table
- save-template flow
- template manager
- create-from-template flow
- subtasks JSON serialization
- due date offset calculation model to satisfy evaluation criteria
- category filtering

Reference:

- `./reference/07-template-system.md`

### 08. Search & Filtering

Implement:

- real-time case-insensitive search
- 300ms debounce
- search over todo titles, subtask titles, and tag names
- AND-combined filters
- clear-all behavior
- active filter summary
- empty state messaging
- client-side performance target under 100ms for 1000 todos

Reference:

- `./reference/08-search-filtering.md`

### 09. Export & Import

Implement:

- `GET /api/todos/export`
- `POST /api/todos/import`
- JSON export with version field
- import validation
- ID remapping
- tag conflict resolution by reusing existing tags
- success reporting with counts

Reference:

- `./reference/09-export-import.md`

### 10. Calendar View

Implement:

- `/calendar` route
- month grid generation
- previous, next, and today navigation
- `Sun-Sat` headers
- current-day highlight
- weekend styling
- holiday API and seeded Singapore holidays
- todo count badge
- click day to open modal of that day's todos
- URL state via `?month=YYYY-MM`

Reference:

- `./reference/10-calendar-view.md`

### 11. Authentication (WebAuthn)

Implement:

- `users` and `authenticators` tables
- registration and login option routes
- verification routes
- logout route
- `GET /api/auth/me`
- `lib/auth.ts` helpers for create/get/delete session
- `/login` page
- middleware route protection
- redirect authenticated users away from login

Reference:

- `./reference/11-authentication-webauthn.md`

## Cross-Cutting Evaluation Requirements

### Testing and Quality Assurance

Implementation must also satisfy the non-feature evaluation criteria from `../../EVALUATION.md`:

- create all 11 feature E2E test files
- add reusable helpers in `tests/helpers.ts`
- configure virtual authenticators for Playwright
- set Playwright timezone to `Asia/Singapore`
- ensure tests pass consistently
- add unit tests for DB CRUD behavior, Singapore-time date calculations, progress calculation, ID remapping, and validation helpers

### Code Quality

- ESLint must pass
- TypeScript strict mode should be enabled
- no TypeScript errors
- proper API error handling
- loading states for async UI operations
- avoid production `console.error` noise

### Accessibility

- meet WCAG AA contrast
- keyboard navigation for interactive flows
- visible focus states
- labels for form controls
- ARIA where needed
- target Lighthouse accessibility score above 90

### Performance

- page load target under 2 seconds
- time to interactive under 3 seconds
- todo operations under 500ms
- API average under 300ms
- search and filtering under 100ms
- avoid N+1 query patterns
- use indexes on foreign keys, `user_id`, and `due_date`

### Security

- HTTP-only cookies for sessions
- `Secure` cookies in production
- `SameSite` configured
- SQL injection prevention through prepared statements
- no sensitive data in logs
- route protection for authenticated pages and APIs
- preserve React escaping and avoid unsafe rendering

### Deployment Readiness

- production build must succeed
- environment variables documented
- `.env.example` should exist
- `JWT_SECRET`, `RP_ID`, `RP_NAME`, and `RP_ORIGIN` required

## Implementation Order

1. Authentication and foundational DB/session setup
2. Todo CRUD and priority system
3. Recurring todos, reminders, and subtasks
4. Tags and search/filtering
5. Templates, export/import, and calendar
6. Test suite completion
7. Accessibility, performance, and deployment hardening

## Deliverables

The implementation is not complete until it includes:

- working feature set for all 11 areas
- API routes and DB support for each feature
- E2E coverage for all critical flows
- unit or integration coverage for core logic
- protected routes and secure session behavior
- production-ready configuration and deployment documentation

## Acceptance Criteria

- All 11 core features work according to `../../USER_GUIDE.md`
- Implementation satisfies the feature checklists in `../../EVALUATION.md`
- Cross-cutting criteria for testing, accessibility, quality, performance, and security are addressed
- AI assistants can use this PRP alone to implement the full app with the correct project conventions

## Suggested Usage With AI Coding Assistants

```text
Using `.github/PRPs/todo-app-core-features.md` and the referenced split PRPs in `.github/PRPs/reference/`, implement the full Todo App in this repository. Follow `.github/copilot-instructions.md`, `USER_GUIDE.md`, and `EVALUATION.md` exactly. Ensure all 11 features, all required API routes, Singapore timezone handling, WebAuthn authentication, and evaluation-aligned tests are included.
```

## Related Split PRPs

- `./reference/01-todo-crud-operations.md`
- `./reference/02-priority-system.md`
- `./reference/03-recurring-todos.md`
- `./reference/04-reminders-notifications.md`
- `./reference/05-subtasks-progress.md`
- `./reference/06-tag-system.md`
- `./reference/07-template-system.md`
- `./reference/08-search-filtering.md`
- `./reference/09-export-import.md`
- `./reference/10-calendar-view.md`
- `./reference/11-authentication-webauthn.md`

## Supporting References

- `./reference/README.md`
- `../copilot-instructions.md`
- `../../USER_GUIDE.md`
- `../../EVALUATION.md`
