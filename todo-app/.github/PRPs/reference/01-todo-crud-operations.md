# PRP 01: Todo CRUD Operations

## Feature Overview
Implement the foundational todo lifecycle for the Todo App: create, list, update, complete, and delete todos. This feature is the base for recurring todos, reminders, subtasks, tags, templates, export/import, and calendar views.

This PRP must follow the documented project patterns:
- Next.js 16 App Router
- SQLite via `better-sqlite3`
- Authenticated API routes using session cookies
- Singapore timezone for all date/time validation and display
- Main client UI managed from `app/page.tsx`

## User Stories
- As a user, I want to create a todo with just a title so I can capture tasks quickly.
- As a user, I want to set metadata like priority and due date so I can organize my work.
- As a user, I want to edit existing todos so I can keep them accurate.
- As a user, I want to mark todos complete or incomplete so I can track progress.
- As a user, I want to delete todos so I can remove irrelevant work.
- As a user, I want overdue, pending, and completed sections so I can review work clearly.

## User Flow
1. User logs in and opens the main page.
2. User enters a title, optionally selects priority and due date, then clicks `Add`.
3. UI creates the todo and refreshes the list without a full page reload.
4. Todos render in logical sections:
   - Overdue
   - Pending
   - Completed
5. User can edit a todo from the list.
6. User can toggle completion with a checkbox.
7. User can delete a todo and confirm the action if a confirmation step is used.

## Technical Requirements

### Data Model
Add or confirm a `todos` table in `lib/db.ts` with fields covering at minimum:
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

Shared type expectations:
```ts
export type Priority = 'high' | 'medium' | 'low';

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: boolean;
  priority: Priority;
  due_date: string | null;
  is_recurring: boolean;
  recurrence_pattern: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string;
}
```

### Validation Rules
- Title is required.
- Title must be trimmed.
- Whitespace-only titles are invalid.
- Due date is optional for normal todos.
- If due date is provided, it must be at least 1 minute in the future relative to Singapore time.
- All DB operations are scoped to `session.userId`.

### API Endpoints
- `GET /api/todos`
  - Return all todos for the current user with enough metadata for rendering.
- `POST /api/todos`
  - Create a todo with validated input.
- `GET /api/todos/[id]`
  - Return a single todo for edit flows if needed.
- `PUT /api/todos/[id]`
  - Update title, due date, priority, completion status, and related metadata.
- `DELETE /api/todos/[id]`
  - Delete todo owned by the current user.

Route rules:
- Always call `getSession()` first.
- Return `401` if unauthenticated.
- Use `const { id } = await params` for dynamic routes.
- Use timezone helpers from `lib/timezone.ts`, not direct `new Date()` logic for business validation.

### DB Layer
In `lib/db.ts` expose a `todoDB` object with methods like:
- `getTodosByUserId`
- `getTodoById`
- `createTodo`
- `updateTodo`
- `deleteTodo`

Use prepared statements and synchronous queries only.

## UI Components
- Todo creation form at the top of `app/page.tsx`
- Fields:
  - Title input
  - Priority dropdown
  - Date-time input
  - Add button
- Todo list item with:
  - Completion checkbox
  - Title
  - Priority badge
  - Due date display
  - Edit action
  - Delete action

## Display and Sorting Requirements
- Todos are grouped into:
  - Overdue
  - Pending
  - Completed
- Overdue detection must use Singapore timezone.
- Pending todos sort by:
  1. Priority: high, medium, low
  2. Due date ascending, with dated todos before undated todos when appropriate
  3. Creation time for stable ordering

## Error Handling
- Invalid title returns `400`.
- Invalid due date returns `400`.
- Missing todo returns `404`.
- Unauthorized access to another user's todo returns `404` or `403`, but must not expose existence details.
- UI should display a user-friendly error and avoid leaving stale state behind.

## Edge Cases
- User submits empty string after trimming.
- User sets due date in the past.
- User edits a completed todo back to incomplete.
- User deletes a todo that has related subtasks or tags.
- User rapidly toggles completion multiple times.
- User has zero todos.

## Acceptance Criteria
- User can create a todo with only a title.
- User can create a todo with priority and due date.
- Todos render in overdue, pending, and completed sections.
- Completion toggle updates UI and persistence correctly.
- Editing updates the correct todo and preserves unrelated metadata.
- Deleting a todo removes it from the list immediately after successful response.
- Due-date validation uses Singapore timezone and rejects dates less than 1 minute ahead.
- All queries are user-scoped through the current session.

## Testing Requirements

### E2E
- Register/login and create a todo with title only.
- Create a todo with title, priority, and due date.
- Edit a todo title.
- Toggle completion on and off.
- Delete a todo.
- Attempt to create with whitespace title and verify validation.
- Attempt to create with past due date and verify validation.
- Verify overdue/pending/completed section placement.

### Unit / Integration
- Title trimming and validation.
- Due date validation using Singapore current time.
- Sorting logic by priority and due date.
- DB methods return expected todo shape.

## Out of Scope
- Bulk edit or bulk delete
- Drag-and-drop ordering
- Multi-user shared todos
- Rich text descriptions

## Success Metrics
- Todo create/edit/delete actions complete without page reload.
- Validation blocks malformed input before corrupting state.
- Section grouping matches documented user guide behavior.
- This feature provides the stable base needed for the other 10 PRPs.

## Evaluation Alignment

### Required Implementation Checklist
- Database schema created with all required fields
- API endpoint: `POST /api/todos`
- API endpoint: `GET /api/todos`
- API endpoint: `GET /api/todos/[id]`
- API endpoint: `PUT /api/todos/[id]`
- API endpoint: `DELETE /api/todos/[id]`
- Singapore timezone validation for due dates
- Todo title validation: non-empty and trimmed
- Due date must be at least 1 minute in the future
- UI form for creating todos
- UI display in sections: Overdue, Active, Completed
- Toggle completion checkbox
- Edit todo modal or form
- Delete confirmation dialog
- Optimistic UI updates for create, update, toggle, and delete

### Required Testing
- E2E: create todo with title only
- E2E: create todo with all metadata
- E2E: edit todo
- E2E: toggle completion
- E2E: delete todo
- E2E: past due date validation

### Required Acceptance Criteria
- Can create todo with just title
- Can create todo with priority, due date, recurring, and reminder
- Todos sorted by priority and due date
- Completed todos move to Completed section
- Delete cascades to subtasks and tags
