# ARCHITECTURE.md

> Comprehensive system architecture for the Todo App.
> Any implementing agent reading this file plus a feature PRP has enough context to build correctly.

**Last updated:** 2026-04-08
**Tech stack:** Next.js 16 (App Router) | React 19 | Tailwind CSS 4 | SQLite (better-sqlite3) | TanStack Query | WebAuthn | Playwright
**Timezone:** All date/time operations use `Asia/Singapore`. Never call `new Date()` directly; always use `lib/timezone.ts`.

---

## Table of Contents

1. [Project File Structure](#1-project-file-structure)
2. [Database Schema](#2-database-schema)
3. [API Surface](#3-api-surface)
4. [Component Tree](#4-component-tree)
5. [Design Token System](#5-design-token-system)
6. [State Management Architecture](#6-state-management-architecture)
7. [Type System](#7-type-system-libtypes)
8. [Integration Contracts](#8-integration-contracts)
9. [Data Flow Diagram](#9-data-flow-diagram)
10. [Architecture Decision Records](#10-architecture-decision-records)

---

## 1. Project File Structure

```
todo-app/
├── app/
│   ├── layout.tsx                          # Root layout (providers, metadata)
│   ├── page.tsx                            # Main todo list page ('use client')
│   ├── login/
│   │   └── page.tsx                        # Login/register page ('use client')
│   ├── calendar/
│   │   └── page.tsx                        # Calendar view page ('use client')
│   ├── globals.css                         # Global styles + Tailwind directives + token imports
│   └── api/
│       ├── auth/
│       │   ├── register-options/route.ts   # POST: WebAuthn registration challenge
│       │   ├── register-verify/route.ts    # POST: Verify registration response
│       │   ├── login-options/route.ts      # POST: WebAuthn login challenge
│       │   ├── login-verify/route.ts       # POST: Verify login response
│       │   ├── logout/route.ts             # POST: Clear session cookie
│       │   └── me/route.ts                 # GET: Current user info
│       ├── todos/
│       │   ├── route.ts                    # GET: list todos, POST: create todo
│       │   ├── [id]/
│       │   │   ├── route.ts               # GET/PUT/DELETE single todo
│       │   │   ├── subtasks/route.ts       # POST: create subtask for todo
│       │   │   └── tags/route.ts           # POST/DELETE: assign/remove tags
│       │   ├── export/route.ts             # GET: export todos (JSON/CSV)
│       │   └── import/route.ts             # POST: import todos from JSON
│       ├── subtasks/
│       │   └── [id]/route.ts              # PUT/DELETE single subtask
│       ├── tags/
│       │   ├── route.ts                    # GET: list tags, POST: create tag
│       │   └── [id]/route.ts              # PUT/DELETE single tag
│       ├── templates/
│       │   ├── route.ts                    # GET: list templates, POST: create template
│       │   └── [id]/
│       │       ├── route.ts               # PUT/DELETE single template
│       │       └── use/route.ts           # POST: create todo from template
│       ├── holidays/route.ts              # GET: list holidays for month/year
│       └── notifications/
│           └── check/route.ts             # GET: check for pending reminders
│
├── components/
│   ├── providers/
│   │   ├── AppProviders.tsx                # Composes all providers in correct order
│   │   ├── QueryProvider.tsx               # TanStack QueryClientProvider
│   │   ├── AuthProvider.tsx                # AuthContext provider
│   │   └── ThemeProvider.tsx               # ThemeContext provider (dark mode)
│   ├── layout/
│   │   ├── AppShell.tsx                    # Top-level layout chrome (header, nav, main)
│   │   ├── Header.tsx                      # App bar: title, nav links, user menu, theme toggle
│   │   ├── Sidebar.tsx                     # (Optional) sidebar for desktop
│   │   └── Footer.tsx                      # (Optional) status bar
│   ├── auth/
│   │   ├── LoginForm.tsx                   # Username input + WebAuthn login flow
│   │   ├── RegisterForm.tsx                # Username input + WebAuthn registration flow
│   │   └── LogoutButton.tsx                # Session termination
│   ├── todos/
│   │   ├── TodoForm.tsx                    # Create/edit todo form (title, priority, due date, recurrence, reminder)
│   │   ├── TodoList.tsx                    # Container: Overdue / Pending / Completed sections
│   │   ├── TodoSection.tsx                 # Collapsible section with header + count
│   │   ├── TodoItem.tsx                    # Single todo row: checkbox, title, badges, actions
│   │   ├── TodoEditModal.tsx               # Modal form for editing existing todo
│   │   └── TodoBadges.tsx                  # Priority badge, recurrence badge, reminder badge
│   ├── subtasks/
│   │   ├── SubtaskList.tsx                 # Expandable subtask list under a TodoItem
│   │   ├── SubtaskItem.tsx                 # Single subtask row: checkbox, title, delete
│   │   ├── SubtaskForm.tsx                 # Inline input for adding subtask
│   │   └── ProgressBar.tsx                 # Visual progress (0-100%), green at 100%
│   ├── tags/
│   │   ├── TagManager.tsx                  # Modal: CRUD operations for tags
│   │   ├── TagSelector.tsx                 # Multi-select tag pills for todo form
│   │   ├── TagBadge.tsx                    # Single colored tag pill
│   │   └── TagFilter.tsx                   # Dropdown for filtering by tag
│   ├── templates/
│   │   ├── TemplateManager.tsx             # Modal: browse, use, delete templates
│   │   ├── SaveTemplateModal.tsx           # Modal: name, description, category inputs
│   │   └── TemplateCard.tsx                # Template preview with settings summary
│   ├── search/
│   │   ├── SearchBar.tsx                   # Real-time search input with debounce
│   │   ├── FilterBar.tsx                   # Priority + tag + advanced dropdowns
│   │   ├── AdvancedFilters.tsx             # Date range, completion status, saved presets
│   │   └── SavedFilterPresets.tsx          # Saved filter pills (localStorage)
│   ├── calendar/
│   │   ├── CalendarGrid.tsx                # Monthly grid: weeks x 7 days
│   │   ├── CalendarDay.tsx                 # Single day cell: date, todos, holiday
│   │   ├── CalendarNav.tsx                 # Previous/Next/Today month navigation
│   │   ├── CalendarDayModal.tsx            # Modal: todos for selected day
│   │   └── HolidayBadge.tsx               # Holiday name indicator
│   ├── export-import/
│   │   ├── ExportButton.tsx                # Export JSON/CSV buttons
│   │   └── ImportButton.tsx                # Import file picker + validation
│   ├── notifications/
│   │   └── NotificationToggle.tsx          # Enable/disable browser notifications button
│   ├── ui/                                 # shadcn/ui components (auto-generated, do not edit manually)
│   │   ├── button.tsx                      # Button with variants (shadcn)
│   │   ├── badge.tsx                       # Badge/pill (shadcn)
│   │   ├── dialog.tsx                      # Accessible modal with focus trap (shadcn)
│   │   ├── input.tsx                       # Styled text input (shadcn)
│   │   ├── label.tsx                       # Form label (shadcn)
│   │   ├── select.tsx                      # Styled select dropdown (shadcn)
│   │   ├── checkbox.tsx                    # Styled checkbox (shadcn)
│   │   ├── progress.tsx                    # Progress bar (shadcn)
│   │   ├── card.tsx                        # Card container (shadcn)
│   │   ├── separator.tsx                   # Horizontal/vertical divider (shadcn)
│   │   ├── tabs.tsx                        # Tab navigation (shadcn)
│   │   └── dropdown-menu.tsx               # Dropdown menu (shadcn)
│   └── common/
│       ├── DateTimePicker.tsx              # Date-time input wrapper (Singapore TZ)
│       ├── ColorPicker.tsx                 # Hex color picker for tags (custom)
│       ├── Spinner.tsx                     # Loading indicator
│       ├── EmptyState.tsx                  # "No results" illustration
│       └── ConfirmDialog.tsx               # Confirmation dialog for destructive actions
│
├── lib/
│   ├── db/
│   │   ├── connection.ts                   # Database singleton, schema init, migrations
│   │   ├── todos.ts                        # todoDB: CRUD + query helpers for todos table
│   │   ├── subtasks.ts                     # subtaskDB: CRUD for subtasks table
│   │   ├── tags.ts                         # tagDB: CRUD for tags + todo_tags tables
│   │   ├── templates.ts                    # templateDB: CRUD for templates table
│   │   ├── users.ts                        # userDB: CRUD for users + authenticators tables
│   │   ├── holidays.ts                     # holidayDB: Query holidays by month/year
│   │   └── index.ts                        # Re-export all DB modules
│   ├── api/
│   │   ├── client.ts                       # Base fetch wrapper: auth headers, error handling, base URL
│   │   ├── todos.ts                        # Typed functions: fetchTodos, createTodo, updateTodo, deleteTodo, toggleTodo
│   │   ├── subtasks.ts                     # Typed functions: createSubtask, updateSubtask, deleteSubtask
│   │   ├── tags.ts                         # Typed functions: fetchTags, createTag, updateTag, deleteTag, assignTag, removeTag
│   │   ├── templates.ts                    # Typed functions: fetchTemplates, createTemplate, useTemplate, deleteTemplate
│   │   ├── auth.ts                         # Typed functions: registerOptions, registerVerify, loginOptions, loginVerify, logout, me
│   │   ├── holidays.ts                     # Typed functions: fetchHolidays
│   │   ├── notifications.ts               # Typed functions: checkNotifications
│   │   └── export-import.ts               # Typed functions: exportTodos, importTodos
│   ├── types/
│   │   ├── todo.ts                         # Todo, CreateTodoDto, UpdateTodoDto
│   │   ├── subtask.ts                      # Subtask, CreateSubtaskDto
│   │   ├── tag.ts                          # Tag, CreateTagDto, UpdateTagDto
│   │   ├── template.ts                     # Template, CreateTemplateDto
│   │   ├── user.ts                         # User, Session, Authenticator
│   │   ├── holiday.ts                      # Holiday
│   │   ├── enums.ts                        # Priority, RecurrencePattern, ReminderMinutes
│   │   ├── api.ts                          # ApiResponse<T>, ApiError, PaginationMeta
│   │   └── index.ts                        # Re-export all types
│   ├── hooks/
│   │   ├── useTodos.ts                     # TanStack Query: todos CRUD mutations + queries
│   │   ├── useSubtasks.ts                  # TanStack Query: subtask mutations
│   │   ├── useTags.ts                      # TanStack Query: tags queries + mutations
│   │   ├── useTemplates.ts                 # TanStack Query: templates queries + mutations
│   │   ├── useAuth.ts                      # Auth state from AuthContext + session query
│   │   ├── useNotifications.ts             # Browser notification permission + polling
│   │   ├── useHolidays.ts                  # TanStack Query: holidays by month
│   │   ├── useSearch.ts                    # Debounced search + filter state
│   │   ├── useTheme.ts                     # Dark mode toggle from ThemeContext
│   │   └── useDebounce.ts                  # Generic debounce hook
│   ├── tokens/
│   │   ├── colors.ts                       # Color tokens: light + dark mode palettes
│   │   ├── spacing.ts                      # Spacing scale tokens
│   │   ├── typography.ts                   # Font sizes, weights, line heights
│   │   ├── borders.ts                      # Border radius, widths
│   │   ├── semantic.ts                     # Semantic tokens: success, warning, error, info
│   │   ├── priority.ts                     # Priority color map (high/medium/low)
│   │   ├── tags.ts                         # Default tag color palette
│   │   └── index.ts                        # Token aggregation + CSS custom property generator
│   ├── auth.ts                             # createSession, getSession, deleteSession (JWT + cookies)
│   ├── timezone.ts                         # getSingaporeNow, formatSingaporeDate, toSingaporeISO, etc.
│   └── utils.ts                            # General utilities: cn() classname merger, etc.
│
├── middleware.ts                            # Route protection: redirect unauthenticated to /login
│
├── scripts/
│   └── seed-holidays.ts                    # Seed Singapore public holidays into DB
│
├── tests/
│   ├── helpers.ts                          # Reusable: createTodo, addSubtask, createTag, login, register
│   ├── 01-authentication.spec.ts
│   ├── 02-todo-crud.spec.ts
│   ├── 03-priority-system.spec.ts
│   ├── 04-recurring-todos.spec.ts
│   ├── 05-reminders-notifications.spec.ts
│   ├── 06-subtasks-progress.spec.ts
│   ├── 07-tag-system.spec.ts
│   ├── 08-template-system.spec.ts
│   ├── 09-search-filtering.spec.ts
│   ├── 10-export-import.spec.ts
│   ├── 11-calendar-view.spec.ts
│   └── contracts/                          # Integration contract tests
│       ├── todo-tags.contract.test.ts      # Todo <-> Tag interface contracts
│       ├── todo-subtasks.contract.test.ts  # Todo <-> Subtask interface contracts
│       ├── todo-templates.contract.test.ts # Todo <-> Template interface contracts
│       └── todo-recurring.contract.test.ts # Todo <-> Recurring interface contracts
│
├── public/
│   └── (static assets)
│
├── playwright.config.ts                    # Playwright config: virtual authenticator, Singapore TZ
├── next.config.ts                          # Next.js 16 config
├── tailwind.config.ts                      # Tailwind CSS 4 config: token integration
├── tsconfig.json                           # TypeScript strict mode, path aliases
├── package.json
├── components.json                         # shadcn/ui configuration (component registry, paths, style)
├── todos.db                                # SQLite database file (gitignored)
├── .env.local                              # JWT_SECRET, RP_ID, RP_NAME, RP_ORIGIN
└── ARCHITECTURE.md                         # This file
```

### File Size Guidelines

| Category | Target Lines | Maximum Lines |
|----------|-------------|--------------|
| Component | 50-200 | 400 |
| Hook | 30-100 | 200 |
| API route | 30-80 | 150 |
| DB module | 50-150 | 300 |
| API client | 30-80 | 150 |
| Type file | 20-60 | 100 |

---

## 2. Database Schema

All tables live in `todos.db` (SQLite via better-sqlite3). Schema creation and migrations happen in `lib/db/connection.ts` using `db.exec()`. All database operations are **synchronous** (no async/await for queries).

```sql
-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS authenticators (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL,
  credential_id    TEXT    NOT NULL UNIQUE,        -- base64url-encoded
  credential_public_key TEXT NOT NULL,              -- base64url-encoded
  counter          INTEGER NOT NULL DEFAULT 0,
  transports       TEXT,                            -- JSON array of transport strings
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_authenticators_user_id
  ON authenticators(user_id);
CREATE INDEX IF NOT EXISTS idx_authenticators_credential_id
  ON authenticators(credential_id);

-- ============================================================
-- TODOS
-- ============================================================

CREATE TABLE IF NOT EXISTS todos (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL,
  title                 TEXT    NOT NULL,
  completed             INTEGER NOT NULL DEFAULT 0,   -- 0 = false, 1 = true
  due_date              TEXT,                          -- ISO 8601 string (Singapore TZ)
  priority              TEXT    NOT NULL DEFAULT 'medium'
                          CHECK (priority IN ('high', 'medium', 'low')),
  is_recurring          INTEGER NOT NULL DEFAULT 0,   -- 0 = false, 1 = true
  recurrence_pattern    TEXT
                          CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly')),
  reminder_minutes      INTEGER,                      -- null = no reminder; values: 15,30,60,120,1440,2880,10080
  last_notification_sent TEXT,                         -- ISO 8601 timestamp of last sent notification
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_todos_user_id     ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date    ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_priority    ON todos(priority);
CREATE INDEX IF NOT EXISTS idx_todos_completed   ON todos(completed);
CREATE INDEX IF NOT EXISTS idx_todos_user_completed
  ON todos(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_todos_user_due_date
  ON todos(user_id, due_date);

-- ============================================================
-- SUBTASKS
-- ============================================================

CREATE TABLE IF NOT EXISTS subtasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id     INTEGER NOT NULL,
  title       TEXT    NOT NULL,
  completed   INTEGER NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0,            -- ordering within parent todo
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id
  ON subtasks(todo_id);

-- ============================================================
-- TAGS (many-to-many with todos)
-- ============================================================

CREATE TABLE IF NOT EXISTS tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT    NOT NULL,
  color       TEXT    NOT NULL DEFAULT '#3B82F6',     -- hex color string
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name)                               -- tag names unique per user
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (todo_id, tag_id),
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_todo_tags_todo_id ON todo_tags(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id  ON todo_tags(tag_id);

-- ============================================================
-- TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS templates (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL,
  name                TEXT    NOT NULL,
  description         TEXT,
  category            TEXT,
  title_template      TEXT    NOT NULL,               -- title used when creating todo from template
  priority            TEXT    NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('high', 'medium', 'low')),
  is_recurring        INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern  TEXT
                        CHECK (recurrence_pattern IN ('daily', 'weekly', 'monthly', 'yearly')),
  reminder_minutes    INTEGER,
  subtasks_json       TEXT,                            -- JSON: [{ "title": string, "position": number }]
  due_date_offset_days INTEGER,                       -- days from now when using template
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);

-- ============================================================
-- HOLIDAYS (Singapore public holidays)
-- ============================================================

CREATE TABLE IF NOT EXISTS holidays (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT    NOT NULL,                        -- YYYY-MM-DD format
  name        TEXT    NOT NULL,
  year        INTEGER NOT NULL,
  UNIQUE(date, name)
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);
```

### Migration Strategy

Migrations use try-catch `ALTER TABLE` blocks in `lib/db/connection.ts`:

```typescript
// Example: adding a column safely
try {
  db.exec(`ALTER TABLE todos ADD COLUMN reminder_minutes INTEGER`)
} catch {
  // Column already exists, ignore
}
```

This pattern is idempotent -- safe to run on every app startup.

---

## 3. API Surface

All routes require authentication via JWT session cookie unless noted. Every route handler follows this pattern:

```typescript
export async function METHOD(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  // params is async in Next.js 16
  const { id } = await params
  // ... handler logic using session.userId
}
```

### 3.1 Authentication

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| POST | `/api/auth/register-options` | No | Generate WebAuthn registration challenge |
| POST | `/api/auth/register-verify` | No | Verify registration + create user + set session cookie |
| POST | `/api/auth/login-options` | No | Generate WebAuthn login challenge |
| POST | `/api/auth/login-verify` | No | Verify login + set session cookie |
| POST | `/api/auth/logout` | Yes | Clear session cookie |
| GET | `/api/auth/me` | Yes | Return current user info |

**POST `/api/auth/register-options`**
```
Request:  { username: string }
Response: PublicKeyCredentialCreationOptionsJSON  (from @simplewebauthn/server)
```

**POST `/api/auth/register-verify`**
```
Request:  { username: string, credential: RegistrationResponseJSON }
Response: { success: boolean, user: User }
          Sets HTTP-only cookie: session (JWT, 7-day expiry)
```

**POST `/api/auth/login-options`**
```
Request:  { username: string }
Response: PublicKeyCredentialRequestOptionsJSON  (from @simplewebauthn/server)
```

**POST `/api/auth/login-verify`**
```
Request:  { username: string, credential: AuthenticationResponseJSON }
Response: { success: boolean, user: User }
          Sets HTTP-only cookie: session (JWT, 7-day expiry)
```

**GET `/api/auth/me`**
```
Response: { user: User } | { error: string }
```

### 3.2 Todos

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/todos` | List all todos for authenticated user (with subtasks, tags) |
| POST | `/api/todos` | Create a new todo |
| GET | `/api/todos/[id]` | Get single todo with subtasks and tags |
| PUT | `/api/todos/[id]` | Update todo (including toggle completion) |
| DELETE | `/api/todos/[id]` | Delete todo (cascades to subtasks, todo_tags) |

**GET `/api/todos`**
```
Response: ApiResponse<TodoWithRelations[]>

TodoWithRelations = Todo & {
  subtasks: Subtask[]
  tags: Tag[]
}
```

**POST `/api/todos`**
```
Request:  CreateTodoDto
Response: ApiResponse<Todo>
```

**PUT `/api/todos/[id]`**
```
Request:  UpdateTodoDto
Response: ApiResponse<Todo>
Notes:    When completing a recurring todo, the handler creates the next instance
          with inherited priority, tags, reminder, recurrence settings.
          Next due date calculated per recurrence_pattern.
```

**DELETE `/api/todos/[id]`**
```
Response: ApiResponse<{ deleted: true }>
Notes:    CASCADE deletes subtasks and todo_tags rows.
```

### 3.3 Subtasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/todos/[id]/subtasks` | Create subtask under a todo |
| PUT | `/api/subtasks/[id]` | Update subtask (toggle completion, edit title) |
| DELETE | `/api/subtasks/[id]` | Delete a subtask |

**POST `/api/todos/[id]/subtasks`**
```
Request:  CreateSubtaskDto  { title: string }
Response: ApiResponse<Subtask>
Notes:    Position auto-assigned as max(position) + 1 for that todo.
```

**PUT `/api/subtasks/[id]`**
```
Request:  { title?: string, completed?: boolean }
Response: ApiResponse<Subtask>
```

### 3.4 Tags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tags` | List all tags for authenticated user |
| POST | `/api/tags` | Create a new tag |
| PUT | `/api/tags/[id]` | Update tag name or color |
| DELETE | `/api/tags/[id]` | Delete tag (cascades from todo_tags) |
| POST | `/api/todos/[id]/tags` | Assign tag(s) to a todo |
| DELETE | `/api/todos/[id]/tags` | Remove tag(s) from a todo |

**POST `/api/tags`**
```
Request:  CreateTagDto  { name: string, color: string }
Response: ApiResponse<Tag>
Errors:   409 if tag name already exists for user.
```

**POST `/api/todos/[id]/tags`**
```
Request:  { tagIds: number[] }
Response: ApiResponse<{ assigned: true }>
```

**DELETE `/api/todos/[id]/tags`**
```
Request:  { tagIds: number[] }
Response: ApiResponse<{ removed: true }>
```

### 3.5 Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List all templates for authenticated user |
| POST | `/api/templates` | Create a new template |
| PUT | `/api/templates/[id]` | Update template |
| DELETE | `/api/templates/[id]` | Delete template |
| POST | `/api/templates/[id]/use` | Create a todo from template |

**POST `/api/templates`**
```
Request:  CreateTemplateDto
Response: ApiResponse<Template>
Notes:    subtasks_json is JSON.stringify([{ title, position }])
```

**POST `/api/templates/[id]/use`**
```
Request:  { dueDate?: string }   // optional override
Response: ApiResponse<Todo>
Notes:    Creates todo + subtasks from template.
          If due_date_offset_days is set and no dueDate override,
          calculates due date as getSingaporeNow() + offset days.
```

### 3.6 Holidays

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/holidays?year=YYYY&month=MM` | List Singapore holidays for month |

```
Response: ApiResponse<Holiday[]>
```

### 3.7 Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications/check` | Check for pending reminders |

```
Response: ApiResponse<TodoReminder[]>

TodoReminder = {
  id: number
  title: string
  due_date: string
  reminder_minutes: number
}
Notes:    Returns todos where:
          - reminder_minutes is set
          - due_date minus reminder_minutes <= now
          - completed = 0
          - last_notification_sent is null OR before current reminder window
          Updates last_notification_sent on retrieval.
```

### 3.8 Export / Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/todos/export?format=json` | Export all todos as JSON |
| GET | `/api/todos/export?format=csv` | Export all todos as CSV |
| POST | `/api/todos/import` | Import todos from JSON |

**GET `/api/todos/export?format=json`**
```
Response headers: Content-Disposition: attachment; filename=todos-YYYY-MM-DD.json
Response body:
{
  version: 1,
  exportedAt: string,       // Singapore ISO timestamp
  todos: ExportTodo[],
  subtasks: ExportSubtask[],
  tags: ExportTag[],
  todoTags: ExportTodoTag[]
}
```

**POST `/api/todos/import`**
```
Request:  Same shape as export JSON (version, todos, subtasks, tags, todoTags)
Response: ApiResponse<{ imported: { todos: number, subtasks: number, tags: number } }>
Notes:    IDs are remapped. Existing tags matched by name; new tags created if needed.
```

---

## 4. Component Tree

### Provider Hierarchy (app/layout.tsx)

```
<html>
  <body>
    <QueryProvider>                     <!-- TanStack QueryClientProvider -->
      <AuthProvider>                    <!-- AuthContext: user, loading, login, logout -->
        <ThemeProvider>                 <!-- ThemeContext: theme, toggleTheme -->
          <AppShell>                    <!-- Header + main content area -->
            {children}                  <!-- Page content (page.tsx / calendar/page.tsx) -->
          </AppShell>
        </ThemeProvider>
      </AuthProvider>
    </QueryProvider>
  </body>
</html>
```

### Main Page (app/page.tsx) Component Hierarchy

```
<main>
  <Header>
    <nav> Calendar link | Logout button | Theme toggle </nav>
    <NotificationToggle />
  </Header>

  <TodoForm>
    <Input (title) />
    <Select (priority) />
    <DateTimePicker (due date) />
    <Checkbox (recurring) />
    <Select (recurrence pattern) />       {/* visible when recurring checked */}
    <Select (reminder) />                 {/* enabled when due date set */}
    <TagSelector tags={allTags} />
    <Button "Add" />
    <Button "Save as Template" />         {/* visible when title entered */}
  </TodoForm>

  <section> {/* Template quick-use */}
    <Select "Use Template" templates={allTemplates} />
    <Button "Templates" (opens TemplateManager) />
  </section>

  <section> {/* Tags management */}
    <Button "Manage Tags" (opens TagManager) />
  </section>

  <SearchBar />
  <FilterBar>
    <Select (priority filter) />
    <TagFilter />
    <Button "Advanced" (toggles AdvancedFilters) />
    <Button "Clear All" />               {/* visible when filters active */}
    <Button "Save Filter" />             {/* visible when filters active */}
  </FilterBar>
  <AdvancedFilters>                      {/* collapsible panel */}
    <Select (completion status) />
    <DateTimePicker (from) />
    <DateTimePicker (to) />
    <SavedFilterPresets />
  </AdvancedFilters>

  <ExportButton />
  <ImportButton />

  <TodoList>
    <TodoSection title="Overdue" variant="danger">
      <TodoItem> ... </TodoItem>
    </TodoSection>
    <TodoSection title="Pending" variant="default">
      <TodoItem>
        <Checkbox (completion toggle) />
        <span (title) />
        <TodoBadges>
          <Badge (priority) />
          <Badge (recurrence) />
          <Badge (reminder) />
          <TagBadge /> ...
        </TodoBadges>
        <ProgressBar (if subtasks exist) />
        <SubtaskList>                    {/* expandable */}
          <SubtaskItem /> ...
          <SubtaskForm />
        </SubtaskList>
        <Button "Edit" />
        <Button "Delete" />
      </TodoItem>
    </TodoSection>
    <TodoSection title="Completed" variant="muted">
      <TodoItem> ... </TodoItem>
    </TodoSection>
  </TodoList>

  {/* Modals (rendered conditionally) */}
  <TodoEditModal />
  <TagManager />
  <TemplateManager />
  <SaveTemplateModal />
  <ConfirmDialog />
</main>
```

### Calendar Page (app/calendar/page.tsx) Component Hierarchy

```
<main>
  <Header />
  <CalendarNav month={currentMonth} onPrev onNext onToday />
  <CalendarGrid month={currentMonth}>
    <CalendarDay
      date={date}
      todos={todosForDay}
      holiday={holiday}
      isToday={boolean}
      isWeekend={boolean}
      onClick={openDayModal}
    /> (x 35-42 cells)
  </CalendarGrid>
  <CalendarDayModal
    date={selectedDate}
    todos={todosForDay}
    holiday={holiday}
  />
</main>
```

---

## 5. Design Token System

### Token Architecture

The project uses **shadcn/ui** as its component and CSS variable system. Token definitions live in `app/globals.css` as HSL CSS custom properties and are consumed directly by Tailwind CSS 4 utilities. This is the **canonical** source of truth for all design tokens.

> **Legacy note:** `lib/tokens/` still exists but is no longer the authoritative source. The shadcn CSS variables defined in `globals.css` take precedence. Do not add new tokens to `lib/tokens/`; add them to `globals.css` instead.

### 5.1 shadcn/ui CSS Variable System

The shadcn variable system uses HSL values without the `hsl()` wrapper, enabling Tailwind's opacity modifier syntax (e.g., `bg-background/50`).

**Core variables (defined in `:root` and overridden in `.dark`):**

```css
/* app/globals.css — light mode defaults (:root) */
--background:         0 0% 100%;
--foreground:         222.2 84% 4.9%;
--primary:            221.2 83.2% 53.3%;
--primary-foreground: 210 40% 98%;
--secondary:          210 40% 96.1%;
--secondary-foreground: 222.2 47.4% 11.2%;
--muted:              210 40% 96.1%;
--muted-foreground:   215.4 16.3% 46.9%;
--accent:             210 40% 96.1%;
--accent-foreground:  222.2 47.4% 11.2%;
--destructive:        0 84.2% 60.2%;
--destructive-foreground: 210 40% 98%;
--border:             214.3 31.8% 91.4%;
--input:              214.3 31.8% 91.4%;
--ring:               221.2 83.2% 53.3%;
--radius:             0.5rem;
```

**Dark mode** — applied via the `.dark` class on `<html>`:

```css
/* app/globals.css — dark mode overrides (.dark) */
.dark {
  --background:         222.2 84% 4.9%;
  --foreground:         210 40% 98%;
  --primary:            217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;
  /* ... etc, all variables redefined for dark mode */
}
```

**Tailwind utility mapping:**

| Tailwind class | CSS variable |
|---------------|-------------|
| `bg-background` | `hsl(var(--background))` |
| `text-foreground` | `hsl(var(--foreground))` |
| `bg-primary` | `hsl(var(--primary))` |
| `text-primary-foreground` | `hsl(var(--primary-foreground))` |
| `bg-secondary` | `hsl(var(--secondary))` |
| `bg-muted` | `hsl(var(--muted))` |
| `text-muted-foreground` | `hsl(var(--muted-foreground))` |
| `bg-accent` | `hsl(var(--accent))` |
| `bg-destructive` | `hsl(var(--destructive))` |
| `border-border` | `hsl(var(--border))` |
| `ring-ring` | `hsl(var(--ring))` |

### 5.2 Priority Color Extensions

Priority tokens extend shadcn variables with custom HSL properties in `globals.css`:

```css
/* app/globals.css — priority extensions */
:root {
  --priority-high:     0 84.2% 60.2%;    /* red */
  --priority-medium:   38 92% 50%;       /* amber */
  --priority-low:      217.2 91.2% 59.8%; /* blue */
}
.dark {
  --priority-high:     0 72% 51%;
  --priority-medium:   38 92% 50%;
  --priority-low:      213 93% 68%;
}
```

Usage in components:

```tsx
/* Priority high badge */
<span className="bg-priority-high/15 text-priority-high-foreground rounded-full px-2 py-0.5 text-xs">
  High
</span>
```

### 5.3 Semantic Color Extensions

Semantic tokens for success, warning, and info states extend `globals.css`:

```css
/* app/globals.css — semantic extensions */
:root {
  --success:          142.1 76.2% 36.3%;
  --success-foreground: 355.7 100% 97.3%;
  --warning:          38 92% 50%;
  --warning-foreground: 48 96% 89%;
  --info:             199 89% 48%;
  --info-foreground:  210 40% 98%;
}
.dark {
  --success:          142.1 70.6% 45.3%;
  --warning:          38 92% 50%;
  --info:             199 89% 48%;
}
```

Usage:

```tsx
/* Warning banner */
<div className="bg-warning/15 text-warning-foreground rounded-md p-3 text-sm">
  Notifications are blocked.
</div>

/* Success state */
<span className="text-success">Imported successfully</span>
```

### 5.4 Adding New shadcn Components

To add a new shadcn component that is not yet in `components/ui/`:

```bash
npx shadcn add <component-name>
```

This updates `components/ui/` and may update `app/globals.css` with additional CSS variables. Do not manually create files in `components/ui/` — always use the CLI.

### 5.5 Tag Default Palette (`lib/tokens/tags.ts`)

```typescript
export const tagDefaultPalette = [
  '#3B82F6', // blue (default)
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#6366F1', // indigo
  '#14B8A6', // teal
] as const
```

> This palette remains in `lib/tokens/tags.ts` and is consumed by the custom `ColorPicker` component. It is not part of the shadcn variable system.

### 5.6 Color Tokens (`lib/tokens/colors.ts`) — Legacy Reference

```typescript
export const colorTokens = {
  light: {
    // Surface
    'surface-primary':    '#FFFFFF',
    'surface-secondary':  '#F9FAFB',
    'surface-tertiary':   '#F3F4F6',
    'surface-inverse':    '#111827',

    // Text
    'text-primary':       '#111827',
    'text-secondary':     '#4B5563',
    'text-tertiary':      '#9CA3AF',
    'text-inverse':       '#FFFFFF',
    'text-on-color':      '#FFFFFF',

    // Border
    'border-primary':     '#E5E7EB',
    'border-secondary':   '#D1D5DB',
    'border-focus':       '#3B82F6',

    // Interactive
    'interactive-primary':     '#3B82F6',
    'interactive-primary-hover': '#2563EB',
    'interactive-secondary':   '#6B7280',
    'interactive-danger':      '#EF4444',
    'interactive-danger-hover': '#DC2626',
  },
  dark: {
    'surface-primary':    '#111827',
    'surface-secondary':  '#1F2937',
    'surface-tertiary':   '#374151',
    'surface-inverse':    '#F9FAFB',

    'text-primary':       '#F9FAFB',
    'text-secondary':     '#D1D5DB',
    'text-tertiary':      '#6B7280',
    'text-inverse':       '#111827',
    'text-on-color':      '#FFFFFF',

    'border-primary':     '#374151',
    'border-secondary':   '#4B5563',
    'border-focus':       '#60A5FA',

    'interactive-primary':     '#60A5FA',
    'interactive-primary-hover': '#3B82F6',
    'interactive-secondary':   '#9CA3AF',
    'interactive-danger':      '#F87171',
    'interactive-danger-hover': '#EF4444',
  }
} as const
```

---

## 6. State Management Architecture

### 6.1 TanStack Query (Server/API State)

TanStack Query handles all server-state: fetching, caching, mutations, and optimistic updates.

#### Query Keys

```typescript
export const queryKeys = {
  todos:     ['todos'] as const,
  todo:      (id: number) => ['todos', id] as const,
  tags:      ['tags'] as const,
  templates: ['templates'] as const,
  holidays:  (year: number, month: number) => ['holidays', year, month] as const,
  user:      ['auth', 'me'] as const,
} as const
```

#### Hook: `useTodos` (`lib/hooks/useTodos.ts`)

```typescript
// Queries
const todosQuery = useQuery({
  queryKey: queryKeys.todos,
  queryFn: () => todosApi.fetchTodos(),
})

// Mutations
const createMutation = useMutation({
  mutationFn: (dto: CreateTodoDto) => todosApi.createTodo(dto),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.todos }),
})

const updateMutation = useMutation({
  mutationFn: ({ id, dto }: { id: number; dto: UpdateTodoDto }) =>
    todosApi.updateTodo(id, dto),
  onMutate: async ({ id, dto }) => {
    // Optimistic update
    await queryClient.cancelQueries({ queryKey: queryKeys.todos })
    const previous = queryClient.getQueryData(queryKeys.todos)
    queryClient.setQueryData(queryKeys.todos, (old: TodoWithRelations[]) =>
      old.map(t => t.id === id ? { ...t, ...dto } : t)
    )
    return { previous }
  },
  onError: (_err, _vars, context) => {
    queryClient.setQueryData(queryKeys.todos, context?.previous)
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.todos }),
})

const deleteMutation = useMutation({
  mutationFn: (id: number) => todosApi.deleteTodo(id),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.todos }),
})
```

#### Hook: `useTags` (`lib/hooks/useTags.ts`)

```typescript
const tagsQuery   = useQuery({ queryKey: queryKeys.tags, queryFn: tagsApi.fetchTags })
const createTag   = useMutation({ mutationFn: tagsApi.createTag, onSuccess: invalidateTags })
const updateTag   = useMutation({ mutationFn: tagsApi.updateTag, onSuccess: invalidateTags })
const deleteTag   = useMutation({ mutationFn: tagsApi.deleteTag, onSuccess: invalidateTagsAndTodos })
const assignTags  = useMutation({ mutationFn: tagsApi.assignTag, onSuccess: invalidateTodos })
const removeTags  = useMutation({ mutationFn: tagsApi.removeTag, onSuccess: invalidateTodos })
```

#### Hook: `useSubtasks` (`lib/hooks/useSubtasks.ts`)

```typescript
const createSubtask = useMutation({ mutationFn: subtasksApi.createSubtask, onSuccess: invalidateTodos })
const updateSubtask = useMutation({ mutationFn: subtasksApi.updateSubtask, onSuccess: invalidateTodos })
const deleteSubtask = useMutation({ mutationFn: subtasksApi.deleteSubtask, onSuccess: invalidateTodos })
```

#### Hook: `useTemplates` (`lib/hooks/useTemplates.ts`)

```typescript
const templatesQuery = useQuery({ queryKey: queryKeys.templates, queryFn: templatesApi.fetchTemplates })
const createTemplate = useMutation({ mutationFn: templatesApi.createTemplate, onSuccess: invalidateTemplates })
const useTemplate    = useMutation({ mutationFn: templatesApi.useTemplate,    onSuccess: invalidateTodos })
const deleteTemplate = useMutation({ mutationFn: templatesApi.deleteTemplate, onSuccess: invalidateTemplates })
```

#### Hook: `useNotifications` (`lib/hooks/useNotifications.ts`)

```typescript
// Polling query -- refetch every 30 seconds
const notificationsQuery = useQuery({
  queryKey: ['notifications'],
  queryFn: notificationsApi.checkNotifications,
  refetchInterval: 30_000,
  enabled: notificationsEnabled,
})

// Side effect: fire browser notification when data arrives
useEffect(() => {
  if (notificationsQuery.data?.length) {
    for (const reminder of notificationsQuery.data) {
      new Notification(`Todo Reminder: ${reminder.title}`, {
        body: `Due: ${formatSingaporeDate(reminder.due_date)}`,
      })
    }
  }
}, [notificationsQuery.data])
```

### 6.2 React Context (UI/Client State)

Contexts handle purely client-side state that does not come from the server.

#### AuthContext (`components/providers/AuthProvider.tsx`)

```typescript
interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
}
```

Backed by `useQuery({ queryKey: queryKeys.user, queryFn: authApi.me })` internally. The context wraps TanStack Query state for convenient consumption.

#### ThemeContext (`components/providers/ThemeProvider.tsx`)

```typescript
interface ThemeContextValue {
  theme: 'light' | 'dark'
  toggleTheme: () => void
}
```

Persisted to `localStorage` key `theme`. On mount, reads from localStorage or `prefers-color-scheme`. Applies `dark` class to `<html>`.

#### FilterContext (via `useSearch` hook, no separate context needed)

Search and filter state is local to the main page component. The `useSearch` hook manages:

```typescript
interface FilterState {
  searchQuery: string
  priorityFilter: Priority | 'all'
  tagFilter: number | 'all'            // tag ID or 'all'
  completionFilter: 'all' | 'completed' | 'incomplete'
  dateFrom: string | null
  dateTo: string | null
}
```

Filter presets are stored in `localStorage` as `savedFilterPresets`.

### 6.3 Data Flow

```
  Component          Hook             API Client          API Route           DB Module
  ---------          ----             ----------          ---------           ---------
  TodoForm           useTodos()       todosApi            /api/todos          todoDB
  ├─ onSubmit ─────> createMutation   .createTodo(dto)    POST handler        .create(userId, dto)
  │                  .mutate(dto)     ├─ fetch(url, opts)  ├─ getSession()    ├─ db.prepare().run()
  │                                  └─ return json       ├─ validate         └─ return lastInsertRowid
  │                                                       └─ todoDB.create()
  │
  TodoItem           useTodos()       todosApi            /api/todos/[id]     todoDB
  ├─ onToggle ─────> updateMutation   .updateTodo(id,dto) PUT handler         .update(id, dto)
  │                  .mutate()        (optimistic update)  ├─ recurring logic
  │                                                        └─ create next instance
  │
  SearchBar          useSearch()      (client-side)
  ├─ onChange ─────> setSearchQuery   useDebounce(300ms)
  │                  debouncedQuery   filter todosQuery.data in-memory
  │
  NotificationToggle useNotifications  notificationsApi   /api/notifications/check
  ├─ onClick ─────> requestPermission  .checkNotifications  ├─ query due reminders
  │                  enable polling     (every 30s)          └─ update last_notification_sent
```

---

## 7. Type System (`lib/types/`)

### 7.1 Enums and Unions (`lib/types/enums.ts`)

```typescript
export type Priority = 'high' | 'medium' | 'low'

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080

export const PRIORITY_VALUES: readonly Priority[] = ['high', 'medium', 'low'] as const

export const RECURRENCE_VALUES: readonly RecurrencePattern[] = [
  'daily', 'weekly', 'monthly', 'yearly'
] as const

export const REMINDER_OPTIONS: readonly { label: string; value: ReminderMinutes }[] = [
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before',     value: 60 },
  { label: '2 hours before',    value: 120 },
  { label: '1 day before',      value: 1440 },
  { label: '2 days before',     value: 2880 },
  { label: '1 week before',     value: 10080 },
] as const

export const REMINDER_LABELS: Record<ReminderMinutes, string> = {
  15:    '15m',
  30:    '30m',
  60:    '1h',
  120:   '2h',
  1440:  '1d',
  2880:  '2d',
  10080: '1w',
}
```

### 7.2 Todo Types (`lib/types/todo.ts`)

```typescript
import type { Priority, RecurrencePattern, ReminderMinutes } from './enums'
import type { Subtask } from './subtask'
import type { Tag } from './tag'

export interface Todo {
  id: number
  user_id: number
  title: string
  completed: boolean
  due_date: string | null
  priority: Priority
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: ReminderMinutes | null
  last_notification_sent: string | null
  created_at: string
  updated_at: string
}

export interface TodoWithRelations extends Todo {
  subtasks: Subtask[]
  tags: Tag[]
}

export interface CreateTodoDto {
  title: string
  due_date?: string | null
  priority?: Priority                       // defaults to 'medium'
  is_recurring?: boolean                    // defaults to false
  recurrence_pattern?: RecurrencePattern | null
  reminder_minutes?: ReminderMinutes | null
  tagIds?: number[]
}

export interface UpdateTodoDto {
  title?: string
  completed?: boolean
  due_date?: string | null
  priority?: Priority
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
  reminder_minutes?: ReminderMinutes | null
  tagIds?: number[]
}

export interface TodoReminder {
  id: number
  title: string
  due_date: string
  reminder_minutes: number
}

export interface ExportTodo {
  id: number
  title: string
  completed: boolean
  due_date: string | null
  priority: Priority
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: ReminderMinutes | null
  created_at: string
}
```

### 7.3 Subtask Types (`lib/types/subtask.ts`)

```typescript
export interface Subtask {
  id: number
  todo_id: number
  title: string
  completed: boolean
  position: number
  created_at: string
}

export interface CreateSubtaskDto {
  title: string
}

export interface UpdateSubtaskDto {
  title?: string
  completed?: boolean
}

export interface ExportSubtask {
  id: number
  todo_id: number
  title: string
  completed: boolean
  position: number
}
```

### 7.4 Tag Types (`lib/types/tag.ts`)

```typescript
export interface Tag {
  id: number
  user_id: number
  name: string
  color: string                             // hex color, e.g. '#3B82F6'
  created_at: string
}

export interface CreateTagDto {
  name: string
  color: string
}

export interface UpdateTagDto {
  name?: string
  color?: string
}

export interface ExportTag {
  id: number
  name: string
  color: string
}

export interface ExportTodoTag {
  todo_id: number
  tag_id: number
}
```

### 7.5 Template Types (`lib/types/template.ts`)

```typescript
import type { Priority, RecurrencePattern, ReminderMinutes } from './enums'

export interface TemplateSubtask {
  title: string
  position: number
}

export interface Template {
  id: number
  user_id: number
  name: string
  description: string | null
  category: string | null
  title_template: string
  priority: Priority
  is_recurring: boolean
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: ReminderMinutes | null
  subtasks_json: string | null              // JSON string of TemplateSubtask[]
  due_date_offset_days: number | null
  created_at: string
}

export interface CreateTemplateDto {
  name: string
  description?: string | null
  category?: string | null
  title_template: string
  priority?: Priority
  is_recurring?: boolean
  recurrence_pattern?: RecurrencePattern | null
  reminder_minutes?: ReminderMinutes | null
  subtasks?: TemplateSubtask[]              // serialized to JSON before DB insert
  due_date_offset_days?: number | null
}
```

### 7.6 User Types (`lib/types/user.ts`)

```typescript
export interface User {
  id: number
  username: string
  created_at: string
}

export interface Session {
  userId: number
  username: string
}

export interface Authenticator {
  id: number
  user_id: number
  credential_id: string                     // base64url
  credential_public_key: string             // base64url
  counter: number
  transports: string | null                 // JSON array
  created_at: string
}
```

### 7.7 Holiday Types (`lib/types/holiday.ts`)

```typescript
export interface Holiday {
  id: number
  date: string                              // YYYY-MM-DD
  name: string
  year: number
}
```

### 7.8 API Response Types (`lib/types/api.ts`)

```typescript
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: PaginationMeta
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
}

export interface ExportPayload {
  version: number
  exportedAt: string
  todos: ExportTodo[]
  subtasks: ExportSubtask[]
  tags: ExportTag[]
  todoTags: ExportTodoTag[]
}

export interface ImportResult {
  imported: {
    todos: number
    subtasks: number
    tags: number
  }
}
```

### 7.9 Index Re-Export (`lib/types/index.ts`)

```typescript
export * from './enums'
export * from './todo'
export * from './subtask'
export * from './tag'
export * from './template'
export * from './user'
export * from './holiday'
export * from './api'
```

---

## 8. Integration Contracts

Integration contracts define the interface boundaries between feature domains. These contracts are the basis for the contract tests in `tests/contracts/`.

### 8.1 Todo CRUD -- the Foundation Contract

Todo CRUD is the central entity. Every other feature depends on it.

**What Todo CRUD exposes:**

```typescript
// The canonical TodoWithRelations shape returned by GET /api/todos
interface TodoWithRelations {
  id: number
  user_id: number
  title: string
  completed: boolean
  due_date: string | null
  priority: Priority              // consumed by Priority System, Search, Calendar
  is_recurring: boolean           // consumed by Recurring Todos
  recurrence_pattern: RecurrencePattern | null
  reminder_minutes: ReminderMinutes | null   // consumed by Notifications
  last_notification_sent: string | null
  created_at: string
  updated_at: string
  subtasks: Subtask[]             // consumed by Subtasks, Templates, Progress
  tags: Tag[]                     // consumed by Tags, Search, Calendar
}
```

**Contract guarantees:**

| Consumer | What Todo CRUD guarantees |
|----------|-------------------------|
| Priority System | `priority` field is always one of `'high' \| 'medium' \| 'low'`; defaults to `'medium'` on create |
| Recurring Todos | When `completed` changes to `true` AND `is_recurring === true`, a new todo is created with next due date, inheriting priority, tags, reminder, recurrence |
| Subtasks | `subtasks[]` is always an array (empty if none); deleting a todo CASCADE-deletes all subtasks |
| Tags | `tags[]` is always an array (empty if none); deleting a todo CASCADE-deletes todo_tags rows |
| Notifications | `reminder_minutes` and `due_date` are read together; `last_notification_sent` is updated atomically when notification fires |
| Templates | Todo shape is the canonical output of "use template" -- templates produce a standard `Todo` plus `Subtask[]` |
| Export/Import | Export serializes `TodoWithRelations` minus `user_id`; import creates new `Todo` with the importing user's `user_id` |
| Calendar | Calendar reads `due_date` to place todos on days; reads `priority` for color coding |
| Search/Filter | Filters operate on `title`, `priority`, `tags[].name`, `completed`, `due_date` |

### 8.2 Tag System Contracts

**What Tags expose:**

```typescript
// Tags are a separate entity with their own CRUD lifecycle
interface Tag { id: number; user_id: number; name: string; color: string }

// The join is exposed via TodoWithRelations.tags
// and managed via POST/DELETE /api/todos/[id]/tags
```

**Contract boundaries:**

| Consumer | Contract |
|----------|----------|
| Todo display (TodoBadges) | Reads `tags[]` from TodoWithRelations; renders `TagBadge` with `tag.name` and `tag.color` |
| Search/Filter | Reads `tags[].name` from TodoWithRelations; matches case-insensitive against search query; `TagFilter` dropdown populated from `GET /api/tags` |
| Export/Import | Export includes standalone `tags[]` and `todoTags[]` arrays. Import matches existing tags by `(user_id, name)`, creates new tags only when no match. |
| Recurring Todos | When creating next instance of recurring todo, copies all tag associations from completed instance via todo_tags |

### 8.3 Subtask Contracts

**What Subtasks expose:**

```typescript
interface Subtask { id: number; todo_id: number; title: string; completed: boolean; position: number }

// Progress computation (client-side):
// progressPercent = subtasks.length === 0 ? 0 : Math.round(
//   (subtasks.filter(s => s.completed).length / subtasks.length) * 100
// )
```

**Contract boundaries:**

| Consumer | Contract |
|----------|----------|
| ProgressBar | Receives `subtasks: Subtask[]` from TodoWithRelations; computes percentage; renders bar |
| Templates | `CreateTemplateDto.subtasks` is `TemplateSubtask[]` (`{ title, position }`), serialized to JSON. When using a template, each `TemplateSubtask` becomes a `CreateSubtaskDto` call |
| Search | Searches `subtasks[].title` alongside `todo.title` |
| Export/Import | Subtasks exported with their `todo_id`; on import, `todo_id` is remapped to new todo IDs |
| CASCADE | Deleting a todo deletes all its subtasks (DB foreign key) |

### 8.4 Template Contracts

**What Templates expose:**

```typescript
interface Template {
  // ... all fields
  subtasks_json: string | null    // JSON-serialized TemplateSubtask[]
}

// "Use template" endpoint: POST /api/templates/[id]/use
// Input:  { dueDate?: string }
// Output: ApiResponse<Todo>   (the newly created todo)
// Side effects: Also creates subtasks from subtasks_json
```

**Contract boundaries:**

| Consumer | Contract |
|----------|----------|
| Todo CRUD | "Use template" creates a standard Todo via todoDB.create(), then creates subtasks via subtaskDB.create() |
| Subtasks | Template's `subtasks_json` parsed as `TemplateSubtask[]`; each entry creates a `Subtask` with same `title` and `position` |
| TodoForm | Template selector populates form OR directly creates todo; no intermediate state needed |

### 8.5 Recurring Todo Contracts

**Recurrence creation logic (in PUT /api/todos/[id] when setting completed=true):**

```typescript
// Pseudocode for the contract
if (todo.is_recurring && todo.recurrence_pattern && newCompleted === true) {
  const nextDueDate = calculateNextDueDate(todo.due_date, todo.recurrence_pattern)
  const newTodo = todoDB.create(todo.user_id, {
    title: todo.title,
    priority: todo.priority,
    is_recurring: true,
    recurrence_pattern: todo.recurrence_pattern,
    reminder_minutes: todo.reminder_minutes,
    due_date: nextDueDate,
  })
  // Copy tags from completed todo to new todo
  const tags = tagDB.getTagsForTodo(todo.id)
  for (const tag of tags) {
    tagDB.assignTag(newTodo.id, tag.id)
  }
}
```

**`calculateNextDueDate` contract:**

| Pattern | Logic |
|---------|-------|
| `daily` | Add 1 day to due_date |
| `weekly` | Add 7 days to due_date |
| `monthly` | Add 1 month (same day, handle month-end overflow) |
| `yearly` | Add 1 year (handle Feb 29) |

All date calculations use Singapore timezone via `lib/timezone.ts`.

### 8.6 Notification Contracts

```typescript
// Polling: GET /api/notifications/check
// Server computes: reminderTime = due_date - reminder_minutes
// Returns todos where: reminderTime <= now AND completed = 0
//   AND (last_notification_sent IS NULL OR last_notification_sent < reminderTime)
// After returning, updates last_notification_sent = now for each returned todo

// Client contract: useNotifications hook
// - Calls Notification API only when browser permission is 'granted'
// - Polls every 30 seconds
// - Fires new Notification() for each returned reminder
// - Does NOT deduplicate on client (server handles via last_notification_sent)
```

### 8.7 Contract Test Structure

Each contract test verifies the interface between two domains.

```typescript
// tests/contracts/todo-tags.contract.test.ts

describe('Todo-Tag Integration Contract', () => {
  it('GET /api/todos returns tags array for each todo', async () => {
    // Create tag, create todo, assign tag, fetch todos
    // Assert: todo.tags is array containing the assigned tag
  })

  it('Deleting a tag removes it from all todos', async () => {
    // Create tag, assign to todo, delete tag, fetch todo
    // Assert: todo.tags does not contain deleted tag
  })

  it('Deleting a todo does not delete the tag itself', async () => {
    // Create tag, assign to todo, delete todo, fetch tags
    // Assert: tag still exists
  })

  it('Completing a recurring todo copies tags to new instance', async () => {
    // Create recurring todo with tags, complete it
    // Assert: new instance has same tags
  })
})
```

---

## 9. Data Flow Diagram

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                      BROWSER                           │
                    │                                                         │
                    │  ┌──────────────┐   ┌───────────┐   ┌──────────────┐  │
                    │  │ ThemeContext  │   │AuthContext │   │ QueryClient  │  │
                    │  │ (dark mode)  │   │(user,jwt)  │   │ (cache)      │  │
                    │  └──────┬───────┘   └─────┬─────┘   └──────┬───────┘  │
                    │         │                  │                 │          │
                    │  ┌──────┴──────────────────┴─────────────────┴───────┐  │
                    │  │                  React Components                 │  │
                    │  │   TodoForm | TodoList | SearchBar | Calendar      │  │
                    │  └──────────────────────┬───────────────────────────┘  │
                    │                         │ calls                        │
                    │  ┌──────────────────────┴───────────────────────────┐  │
                    │  │              Custom Hooks (lib/hooks/)            │  │
                    │  │  useTodos | useTags | useTemplates | useSearch   │  │
                    │  │  useNotifications | useHolidays | useAuth        │  │
                    │  └──────────────────────┬───────────────────────────┘  │
                    │                         │ calls                        │
                    │  ┌──────────────────────┴───────────────────────────┐  │
                    │  │           Typed API Client (lib/api/)             │  │
                    │  │  client.ts (base) | todos.ts | tags.ts | ...     │  │
                    │  └──────────────────────┬───────────────────────────┘  │
                    │                         │ fetch()                      │
                    └─────────────────────────┼──────────────────────────────┘
                                              │ HTTP (cookie auth)
                    ┌─────────────────────────┼──────────────────────────────┐
                    │                 NEXT.JS SERVER                         │
                    │                         │                              │
                    │  ┌──────────────────────┴───────────────────────────┐  │
                    │  │            API Route Handlers (app/api/)          │  │
                    │  │  1. getSession() -- JWT cookie validation        │  │
                    │  │  2. Input validation                              │  │
                    │  │  3. Business logic (recurring, reminders, etc.)  │  │
                    │  │  4. Call DB module                                │  │
                    │  │  5. Return ApiResponse<T>                         │  │
                    │  └──────────────────────┬───────────────────────────┘  │
                    │                         │ sync calls                   │
                    │  ┌──────────────────────┴───────────────────────────┐  │
                    │  │            DB Modules (lib/db/)                   │  │
                    │  │  connection.ts (singleton) | todos.ts | tags.ts  │  │
                    │  │  subtasks.ts | templates.ts | users.ts           │  │
                    │  │  holidays.ts                                     │  │
                    │  └──────────────────────┬───────────────────────────┘  │
                    │                         │ db.prepare().run/get/all()   │
                    └─────────────────────────┼──────────────────────────────┘
                                              │
                                     ┌────────┴────────┐
                                     │    todos.db      │
                                     │    (SQLite)      │
                                     └─────────────────┘
```

---

## 10. Architecture Decision Records

### ADR-001: Modular UI Components over Monolith page.tsx

**Context:** The existing reference implementation uses a single ~2200-line `app/page.tsx` that handles all features. This is documented in the copilot-instructions as the "Monolithic UI Pattern."

**Decision:** Break into modular components organized by feature domain.

**Consequences:**
- **Positive:** Each component is under 400 lines; high cohesion, low coupling; multiple agents can work on different features simultaneously; easier testing of individual components.
- **Negative:** More files to manage; slight indirection for data flow; must maintain prop interfaces between components.
- **Migration path:** If starting from the monolith, extract one feature domain at a time (e.g., extract TodoForm first, then SubtaskList, etc.).

### ADR-002: Database Split by Domain

**Context:** The reference implementation uses a single `lib/db.ts` (~700 lines) for all database operations.

**Decision:** Split into `lib/db/connection.ts` (singleton + schema) and domain-specific modules (`todos.ts`, `tags.ts`, `subtasks.ts`, `templates.ts`, `users.ts`, `holidays.ts`).

**Consequences:**
- **Positive:** Each module is focused and testable; multiple agents can modify different DB modules without merge conflicts; easier to reason about query patterns per domain.
- **Negative:** Must ensure connection singleton is properly shared; cross-domain queries (e.g., todos with tags) require importing multiple modules.
- **Convention:** All modules import `db` from `./connection.ts` and export named objects (e.g., `export const todoDB = { ... }`).

### ADR-003: TanStack Query + React Context (Not Redux, Not Zustand)

**Context:** Need server-state management with caching, optimistic updates, and background refetching. Also need lightweight UI-state for theme and auth.

**Decision:** TanStack Query for all server/API state. React Context for AuthContext and ThemeContext only.

**Consequences:**
- **Positive:** TanStack Query handles caching, deduplication, background refetch, and optimistic updates out of the box; no custom cache invalidation logic; React Context is sufficient for 2-3 global UI concerns.
- **Negative:** Adding more complex client-side state in the future may require Zustand or similar; TanStack Query is an additional dependency.
- **Rule:** If state comes from the server, it goes through TanStack Query. If state is purely client-side UI, it uses Context or local useState.

### ADR-004: Typed API Client Layer

**Context:** Raw `fetch()` calls scattered across components lead to inconsistent error handling, duplicated headers, and untyped responses.

**Decision:** Centralize all API calls in `lib/api/` with a base `client.ts` and per-domain modules that return typed results.

**Consequences:**
- **Positive:** Single place to add auth headers, handle errors, set base URL; every API call is typed end-to-end; easy to mock in tests.
- **Negative:** One more abstraction layer; must keep API client in sync with API routes.
- **Convention:** Each function in `lib/api/*.ts` matches exactly one API route handler.

### ADR-005: SQLite via better-sqlite3 (Synchronous)

**Context:** The app needs a lightweight, zero-config database. SQLite via better-sqlite3 provides synchronous operations with excellent performance for single-server deployment.

**Decision:** Use better-sqlite3 with synchronous operations. No async/await for database calls.

**Consequences:**
- **Positive:** Simpler code (no async DB layer); fast for read-heavy workloads; zero deployment complexity; single file database.
- **Negative:** Not suitable for horizontal scaling (single-writer); file-based storage requires persistent volume in cloud deployment (Railway volumes); no built-in replication.
- **Scaling plan:** If the app outgrows SQLite (>100K users), migrate to PostgreSQL with the same DB module interface (repository pattern makes this straightforward).

### ADR-006: Migrated from Custom Token System to shadcn/ui

**Context:** The initial design used custom TypeScript token definitions in `lib/tokens/` emitted as CSS custom properties. This required keeping TypeScript objects and CSS in sync manually, and components had to be built from scratch.

**Decision:** Migrated to **shadcn/ui** — a collection of accessible, unstyled-by-default React components built on Radix UI primitives, styled via CSS custom properties that integrate natively with Tailwind CSS 4.

**Migration changes:**
- `components/common/{Button,Badge,Modal,Input,Select,Checkbox}` → replaced by `components/ui/{button,badge,dialog,input,select,checkbox}` from shadcn
- CSS token system now uses shadcn HSL variable conventions (`--background`, `--foreground`, `--primary`, etc.) defined in `app/globals.css`
- Dark mode applied via `.dark` class on `<html>` (unchanged mechanism; variables are redefined in `.dark`)
- Custom extensions for priority (`--priority-high/medium/low`) and semantic (`--success`, `--warning`, `--info`) tokens are appended to `globals.css`
- `lib/tokens/` kept for legacy reference and for `DEFAULT_TAG_COLORS`; new tokens must go in `globals.css`

**Consequences:**
- **Positive:** Pre-built accessible components; Radix UI focus management and keyboard nav for free; shadcn CLI (`npx shadcn add <component>`) for adding new components; consistent design language; dark mode via single CSS class; no TypeScript-to-CSS sync required.
- **Negative:** `components/ui/` files are generated code — do not edit manually; upgrading shadcn components requires re-running the CLI; slight learning curve for HSL variable format.

### ADR-008: shadcn/ui as Primary UI Component Library

**Context:** After the migration described in ADR-006, all new UI primitives should come from shadcn rather than being hand-rolled.

**Decision:** All button, form, modal, badge, and card primitives use shadcn/ui components from `components/ui/`. Feature components in `components/todos/`, `components/tags/`, etc. import from `@/components/ui/*`, not from `components/common/*`.

**Rules:**
1. New shadcn components are added via `npx shadcn add <component>` only.
2. Feature agents must NOT create new files in `components/ui/` manually.
3. `components/common/` is for non-shadcn custom utilities only (e.g., `ColorPicker`, `DateTimePicker`, `EmptyState`).
4. All CSS classes in component specs reference shadcn variables (`bg-background`, `text-foreground`, `bg-muted`, `bg-destructive`, etc.) rather than the legacy custom token names.

**Consequences:**
- **Positive:** Consistent look-and-feel; accessibility built-in; no duplicated primitive implementations; easier onboarding for agents.
- **Negative:** Must use shadcn CLI for any new UI primitive; cannot arbitrarily customize component internals without re-generating.

### ADR-007: Singapore Timezone as Hard Requirement

**Context:** All users operate in Singapore timezone. Timezone conversion errors are a common source of bugs.

**Decision:** All date/time operations go through `lib/timezone.ts`. Direct `new Date()` calls are prohibited.

**Consequences:**
- **Positive:** Consistent behavior across all features; no timezone bugs in recurring todos, reminders, or calendar; Playwright tests configured with `timezoneId: 'Asia/Singapore'`.
- **Negative:** If the app ever needs multi-timezone support, significant refactoring of `lib/timezone.ts` and all consumers.

---

*End of ARCHITECTURE.md*
```

---

The document above is the complete ARCHITECTURE.md. It covers all eight sections you requested, plus a data flow diagram and architecture decision records for completeness.

Key files referenced in this architecture:

- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.github\copilot-instructions.md` -- existing project conventions and patterns
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\PRDs\README.md` -- PRP index with feature dependencies and implementation phases
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\USER_GUIDE.md` -- comprehensive user-facing behavior documentation
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\EVALUATION.md` -- feature completeness checklist with acceptance criteria

The architecture intentionally diverges from the existing monolith pattern (single `lib/db.ts`, single `app/page.tsx`) to match the stakeholder-confirmed design decisions: modular UI, split DB modules, typed API client layer, TanStack Query, shared types in `lib/types/`, and design tokens. The integration contracts section is specifically designed so that agents working on different features can verify they are not breaking cross-feature interfaces.