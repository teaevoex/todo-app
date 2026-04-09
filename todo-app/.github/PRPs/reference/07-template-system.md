# PRP 07: Template System

## Feature Overview
Implement reusable todo templates that allow users to save a common todo pattern and instantiate it later. Templates are intended for repeatable workflows and should preserve relevant metadata while avoiding stale date data.

## User Stories
- As a user, I want to save a frequently used todo setup as a template so I can recreate it quickly.
- As a user, I want template categories and descriptions so I can organize my template library.
- As a user, I want creating a todo from a template to feel instant.

## User Flow
1. User fills out the todo form with title and settings.
2. User clicks `Save as Template`.
3. User enters template name, optional description, and optional category.
4. Template is stored in the user's library.
5. User later chooses a template from dropdown or template manager.
6. System creates a new todo using template defaults.

## Technical Requirements

### Data Model
Create a `templates` table with at minimum:
- `id`
- `user_id`
- `name`
- `description`
- `category`
- `title_template`
- `priority`
- `is_recurring`
- `recurrence_pattern`
- `reminder_minutes`
- `subtasks_json`
- `created_at`
- `updated_at`

`subtasks_json` should serialize an ordered array like:
```json
[
  { "title": "Create slides", "position": 0 },
  { "title": "Rehearse speech", "position": 1 }
]
```

### Validation
- Template name is required.
- Template name may be unique per user for simplicity if desired.
- Template can be created only by the owner.
- Due dates are not stored as fixed timestamps in the template.

### API Endpoints
- `GET /api/templates`
- `POST /api/templates`
- `PUT /api/templates/[id]`
- `DELETE /api/templates/[id]`
- `POST /api/templates/[id]/use`

### Use Logic
When using a template:
1. Create a new todo for the current user.
2. Apply:
   - title
   - priority
   - recurrence settings
   - reminder offset
3. Recreate subtasks from `subtasks_json` if included.
4. Do not copy historical IDs.
5. Do not reuse stale timestamps.

Implement due date offset calculation for template usage to satisfy evaluation criteria. Store relative due-date intent rather than a stale absolute timestamp. If the current UI only saves settings without dates, explicitly define a nullable offset model and the use-flow behavior.

## UI Components
- `Save as Template` button visible when the form has enough content to save
- Save-template modal:
  - name
  - description
  - category
- `Use Template` dropdown in todo form
- Template manager modal with:
  - list of templates
  - preview metadata
  - use button
  - delete button

## Display Requirements
Each template preview should show:
- name
- description if provided
- category if provided
- priority badge
- recurrence badge if recurring
- reminder badge if reminder exists

## Edge Cases
- User saves a template with no meaningful title content.
- Malformed `subtasks_json`.
- Template created from a todo with no subtasks.
- Deleted template should not affect already created todos.
- User uses a template repeatedly in quick succession.

## Acceptance Criteria
- User can save a configured todo as a template.
- User can browse templates and create a new todo from one.
- Template metadata persists correctly.
- Subtasks are recreated in the correct order when present.
- Deleting a template removes only the template, not todos already created from it.

## Testing Requirements

### E2E
- Save a todo as a template.
- Use a template from the dropdown.
- Use a template from the template manager.
- Verify priority, recurrence, and reminder values are preserved.
- Verify subtasks are recreated.
- Delete a template and ensure existing todos remain.

### Unit / Integration
- Serialize and parse `subtasks_json`
- Validate template payloads
- Create-from-template flow produces new IDs and clean timestamps

## Out of Scope
- Shared team templates
- Version history for templates
- Template favorites or usage analytics
- Full template inheritance trees

## Success Metrics
- Repeatable workflows become one-click todo creation.
- Template storage is stable and easy to maintain.
- No stale due-date or ID data leaks into generated todos.

## Evaluation Alignment

### Required Implementation Checklist
- Database: `templates` table
- API endpoint: `GET /api/templates`
- API endpoint: `POST /api/templates`
- API endpoint: `PUT /api/templates/[id]`
- API endpoint: `DELETE /api/templates/[id]`
- API endpoint: `POST /api/templates/[id]/use`
- `Save as Template` button
- Save-template modal with name, description, category
- `Use Template` button
- Template selection modal
- Category filter in template modal
- Template preview showing settings
- Subtasks JSON serialization
- Due date offset calculation

### Required Testing
- E2E: save todo as template
- E2E: create todo from template
- E2E: template preserves settings
- E2E: subtasks created from template
- E2E: edit template
- E2E: delete template
- Unit test: subtasks JSON serialization

### Required Acceptance Criteria
- Can save current todo as template
- Templates include all metadata
- Using template creates new todo
- Subtasks recreated from JSON
- Category filtering works
