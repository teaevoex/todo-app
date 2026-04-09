# PRP 09: Export & Import

## Feature Overview
Implement todo data export and import for backup and restore. Export should preserve the user's todo graph, including subtasks and tags. Import should validate payloads, remap IDs safely, and restore relationships without corrupting current data.

## User Stories
- As a user, I want to export my todos so I can create backups.
- As a user, I want to import a previous backup to restore my data.
- As a user, I want tags and subtasks preserved during backup and restore.

## User Flow
1. User clicks `Export Todos`.
2. User chooses or receives a downloaded file, such as JSON.
3. User later clicks `Import Todos` and selects a backup file.
4. System validates the file.
5. System creates imported todos, subtasks, and tags for the current user.
6. UI refreshes and shows restored data.

## Technical Requirements

### Export Format
Primary supported format must be JSON. CSV export can exist for convenience but import only needs JSON unless the product explicitly adds CSV import later.

Suggested JSON structure:
```json
{
  "exported_at": "2025-11-02T10:30:00",
  "version": 1,
  "todos": [],
  "subtasks": [],
  "tags": [],
  "todo_tags": []
}
```

Include enough fields to preserve:
- titles
- completion state
- priority
- due dates
- recurrence settings
- reminder offsets
- subtasks
- tag definitions
- todo-tag relationships

### API Endpoints
- `GET /api/todos/export`
- `POST /api/todos/import`

### Import Rules
During import:
1. Authenticate current user.
2. Validate file structure and required keys.
3. Create a mapping from old IDs to new IDs.
4. Recreate tags first, but resolve tag name conflicts by reusing an existing user tag when names match.
5. Recreate todos.
6. Recreate subtasks using remapped todo IDs.
7. Recreate join-table records using remapped todo IDs and tag IDs.

### Validation
- Reject malformed JSON.
- Reject unexpected shapes or missing arrays.
- Reject impossible enum values for priority/recurrence.
- Sanitize strings and trim relevant text.
- Prevent imported user IDs from overriding the current session user.

### Data Ownership
All imported records must belong to the currently authenticated user regardless of source data.

## UI Components
- `Export Todos` button
- `Import Todos` button or file picker
- Import status messaging:
  - success summary
  - validation failure message
  - loading state

## Edge Cases
- Backup file contains duplicate tag names.
- Backup file has missing linked records.
- File is valid JSON but wrong schema.
- Import file is very large.
- User imports into a non-empty account.
- Exported data contains recurring todos and reminders.

## Acceptance Criteria
- User can export current data as JSON.
- Import validates payload structure before writing records.
- Import remaps IDs and preserves relationships.
- Imported tags, subtasks, and todo-tag links work correctly.
- Imported records belong to the current user.
- Failure paths produce clear error feedback without partial silent corruption.

## Testing Requirements

### E2E
- Export todos with tags and subtasks.
- Delete or clear data, then import the exported file.
- Verify restored todos, subtasks, and tags.
- Import invalid JSON and verify error.
- Import JSON with invalid schema and verify error.

### Unit / Integration
- Export serializer shape
- Import validator
- ID remapping logic
- Relationship restoration for subtasks and tag joins

## Out of Scope
- Import from third-party task apps
- Merge conflict resolution UI
- Incremental sync
- End-to-end encrypted backup archives

## Success Metrics
- Users can reliably back up and restore their task data.
- Relationship integrity survives round-trip export/import.
- Import validation prevents malformed files from damaging application state.

## Evaluation Alignment

### Required Implementation Checklist
- API endpoint: `GET /api/todos/export`
- API endpoint: `POST /api/todos/import`
- Export button in UI
- Import button with file picker
- JSON format with version field
- Export includes todos, subtasks, tags, and associations
- Import validation for format and required fields
- ID remapping on import
- Tag name conflict resolution by reusing existing tags
- Success message with counts
- Error handling for invalid JSON

### Required Testing
- E2E: export todos
- E2E: import valid file
- E2E: import invalid JSON and show error
- E2E: import preserves all data
- E2E: imported todos appear immediately
- Unit test: ID remapping logic
- Unit test: JSON validation

### Required Acceptance Criteria
- Export creates valid JSON
- Import validates format
- All relationships preserved
- No duplicate tags created
- Error messages clear
