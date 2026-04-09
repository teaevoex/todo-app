# PRP 05: Subtasks & Progress Tracking

## Feature Overview
Implement subtasks as lightweight checklist items under a todo, with expandable UI, independent completion toggles, and a visual progress indicator on the parent todo.

## User Stories
- As a user, I want to split a large todo into smaller steps so it feels manageable.
- As a user, I want to track subtask progress visually.
- As a user, I want subtasks deleted automatically when the parent todo is deleted.

## User Flow
1. User opens a todo item.
2. User expands the subtasks section.
3. User enters one or more subtask titles and adds them.
4. User toggles subtask completion as work progresses.
5. Parent todo shows updated progress bar and count text.
6. User can delete a subtask or collapse the section.

## Technical Requirements

### Data Model
Create a `subtasks` table with at minimum:
- `id`
- `todo_id`
- `title`
- `completed`
- `position`
- `created_at`

Relationships:
- `todos` 1-to-many `subtasks`
- CASCADE delete from parent todo

Shared type example:
```ts
export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}
```

### Validation
- Subtask title is required and trimmed.
- Empty or whitespace-only titles are invalid.
- Subtask must belong to a todo owned by the current user.

### API Endpoints
- `POST /api/todos/[id]/subtasks`
- `PUT /api/subtasks/[id]`
- `DELETE /api/subtasks/[id]`

Optional support:
- `GET /api/todos` may embed subtasks, or UI may fetch them separately. Prefer returning them with todos if it keeps the monolithic page simpler.

### Progress Calculation
For each todo:
- completed count = subtasks where `completed = true`
- total count = all subtasks
- percentage = `completed / total * 100`

Display:
- progress bar
- text summary, for example `1/2 subtasks`

Suggested color behavior:
- blue while incomplete
- green at 100%

## UI Components
- Expand/collapse button on todo
- Subtask input field and add button
- Subtask list with:
  - checkbox
  - title
  - delete button
- Parent progress bar under the todo title area

## Behavior Rules
- Subtask completion does not automatically complete the parent todo.
- Parent todo can be completed even if subtasks remain incomplete unless product decision says otherwise; current guide does not require blocking.
- Order uses `position`.
- New subtasks append to the end.

## Edge Cases
- Todo has zero subtasks: no bar or show empty-state gracefully.
- User adds many subtasks.
- User deletes a middle subtask and positions should remain stable or be normalized safely.
- Search feature later must include subtask titles.
- Parent delete must remove all subtasks.

## Acceptance Criteria
- Users can add unlimited subtasks to a todo.
- Users can complete or uncomplete subtasks independently.
- Progress updates immediately after subtask changes.
- Progress bar percentage matches text summary.
- Deleting a parent todo removes all child subtasks.

## Testing Requirements

### E2E
- Expand a todo and add multiple subtasks.
- Toggle completion and verify progress changes.
- Delete a subtask.
- Collapse and re-expand subtasks.
- Delete a todo and verify subtasks disappear with it.

### Unit / Integration
- Subtask title validation
- Progress percentage calculation
- Cascade delete DB behavior
- Position assignment for appended subtasks

## Out of Scope
- Nested subtasks
- Drag-and-drop reordering
- Assigning subtasks to different users
- Rich metadata on subtasks

## Success Metrics
- Complex todos become easier to break down.
- Progress display is accurate and responsive.
- Data integrity is preserved through cascade delete behavior.

## Evaluation Alignment

### Required Implementation Checklist
- Database `subtasks` table with CASCADE delete
- API endpoint: `POST /api/todos/[id]/subtasks`
- API endpoint: `PUT /api/subtasks/[id]`
- API endpoint: `DELETE /api/subtasks/[id]`
- Expandable subtasks section in UI
- Add subtask input field
- Subtask checkboxes
- Delete subtask button
- Progress bar component
- Progress calculation: `(completed / total) * 100`
- Progress display in `X/Y completed (Z%)` format
- Green bar at 100 percent, blue otherwise

### Required Testing
- E2E: expand subtasks section
- E2E: add multiple subtasks
- E2E: toggle subtask completion
- E2E: progress bar updates
- E2E: delete subtask
- E2E: delete todo cascades to subtasks
- Unit test: progress calculation

### Required Acceptance Criteria
- Can add unlimited subtasks
- Can toggle completion
- Progress updates in real time
- Visual progress bar accurate
- Cascade delete works
