# PRP 06: Tag System

## Feature Overview
Implement user-specific, color-coded tags that can be created, edited, deleted, assigned to todos, and used for filtering. Tags allow flexible categorization beyond fixed priority levels.

## User Stories
- As a user, I want custom tags like `work` or `urgent` so I can categorize tasks in my own way.
- As a user, I want to assign multiple tags to one todo.
- As a user, I want colored pills so I can visually scan categories quickly.
- As a user, I want to filter by tag to focus on a subset of my tasks.

## User Flow
1. User clicks `Manage Tags`.
2. User creates a tag with a name and color.
3. User sees tags in a management modal.
4. User selects one or more tags while creating or editing a todo.
5. Todo displays tag pills.
6. User filters todos by a chosen tag.
7. User edits or deletes existing tags later.

## Technical Requirements

### Data Model
Create:
- `tags`
  - `id`
  - `user_id`
  - `name`
  - `color`
  - `created_at`
- `todo_tags`
  - `todo_id`
  - `tag_id`

Constraints:
- Tag name unique per user
- Many-to-many relationship between todos and tags

Shared type example:
```ts
export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}
```

### Validation
- Tag name required and trimmed.
- Tag name unique per user, case-insensitive if possible.
- Color should be a valid hex string like `#3B82F6`.
- Only owner can update or delete a tag.

### API Endpoints
- `GET /api/tags`
- `POST /api/tags`
- `PUT /api/tags/[id]`
- `DELETE /api/tags/[id]`
- `POST /api/todos/[id]/tags`
- `DELETE /api/todos/[id]/tags`

Alternative assignment design is acceptable if API shape stays clean and auth-scoped.

## UI Components
- `Manage Tags` button
- Tag management modal
- Form fields:
  - name
  - color picker
  - hex input
- Tag list with edit and delete actions
- Tag selection pills in create/edit todo form
- Tag pills rendered on todos
- Tag filter dropdown in filter controls

## Behavior Rules
- Multiple tags can be attached to a single todo.
- Deleting a tag removes its join rows from todos.
- Editing a tag updates how it displays everywhere.
- Tag filter combines with other filters using AND logic.
- Tags are user-specific; one user must not see another user's tags.

## Edge Cases
- Duplicate tag name attempt.
- Invalid hex color submitted manually.
- Deleting a tag used by many todos.
- Todo with zero tags.
- Long tag names should wrap or truncate gracefully on mobile.

## Acceptance Criteria
- User can create, edit, and delete tags.
- User can assign multiple tags to a todo.
- Tag pills render with chosen colors.
- Duplicate tag names are rejected per user.
- Deleting a tag removes it from all todos without deleting the todos themselves.
- Tag filter shows only todos containing that tag.

## Testing Requirements

### E2E
- Create a tag with default color.
- Create a tag with custom color.
- Edit tag name and color.
- Assign multiple tags to one todo.
- Filter by tag.
- Delete a tag and verify it disappears from todos.
- Verify duplicate tag creation is rejected.

### Unit / Integration
- Tag name normalization and uniqueness check
- Hex color validation
- Join-table assignment logic
- Delete cleanup of `todo_tags`

## Out of Scope
- Hierarchical tags
- Tag sharing between users
- Tag analytics
- Automatic tag suggestions

## Success Metrics
- Users gain flexible categorization without hurting core todo simplicity.
- Tag CRUD and assignment remain consistent and low-friction.
- Filtering integrates cleanly with the broader search/filter feature.

## Evaluation Alignment

### Required Implementation Checklist
- Database tables: `tags` and `todo_tags`
- API endpoint: `GET /api/tags`
- API endpoint: `POST /api/tags`
- API endpoint: `PUT /api/tags/[id]`
- API endpoint: `DELETE /api/tags/[id]`
- API endpoint: `POST /api/todos/[id]/tags`
- API endpoint: `DELETE /api/todos/[id]/tags`
- `Manage Tags` modal
- Tag creation form with name and color picker
- Tag list with edit and delete buttons
- Tag selection in todo form
- Tag badges on todos
- Click tag badge to filter by tag
- Tag filter indicator with clear button

### Required Testing
- E2E: create tag
- E2E: edit tag name and color
- E2E: delete tag
- E2E: assign multiple tags to todo
- E2E: filter by tag
- E2E: duplicate tag name validation
- Unit test: tag name validation

### Required Acceptance Criteria
- Tags unique per user
- Custom colors work
- Editing tag updates all todos
- Deleting tag removes from todos
- Filter works correctly
