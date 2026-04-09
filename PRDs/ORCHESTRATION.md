# Multi-Agent Orchestration Plan: Todo App

## Overview

This document defines the complete multi-agent build strategy for an 11-feature Next.js 16 todo application. The build is organized into 6 phases (Phase 0 through Phase 5), with features built in parallel where dependencies allow. Each feature is assigned to a Claude Code agent pipeline that follows a strict read-plan-build-review-verify protocol. Agent memory files ensure continuity between phases so downstream agents can adapt to upstream decisions.

## Table of Contents

1. [Phase Breakdown](#1-phase-breakdown)
2. [Verification Gates](#2-verification-gates)
3. [Agent Execution Protocol](#3-agent-execution-protocol)
4. [Agent Memory Format](#4-agent-memory-format)
5. [Conflict Resolution](#5-conflict-resolution)
6. [PRP File Requirements](#6-prp-file-requirements)
7. [Rollback Strategy](#7-rollback-strategy)
8. [Appendix: File Ownership Map](#appendix-file-ownership-map)

---

## 1. Phase Breakdown

### Phase 0: Foundation (Sequential, MUST complete first)

**Purpose:** Establish shared infrastructure that all feature agents depend on. No feature code yet -- only scaffolding, types, tokens, and skeleton modules.

| Task | Agent | Model | Complexity | Notes |
|------|-------|-------|------------|-------|
| Project scaffold (next.config.ts, tsconfig.json, package.json, tailwind.config.ts, components.json) | architect | Opus | Medium | Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui |
| Design token system (app/globals.css shadcn variables + lib/tokens/ for tag palette) | architect | Opus | Low | shadcn HSL CSS variables, .dark class for dark mode; custom extensions for priority + semantic tokens |
| shadcn/ui component setup (components/ui/) | architect | Opus | Low | Run `npx shadcn init` + `npx shadcn add button badge dialog input label select checkbox progress card separator tabs dropdown-menu` |
| Shared types (lib/types/index.ts) | architect | Opus | Medium | Todo, Subtask, Tag, Template, User, Priority, RecurrencePattern, ReminderMinutes |
| Database infrastructure (lib/db/connection.ts, lib/db/migrations.ts) | architect | Opus | Medium | better-sqlite3 setup, migration runner, table creation |
| Domain DB skeletons (lib/db/todos.ts, lib/db/tags.ts, lib/db/subtasks.ts, lib/db/templates.ts, lib/db/users.ts, lib/db/holidays.ts) | architect | Opus | Medium | Export empty DB objects with method signatures matching types |
| API client skeleton (lib/api/client.ts, lib/api/todos.ts, lib/api/tags.ts, etc.) | architect | Opus | Medium | Typed fetch wrappers, base URL config |
| Timezone utility (lib/timezone.ts) | architect | Opus | Low | getSingaporeNow, formatSingaporeDate, toSingaporeISO |
| Auth context skeleton (lib/auth.ts, middleware.ts placeholder) | architect | Opus | Low | getSession/createSession/deleteSession signatures |
| Contract interfaces file (contracts/interfaces.ts) | architect | Opus | High | Every cross-feature interface, exported for import by feature agents |
| Layout & app shell (app/layout.tsx, app/globals.css) | architect | Opus | Low | Root layout with providers, design tokens CSS |
| Playwright config (playwright.config.ts, tests/helpers.ts) | architect | Opus | Low | Virtual authenticator, Singapore timezone, base helpers |
| TanStack Query provider (lib/providers/query-provider.tsx) | architect | Opus | Low | QueryClient config, hydration boundary |

**Deliverables:**
- Clean `npm run build` passes with no errors
- All type exports resolve
- Contract interfaces file is complete
- Empty DB modules importable without runtime errors
- shadcn/ui components available in `components/ui/`; `components.json` configured
- shadcn CSS variables applied to app shell via `app/globals.css`; dark mode working via `.dark` class

**Estimated total context:** ~15,000 tokens (well within Opus limits)

---

### Phase 1: Foundation Features (Parallel, after Phase 0)

Two features with no inter-dependencies, built simultaneously.

#### 1a. Feature 11 -- WebAuthn Authentication

| Step | Agent | Model | Notes |
|------|-------|-------|-------|
| Plan | planner | Opus | Complex crypto + session management warrants Opus planning |
| Build | tdd-guide | Opus | WebAuthn challenge/response, JWT, middleware -- requires deep reasoning |
| Review | code-reviewer | Opus | Security-critical code |
| Security | security-reviewer | Opus | MANDATORY for auth feature |

**Files owned:**
- `lib/db/users.ts` (implementation)
- `lib/db/authenticators.ts` (new)
- `lib/auth.ts` (implementation)
- `middleware.ts` (implementation)
- `app/login/page.tsx`
- `app/api/auth/register-options/route.ts`
- `app/api/auth/register-verify/route.ts`
- `app/api/auth/login-options/route.ts`
- `app/api/auth/login-verify/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `tests/01-authentication.spec.ts`

**Complexity:** HIGH -- WebAuthn protocol, base64url encoding, JWT signing, cookie security
**Estimated context:** ~20,000 tokens

#### 1b. Feature 01 -- Todo CRUD

| Step | Agent | Model | Notes |
|------|-------|-------|-------|
| Plan | planner | Sonnet | Straightforward CRUD patterns |
| Build | tdd-guide | Sonnet | Standard REST + React form |
| Review | code-reviewer | Sonnet | Standard quality checks |

**Files owned:**
- `lib/db/todos.ts` (implementation)
- `lib/api/todos.ts` (implementation)
- `app/api/todos/route.ts`
- `app/api/todos/[id]/route.ts`
- `app/components/todo-form.tsx`
- `app/components/todo-list.tsx`
- `app/components/todo-item.tsx`
- `app/page.tsx` (initial implementation)
- `lib/hooks/useTodos.ts` (TanStack Query hook)
- `tests/02-todo-crud.spec.ts`

**Complexity:** MEDIUM -- Standard CRUD, but establishes patterns all other features follow
**Estimated context:** ~12,000 tokens

---

### Phase 2: Core Extensions (Parallel, after Phase 1 completes)

Three features that depend only on Todo CRUD being complete.

#### 2a. Feature 02 -- Priority System

| Step | Agent | Model |
|------|-------|-------|
| Plan | planner | Sonnet |
| Build | tdd-guide | Sonnet |
| Review | code-reviewer | Sonnet |

**Depends on:** Phase 1b (Todo CRUD) -- needs todo table, API routes, UI components
**Files owned:**
- Extends `lib/db/todos.ts` (adds priority column via migration)
- `app/components/priority-badge.tsx`
- `app/components/priority-filter.tsx`
- Modifies `app/components/todo-form.tsx` (adds priority dropdown)
- Modifies `app/components/todo-item.tsx` (adds priority badge)
- `tests/03-priority.spec.ts`

**Complexity:** LOW
**Estimated context:** ~6,000 tokens

#### 2b. Feature 03 -- Recurring Todos

| Step | Agent | Model |
|------|-------|-------|
| Plan | planner | Sonnet |
| Build | tdd-guide | Sonnet |
| Review | code-reviewer | Sonnet |

**Depends on:** Phase 1b (Todo CRUD)
**Files owned:**
- Extends `lib/db/todos.ts` (adds recurrence columns via migration)
- `lib/recurrence.ts` (next due date calculation logic)
- Modifies `app/components/todo-form.tsx` (adds recurrence UI)
- Modifies `app/api/todos/[id]/route.ts` PUT handler (completion creates next instance)
- `tests/04-recurring.spec.ts`

**Complexity:** MEDIUM -- date calculation logic with Singapore timezone
**Estimated context:** ~8,000 tokens

#### 2c. Feature 05 -- Subtasks & Progress

| Step | Agent | Model |
|------|-------|-------|
| Plan | planner | Sonnet |
| Build | tdd-guide | Sonnet |
| Review | code-reviewer | Sonnet |

**Depends on:** Phase 1b (Todo CRUD)
**Files owned:**
- `lib/db/subtasks.ts` (implementation)
- `lib/api/subtasks.ts` (implementation)
- `app/api/todos/[id]/subtasks/route.ts`
- `app/api/subtasks/[id]/route.ts`
- `app/components/subtask-list.tsx`
- `app/components/progress-bar.tsx`
- `lib/hooks/useSubtasks.ts`
- `tests/05-subtasks.spec.ts`

**Complexity:** MEDIUM -- position management, cascade delete, progress calculation
**Estimated context:** ~10,000 tokens

---

### Phase 3: Organization Features (Parallel, after Phase 2 completes)

Two features. Tags needs CRUD complete; Reminders needs CRUD complete.

#### 3a. Feature 04 -- Reminders & Notifications

| Step | Agent | Model |
|------|-------|-------|
| Plan | planner | Sonnet |
| Build | tdd-guide | Sonnet |
| Review | code-reviewer | Sonnet |

**Depends on:** Phase 1b (Todo CRUD) -- needs due_date field functional
**Files owned:**
- Extends `lib/db/todos.ts` (adds reminder_minutes, last_notification_sent columns)
- `lib/hooks/useNotifications.ts`
- `app/api/notifications/check/route.ts`
- `app/components/reminder-select.tsx`
- `app/components/notification-button.tsx`
- `tests/06-reminders.spec.ts`

**Complexity:** MEDIUM -- browser Notification API, polling, Singapore timezone math
**Estimated context:** ~8,000 tokens

#### 3b. Feature 06 -- Tag System

| Step | Agent | Model |
|------|-------|-------|
| Plan | planner | Sonnet |
| Build | tdd-guide | Sonnet |
| Review | code-reviewer | Sonnet |

**Depends on:** Phase 1b (Todo CRUD)
**Files owned:**
- `lib/db/tags.ts` (implementation)
- `lib/db/todo-tags.ts` (junction table)
- `lib/api/tags.ts` (implementation)
- `app/api/tags/route.ts`
- `app/api/tags/[id]/route.ts`
- `app/api/todos/[id]/tags/route.ts`
- `app/components/tag-badge.tsx`
- `app/components/tag-manager.tsx`
- `app/components/tag-picker.tsx`
- `lib/hooks/useTags.ts`
- `tests/07-tags.spec.ts`

**Complexity:** MEDIUM -- many-to-many relationships, color picker, filter integration
**Estimated context:** ~10,000 tokens

---

### Phase 4: Dependent Features (Parallel, after Phase 3 completes)

Two features that require outputs from Phase 2 and Phase 3.

#### 4a. Feature 07 -- Template System

| Step | Agent | Model |
|------|-------|-------|
| Plan | planner | Sonnet |
| Build | tdd-guide | Sonnet |
| Review | code-reviewer | Sonnet |

**Depends on:** Feature 05 (Subtasks) + Feature 06 (Tags) -- templates store subtask JSON and tag references
**Files owned:**
- `lib/db/templates.ts` (implementation)
- `lib/api/templates.ts` (implementation)
- `app/api/templates/route.ts`
- `app/api/templates/[id]/route.ts`
- `app/api/templates/[id]/use/route.ts`
- `app/components/template-modal.tsx`
- `app/components/save-template-form.tsx`
- `lib/hooks/useTemplates.ts`
- `tests/08-templates.spec.ts`

**Complexity:** MEDIUM -- JSON serialization of subtasks, due date offset math
**Estimated context:** ~10,000 tokens

#### 4b. Feature 08 -- Search & Filtering

| Step | Agent | Model |
|------|-------|-------|
| Plan | planner | Sonnet |
| Build | tdd-guide | Sonnet |
| Review | code-reviewer | Sonnet |

**Depends on:** Feature 06 (Tags) + Feature 02 (Priority) -- searches across tags and filters by priority
**Files owned:**
- `app/components/search-bar.tsx`
- `app/components/filter-controls.tsx`
- `app/components/filter-summary.tsx`
- `lib/hooks/useSearch.ts` (debounced search)
- `lib/hooks/useFilters.ts` (combined filter state)
- `tests/09-search.spec.ts`

**Complexity:** LOW-MEDIUM -- client-side filtering, debounce, combined filter logic
**Estimated context:** ~8,000 tokens

---

### Phase 5: Independent Views (Parallel, after Phase 1 completes)

These features depend only on Todo CRUD (Phase 1b) and can start as soon as Phase 1 passes verification. They run in parallel with Phases 2-4 if desired, or after Phase 4 if sequential execution is preferred.

#### 5a. Feature 09 -- Export & Import

| Step | Agent | Model |
|------|-------|-------|
| Plan | planner | Sonnet |
| Build | tdd-guide | Sonnet |
| Review | code-reviewer | Sonnet |

**Depends on:** Feature 01 (CRUD), Feature 05 (Subtasks), Feature 06 (Tags) -- exports all relationships
**Note:** If running in parallel with Phases 2-4, this must wait until Phase 3 completes (tags + subtasks available).
**Files owned:**
- `app/api/todos/export/route.ts`
- `app/api/todos/import/route.ts`
- `app/components/export-button.tsx`
- `app/components/import-button.tsx`
- `lib/export.ts` (serialization logic)
- `lib/import.ts` (deserialization + ID remapping)
- `tests/10-export-import.spec.ts`

**Complexity:** MEDIUM -- ID remapping, relationship preservation, validation
**Estimated context:** ~10,000 tokens

#### 5b. Feature 10 -- Calendar View

| Step | Agent | Model |
|------|-------|-------|
| Plan | planner | Sonnet |
| Build | tdd-guide | Sonnet |
| Review | code-reviewer | Sonnet |

**Depends on:** Feature 01 (CRUD) -- displays todos by due date
**Files owned:**
- `lib/db/holidays.ts` (implementation)
- `lib/api/holidays.ts` (implementation)
- `app/api/holidays/route.ts`
- `app/calendar/page.tsx`
- `app/components/calendar-grid.tsx`
- `app/components/calendar-day.tsx`
- `app/components/calendar-nav.tsx`
- `app/components/day-modal.tsx`
- `scripts/seed-holidays.ts`
- `lib/hooks/useCalendar.ts`
- `tests/11-calendar.spec.ts`

**Complexity:** MEDIUM -- calendar generation, holiday seeding, URL state management
**Estimated context:** ~10,000 tokens

---

### Phase Summary Table

| Phase | Features | Parallelism | Gate | Total Agents |
|-------|----------|-------------|------|-------------|
| 0 | Foundation | Sequential (1 architect) | Build passes, types resolve | 1 |
| 1 | 11-Auth, 01-CRUD | 2 parallel | Build + tests + contracts | 2 |
| 2 | 02-Priority, 03-Recurring, 05-Subtasks | 3 parallel | Build + tests + contracts | 3 |
| 3 | 04-Reminders, 06-Tags | 2 parallel | Build + tests + contracts | 2 |
| 4 | 07-Templates, 08-Search | 2 parallel | Build + tests + contracts | 2 |
| 5 | 09-Export, 10-Calendar | 2 parallel | Build + tests + all E2E | 2 |

**Total sequential phases:** 6
**Maximum parallel agents within a phase:** 3

---

## 2. Verification Gates

Every phase transition requires ALL of the following checks to pass. No feature agent from the next phase may start until the gate is green.

### Gate Protocol

```
VERIFICATION GATE: Phase N -> Phase N+1
========================================

1. BUILD CHECK
   Command: npm run build
   Criteria: Exit code 0, no errors
   Timeout: 120 seconds
   On failure: Invoke build-error-resolver agent (Opus)

2. TYPESCRIPT CHECK
   Command: npx tsc --noEmit
   Criteria: Exit code 0, zero type errors
   Timeout: 60 seconds
   On failure: Invoke build-error-resolver agent (Opus)

3. LINT CHECK
   Command: npm run lint
   Criteria: Exit code 0, no errors (warnings acceptable)
   Timeout: 30 seconds
   On failure: Fix lint errors before proceeding

4. TEST CHECK
   Command: npx playwright test
   Criteria: All existing test files pass (100% pass rate)
   Timeout: 300 seconds
   On failure: Invoke tdd-guide agent to diagnose

5. CONTRACT CHECK
   Manual verification: All interfaces in contracts/interfaces.ts
   that the completed phase was supposed to implement are now
   satisfied by actual exports from lib/db/*, lib/api/*, and
   app/api/**. No interface has `TODO` or `stub` markers.
   On failure: Feature agent must complete implementation

6. CODE REVIEW
   Agent: code-reviewer (Sonnet for standard features, Opus for auth)
   Criteria: No CRITICAL or HIGH issues in modified files
   On failure: Fix issues before gate passes

7. SECURITY REVIEW (Phases 1, 4, 5 only -- when auth, API, or import is involved)
   Agent: security-reviewer (Opus)
   Criteria: No CRITICAL issues, all HIGH issues addressed
   On failure: Fix before proceeding

8. AGENT MEMORY CHECK
   Verify: Every feature agent that completed in this phase has
   written its memory file to PRDs/agents/phaseN-featureNN.md
   Criteria: File exists and follows the Agent Memory Format
   On failure: Agent must write memory before gate passes
```

### Phase-Specific Gate Additions

| Phase | Additional Gate Checks |
|-------|----------------------|
| 0 | Design tokens render correctly in browser (visual check). Contract interfaces file has no TODO placeholders. |
| 1 | Auth flow works end-to-end (register + login + logout). Todo CRUD works end-to-end (create + read + update + delete). Middleware correctly protects routes. |
| 2 | Priority sorting verified. Recurring todo completion creates next instance. Subtask progress bar renders correctly. |
| 3 | Browser notification permission flow works. Tag CRUD works. Tag filter works. Many-to-many relationships verified. |
| 4 | Template save/use round-trip works. Combined search + filter with tags and priority works. |
| 5 | Export produces valid JSON with all relationships. Import remaps IDs correctly. Calendar renders current month with holidays. |

---

## 3. Agent Execution Protocol

Every feature agent follows this exact sequence. No step may be skipped.

### Step 1: READ (Context Loading)

```
Agent reads in this exact order:
1. ARCHITECTURE.md (if exists) or .github/copilot-instructions.md
2. contracts/interfaces.ts
3. PRDs/<feature-number>-<feature-name>.md (the PRP file)
4. PRDs/agents/phase*-*.md (ALL previous phase memory files)
5. lib/types/index.ts (shared types)
6. lib/db/connection.ts (DB patterns)
7. Any existing files the feature will modify

Total read budget: ~5,000 tokens of context
```

### Step 2: PLAN (Implementation Planning)

```
Invoke: planner agent
Input: PRP file + contract interfaces + previous agent memories
Output: Detailed implementation plan with:
  - File-by-file changes
  - Database migration SQL
  - API endpoint signatures
  - Component tree
  - Test specifications
  - Risk assessment

The plan MUST be reviewed by the human operator before proceeding.
Write plan to: PRDs/agents/phaseN-featureNN-plan.md (temporary)
```

### Step 3: BUILD (TDD Implementation)

```
Invoke: tdd-guide agent
Workflow per component:
  a. Write test first (E2E for user flows, unit for logic)
  b. Run test -- verify it FAILS
  c. Write minimal implementation to pass
  d. Run test -- verify it PASSES
  e. Refactor if needed
  f. Run all tests -- verify no regressions

Build order within a feature:
  1. Database migration + DB module
  2. API routes
  3. API client functions
  4. TanStack Query hooks
  5. React components
  6. E2E tests
  7. Integration between components
```

### Step 4: REVIEW (Code Quality)

```
Invoke: code-reviewer agent
Scope: All files created or modified by this feature agent
Checklist:
  - No functions > 50 lines
  - No files > 800 lines
  - No deep nesting > 4 levels
  - Immutable patterns used (no mutation)
  - Error handling present on all async operations
  - No console.log statements
  - No hardcoded values
  - Proper TypeScript types (no `any`)
  - shadcn CSS variables used for all colors (bg-background, text-foreground, bg-muted, etc.); no hardcoded hex values in className
  - Singapore timezone used for all dates

Fix: All CRITICAL and HIGH issues before proceeding
```

### Step 5: SECURITY (For auth, API, and import features)

```
Invoke: security-reviewer agent (Opus)
Required for: Features 11, 01, 04, 09 (auth, CRUD, notifications, import)
Recommended for: All features with API routes

Checklist:
  - No hardcoded secrets
  - All user inputs validated
  - SQL injection prevention (prepared statements)
  - XSS prevention (React escaping + sanitization)
  - Authentication checked on all protected routes
  - Session.userId used for all DB queries (no data leakage)
  - Error messages do not leak sensitive data
  - Rate limiting considerations noted
```

### Step 6: WRITE (Agent Memory)

```
Write to: PRDs/agents/phaseN-featureNN.md
Format: See Section 4 (Agent Memory Format)

This file is the primary handoff mechanism to downstream agents.
It MUST be written before the verification gate.
```

### Step 7: VERIFY (Local Verification)

```
Commands (run in sequence):
  1. npx tsc --noEmit
  2. npm run build
  3. npx playwright test
  4. npm run lint

All must exit with code 0.
If any fail, loop back to Step 3 (BUILD) to fix.
Maximum retry loops: 3
After 3 failures: Escalate to Opus model or human intervention.
```

---

## 4. Agent Memory Format

Each feature agent writes a memory file after completing its work. This file serves as the knowledge transfer document for all downstream agents.

### File Location

```
PRDs/agents/phase{N}-feature{NN}.md

Examples:
  PRDs/agents/phase0-foundation.md
  PRDs/agents/phase1-feature11-auth.md
  PRDs/agents/phase1-feature01-crud.md
  PRDs/agents/phase2-feature02-priority.md
```

### Template

```markdown
# Agent Memory: Feature {NN} - {Feature Name}

## Phase
Phase {N}

## Completed
{ISO 8601 timestamp}

## Agent
{agent name} on {model}

---

## What Was Planned

{Brief summary of the PRP requirements and the implementation plan}

## What Was Built

{Actual implementation summary, noting any differences from plan}

## Interface Deviations

{List any deviations from contracts/interfaces.ts with justification}
{If none: "None. All interfaces implemented as specified."}

### Added Interfaces
- {InterfaceName}: {reason it was needed beyond contract}

### Modified Interfaces
- {InterfaceName}.{field}: Changed from {original} to {actual} because {reason}

### Removed Interfaces
- {InterfaceName}: {reason it was unnecessary}

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| {path} | {description} | {count} |

## Files Modified

| File | Changes | Reason |
|------|---------|--------|
| {path} | {what changed} | {why} |

## Database Changes

### New Tables
- {table_name}: {columns and purpose}

### Altered Tables
- {table_name}: Added {column} ({type}) -- {reason}

### Indexes Added
- {index_name} on {table}({columns})

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| {GET/POST/PUT/DELETE} | {/api/...} | {Yes/No} | {what it does} |

## Test Coverage

| Test File | Tests | Pass | Coverage Area |
|-----------|-------|------|---------------|
| {path} | {count} | {pass/fail} | {what is tested} |

## Known Issues / Tech Debt

- {Issue description} -- {severity: low/medium/high} -- {suggested fix}

## Integration Notes for Downstream Agents

{Critical information that agents building on top of this feature MUST know}

### How to Use This Feature's Exports
- Import {X} from {path} for {purpose}
- Call {function} with {params} to {action}

### Gotchas
- {Non-obvious behavior that could trip up downstream agents}

### Extension Points
- {Where downstream features should hook into this feature}
- {Patterns to follow when extending}
```

---

## 5. Conflict Resolution

### Principle: Each Agent Owns Its Domain

No two agents should modify the same file in the same phase. When cross-cutting concerns arise, follow these rules.

### Shared Files -- Ownership Rules

| File/Directory | Owner | Other Agents May... |
|---------------|-------|-------------------|
| `lib/types/index.ts` | Phase 0 architect | ONLY READ. To add new types, create `lib/types/{feature}.ts` and re-export from index. |
| `lib/tokens/` | Phase 0 architect | ONLY READ. To add feature-specific tokens, add CSS variables to `app/globals.css` instead. Do NOT create new `lib/tokens/{feature}.ts` files for design values. |
| `app/globals.css` | Phase 0 architect (shadcn variables); feature agents may APPEND custom CSS variable blocks | Append new `:root` / `.dark` variable blocks for feature-specific tokens (e.g., `--reminder`, `--priority-high`). Never modify existing shadcn variable definitions. |
| `components/ui/` | Phase 0 architect — generated by shadcn CLI | ONLY READ. Feature agents import from `@/components/ui/*` but must not edit files in this directory. To add a new shadcn component run `npx shadcn add <component>` from Phase 0 or escalate to a Phase 0 task. |
| `components.json` | Phase 0 architect | ONLY READ. |
| `contracts/interfaces.ts` | Phase 0 architect | ONLY READ. If a feature needs a contract change, document in agent memory and escalate. |
| `app/layout.tsx` | Phase 0 architect | ONLY READ. Feature agents add providers via composition (create wrapper, import in layout). |
| `app/page.tsx` | Feature 01 (CRUD) creates initial version | Subsequent features EXTEND by importing their own components into page.tsx. Each feature adds ONE import + ONE component placement. If conflicts arise, the later phase agent wins and must integrate all prior components. |
| `playwright.config.ts` | Phase 0 architect | ONLY READ. |
| `tests/helpers.ts` | Phase 0 creates skeleton, Feature 01 adds base helpers | Each feature agent may ADD helper methods but must not modify existing ones. |
| `middleware.ts` | Feature 11 (Auth) | ONLY READ after Phase 1. |
| `lib/db/connection.ts` | Phase 0 architect | ONLY READ. |
| `package.json` | Any agent may add dependencies | Must not remove existing dependencies. Must use `npm install {package}` to add. |

### UI Primitive Rule

Feature agents **must import UI primitives from `@/components/ui/*`** (shadcn components). They must NOT:
- Create replacement Button, Input, Select, Dialog, Badge, Card, Checkbox, or Label components in `components/common/` or anywhere else.
- Copy-paste shadcn component code into feature component files.
- Use raw HTML `<button>`, `<input>`, or `<select>` elements for interactive UI that a shadcn component already covers.

If a needed shadcn component is missing from `components/ui/`, add a Phase 0 task to run `npx shadcn add <component>` and commit the result before the feature agent starts.

### Database Tables -- Domain Ownership

| Table(s) | Owner Feature | Notes |
|----------|--------------|-------|
| `users`, `authenticators` | Feature 11 (Auth) | No other feature creates or alters these |
| `todos` | Feature 01 (CRUD) creates. Features 02, 03, 04 add columns via ALTER TABLE migrations. | Migration must be idempotent (try-catch ALTER) |
| `subtasks` | Feature 05 (Subtasks) | CASCADE delete linked to todos |
| `tags`, `todo_tags` | Feature 06 (Tags) | Junction table for many-to-many |
| `templates` | Feature 07 (Templates) | JSON column for subtasks |
| `holidays` | Feature 10 (Calendar) | Seeded via script |

### Migration Ordering

Each feature agent that alters the `todos` table must:
1. Use `try { db.exec('ALTER TABLE todos ADD COLUMN ...') } catch (e) { /* column exists */ }`
2. Place migration in its own function: `migrate_{feature}(db)`
3. Register migration in `lib/db/migrations.ts` which runs all migrations in feature order (01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11)

### API Routes -- No Overlap

Each feature owns its API routes exclusively:

| Route Prefix | Owner |
|-------------|-------|
| `/api/auth/*` | Feature 11 |
| `/api/todos` (base CRUD) | Feature 01 |
| `/api/todos/[id]` (base CRUD) | Feature 01; Features 02, 03, 04 extend the PUT handler via composition |
| `/api/todos/[id]/subtasks` | Feature 05 |
| `/api/todos/[id]/tags` | Feature 06 |
| `/api/todos/export` | Feature 09 |
| `/api/todos/import` | Feature 09 |
| `/api/subtasks/[id]` | Feature 05 |
| `/api/tags/*` | Feature 06 |
| `/api/templates/*` | Feature 07 |
| `/api/notifications/*` | Feature 04 |
| `/api/holidays` | Feature 10 |

### Component Conflicts

- Feature components live in `app/components/{feature-name}/` subdirectories
- Shared UI primitives (Button, Modal, Badge) are created by Phase 0 in `app/components/ui/`
- If two features need the same shared component enhanced, the later feature creates a wrapper

### Conflict Escalation

If an agent discovers it cannot complete its work without modifying a file it does not own:
1. Document the need in its agent memory file under "Interface Deviations"
2. Create the change in a NEW file that wraps/extends the original
3. If wrapping is impossible, pause and escalate to the human operator
4. The human operator or a dedicated integration agent resolves the conflict

---

## 6. PRP File Requirements

Each of the 11 PRP files in `PRDs/` must contain the following sections. This ensures every feature agent has complete, self-contained instructions.

### Required Sections for Every PRP

```markdown
# PRP-{NN}: {Feature Name}

## 1. Feature Overview
- 2-3 paragraph description of what this feature does
- Why it exists (user value)
- How it fits into the overall application

## 2. User Stories
- As a [user], I want to [action], so that [benefit]
- Minimum 3 user stories per feature
- Include edge case stories (e.g., "As a user with no todos...")

## 3. Technical Requirements

### 3.1 Architecture Reference
- Reference to ARCHITECTURE.md / copilot-instructions.md patterns
- Which shared modules this feature depends on
- Which contracts from contracts/interfaces.ts this feature implements

### 3.2 Database Schema
- CREATE TABLE statements (for new tables)
- ALTER TABLE statements (for modifications to existing tables)
- Index definitions
- Foreign key constraints
- Example data rows

### 3.3 API Endpoints
For each endpoint:
- HTTP method and path
- Request body type (TypeScript interface)
- Response body type (TypeScript interface)
- Error responses (status codes + body)
- Authentication requirement (yes/no)
- Example request/response JSON

### 3.4 TypeScript Types
- All types this feature introduces (or references from lib/types/)
- Props interfaces for all React components
- Hook return types

## 4. React Components

### 4.1 Component Tree
- ASCII diagram showing component hierarchy
- Which components are new vs modified

### 4.2 Component Specifications
For each component:
- File path
- Props interface
- State managed
- Events emitted
- Design token usage (colors, spacing)
- Dark mode behavior
- Accessibility requirements (ARIA, keyboard nav)

## 5. TanStack Query Hooks

For each hook:
- Hook name and file path
- Query key structure
- Fetcher function
- Stale time / cache time
- Optimistic update strategy (if applicable)
- Invalidation triggers

## 6. State Management

- Which React Context(s) this feature reads from
- Which React Context(s) this feature writes to
- Local component state needed
- URL state (search params) if any

## 7. Test Specifications

### 7.1 E2E Tests (Playwright)
For each test:
- Test name
- Steps (numbered)
- Assertions
- Selectors to use (data-testid preferred)

### 7.2 Unit Tests
For each unit test:
- Function under test
- Input/output pairs
- Edge cases

### 7.3 Integration Tests
- API endpoint tests with expected status codes
- Database operation tests

## 8. Acceptance Criteria
- Numbered list of testable criteria
- Each criterion is a single, verifiable statement
- Must include at least one criteria per user story

## 9. Integration Points

### 9.1 What This Feature Consumes
- List of imports from other features
- API endpoints called
- Database tables read
- Shared state consumed

### 9.2 What This Feature Exposes
- Exports other features can use
- Database tables/columns created
- Events/callbacks provided
- Extension points for downstream features

## 10. Edge Cases & Error Handling
- Exhaustive list of error scenarios
- Expected behavior for each
- User-facing error messages

## 11. Out of Scope
- Explicit list of things NOT included in this feature
- Prevents scope creep during implementation

## 12. Singapore Timezone Considerations
- Which operations require timezone handling
- Specific lib/timezone.ts functions to use
- Edge cases around midnight, DST (Singapore has none, but UTC conversion matters)
```

---

### PRP Summary by Feature

#### PRP-01: Todo CRUD Operations
- **Core scope:** Create, read, update, delete todos with title, due_date, completed status
- **Database:** `todos` table (id, user_id, title, due_date, completed, created_at, updated_at)
- **API:** GET/POST /api/todos, GET/PUT/DELETE /api/todos/[id]
- **Components:** TodoForm, TodoList, TodoItem, EditTodoModal
- **Hooks:** useTodos (TanStack Query), useTodoMutations
- **Key decisions:** Optimistic UI updates on toggle. Sections: Overdue, Active, Completed. Due date minimum 1 minute in future. Title required, trimmed, non-empty.
- **Integration:** Foundation for ALL other features. Exposes todo data model, API patterns, component patterns.

#### PRP-02: Priority System
- **Core scope:** Three-level priority (high/medium/low) with color badges and automatic sorting
- **Database:** ALTER TABLE todos ADD COLUMN priority TEXT DEFAULT 'medium'
- **API:** Priority field in existing todo endpoints (create/update)
- **Components:** PriorityBadge (red/yellow/blue), PriorityFilter dropdown
- **Hooks:** Extends useTodos query to include priority sorting
- **Key decisions:** Default priority is 'medium'. Sort order: high > medium > low, then by due_date. Badge colors must meet WCAG AA contrast in both light and dark mode.
- **Integration:** Consumes todo CRUD. Exposes Priority type, PriorityBadge component, filter state for Search feature.

#### PRP-03: Recurring Todos
- **Core scope:** Daily/weekly/monthly/yearly recurrence patterns with automatic next-instance creation
- **Database:** ALTER TABLE todos ADD COLUMN is_recurring BOOLEAN DEFAULT 0, ADD COLUMN recurrence_pattern TEXT
- **API:** Recurrence fields in todo create/update. PUT /api/todos/[id] completion handler creates next instance.
- **Components:** RecurrenceCheckbox, RecurrencePatternSelect
- **Hooks:** Extends useTodoMutations to handle recurrence on completion
- **Key decisions:** Recurring todos require a due_date. Next instance inherits priority, tags, reminder, recurrence pattern. Monthly recurrence on Jan 31 -> Feb 28 (last day of month logic). All date calculations in Singapore timezone.
- **Integration:** Consumes todo CRUD. Exposes RecurrencePattern type, next-date calculation utility.

#### PRP-04: Reminders & Notifications
- **Core scope:** Browser notifications at configurable times before due date (15m, 30m, 1h, 2h, 1d, 2d, 1w)
- **Database:** ALTER TABLE todos ADD COLUMN reminder_minutes INTEGER, ADD COLUMN last_notification_sent TEXT
- **API:** GET /api/notifications/check (returns todos needing notification)
- **Components:** ReminderSelect dropdown, NotificationButton (permission request)
- **Hooks:** useNotifications (polling every 30s, browser Notification API)
- **Key decisions:** Reminder dropdown disabled when no due_date set. Duplicate prevention via last_notification_sent timestamp. Polling stops when tab is not visible. All time comparisons in Singapore timezone.
- **Integration:** Consumes todo CRUD + due_date. Exposes reminder_minutes field for template system.

#### PRP-05: Subtasks & Progress Tracking
- **Core scope:** Checklist items within a todo, visual progress bar
- **Database:** CREATE TABLE subtasks (id, todo_id, title, completed, position, created_at). FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE.
- **API:** POST /api/todos/[id]/subtasks, PUT /api/subtasks/[id], DELETE /api/subtasks/[id]
- **Components:** SubtaskList, SubtaskItem, AddSubtaskInput, ProgressBar
- **Hooks:** useSubtasks(todoId)
- **Key decisions:** Position field for ordering (integer, increment by 1). Progress = completed / total * 100. Green bar at 100%, blue otherwise. Cascade delete when parent todo deleted.
- **Integration:** Consumes todo CRUD. Exposes Subtask type, subtask data for Template system and Export/Import.

#### PRP-06: Tag System
- **Core scope:** Color-coded labels with many-to-many relationship to todos, CRUD for tags, filter by tag
- **Database:** CREATE TABLE tags (id, user_id, name, color, created_at). CREATE TABLE todo_tags (todo_id, tag_id, PRIMARY KEY(todo_id, tag_id)).
- **API:** GET/POST /api/tags, PUT/DELETE /api/tags/[id], POST/DELETE /api/todos/[id]/tags
- **Components:** TagBadge, TagManager (modal), TagPicker (checkboxes in todo form)
- **Hooks:** useTags, useTagMutations
- **Key decisions:** Tag names unique per user. Color stored as hex string. Clicking a tag badge filters by that tag. Deleting a tag removes all todo_tags associations. Editing tag name/color updates display on all todos.
- **Integration:** Consumes todo CRUD. Exposes Tag type, tag data for Search, Template, and Export/Import features.

#### PRP-07: Template System
- **Core scope:** Save todo patterns as templates, create new todos from templates
- **Database:** CREATE TABLE templates (id, user_id, name, description, category, title, priority, is_recurring, recurrence_pattern, reminder_minutes, subtasks_json, due_date_offset_days, created_at).
- **API:** GET/POST /api/templates, PUT/DELETE /api/templates/[id], POST /api/templates/[id]/use
- **Components:** SaveTemplateForm (modal), TemplateModal (selection with category filter), TemplatePreview
- **Hooks:** useTemplates, useTemplateMutations
- **Key decisions:** Subtasks stored as JSON string: `[{ title, position }]`. Due date calculated from offset days (not absolute date). Category is free-text with predefined suggestions. Using a template creates a new todo + subtasks.
- **Integration:** Consumes Subtask type (Feature 05) and Tag type (Feature 06). Exposes Template type.

#### PRP-08: Search & Filtering
- **Core scope:** Real-time text search across titles and tags, multi-criteria filtering
- **Database:** No new tables. Client-side filtering of existing data.
- **API:** No new endpoints. Uses existing GET /api/todos with client-side filtering.
- **Components:** SearchBar (debounced input), FilterControls (priority dropdown, tag filter), FilterSummary (active filters display), ClearFiltersButton
- **Hooks:** useSearch (debounced), useFilters (combined filter state)
- **Key decisions:** Search is case-insensitive. Searches title + tag names (advanced). Filters combine with AND logic. Debounce 300ms. Empty state message when no results match.
- **Integration:** Consumes Priority (Feature 02) and Tags (Feature 06). Purely client-side, no new exports for other features.

#### PRP-09: Export & Import
- **Core scope:** JSON backup/restore of all user data with relationship preservation
- **Database:** No new tables. Reads all domain tables for export, writes to all for import.
- **API:** GET /api/todos/export, POST /api/todos/import
- **Components:** ExportButton, ImportButton (with file picker)
- **Hooks:** useExport, useImport
- **Key decisions:** Export format includes version field, todos array, subtasks array, tags array, todo_tags array. Import remaps all IDs to avoid collisions. Tag name conflicts resolved by reusing existing tag. Import validates JSON structure before processing. Success message shows counts (X todos, Y subtasks, Z tags imported).
- **Integration:** Consumes Todo (01), Subtask (05), Tag (06) data. Self-contained feature, no downstream consumers.

#### PRP-10: Calendar View
- **Core scope:** Monthly calendar displaying todos on their due dates, Singapore public holidays
- **Database:** CREATE TABLE holidays (id, date, name, year). Seeded via script.
- **API:** GET /api/holidays?year=YYYY
- **Components:** CalendarGrid, CalendarDay, CalendarNav (prev/next/today), DayModal (shows todos for selected day)
- **Hooks:** useCalendar(month), useHolidays(year)
- **Key decisions:** Calendar is a separate page (/calendar). Month stored in URL (?month=YYYY-MM). Current day highlighted. Weekends styled differently. Todo count badge on days with todos. Holidays displayed with red text. Singapore timezone for all date comparisons.
- **Integration:** Consumes Todo (01) due_date data. Reads from holidays table. Self-contained view.

#### PRP-11: WebAuthn Authentication
- **Core scope:** Passwordless authentication using passkeys/biometrics, JWT sessions, route protection
- **Database:** CREATE TABLE users (id, username, created_at). CREATE TABLE authenticators (id, user_id, credential_id, credential_public_key, counter, transports, created_at).
- **API:** POST /api/auth/register-options, POST /api/auth/register-verify, POST /api/auth/login-options, POST /api/auth/login-verify, POST /api/auth/logout, GET /api/auth/me
- **Components:** LoginPage (registration + login forms), LogoutButton
- **Hooks:** useAuth (session state)
- **Key decisions:** Uses @simplewebauthn/server and @simplewebauthn/browser. JWT stored in HTTP-only cookie (7-day expiry). middleware.ts protects / and /calendar routes. Always use `?? 0` for authenticator.counter. RP_ID, RP_NAME, RP_ORIGIN from environment variables. Challenge stored in-memory (Map) with 60s TTL.
- **Integration:** Foundation feature. Provides getSession(), userId for ALL other features' API routes. Must complete before other features can properly protect their endpoints.

---

## 7. Rollback Strategy

### When an Agent's Output Breaks the Build

```
ROLLBACK PROTOCOL
=================

Trigger: Any verification gate check fails after an agent completes

Step 1: DIAGNOSE
  - Run `npx tsc --noEmit 2>&1` and capture all errors
  - Run `npm run build 2>&1` and capture output
  - Identify which files introduced the failure

Step 2: QUICK FIX ATTEMPT (max 10 minutes)
  - Invoke build-error-resolver agent (Opus)
  - Agent makes MINIMAL fixes (type annotations, null checks, import fixes)
  - Re-run verification gate
  - If passes: Continue to next phase

Step 3: REVERT (if quick fix fails)
  - git stash (save current changes)
  - git checkout {last-passing-commit}
  - Verify build passes on reverted state
  - Create new branch: fix/phase{N}-feature{NN}

Step 4: RE-RUN AGENT with constraints
  - Re-invoke the feature agent with:
    - Original PRP file
    - Error log from failed build
    - Additional constraint: "Previous attempt failed with: {error}. Avoid: {pattern that caused failure}"
  - If using Sonnet: Escalate to Opus model
  - If already Opus: Add human review of plan before build step

Step 5: ESCALATION (if re-run fails)
  - Human operator reviews the failure
  - Options:
    a. Manually fix the issue
    b. Simplify the PRP requirements
    c. Split the feature into smaller sub-features
    d. Defer the feature to a later phase
```

### Prevention Strategies

1. **Incremental commits:** Feature agents commit after each major component (DB, API, hooks, components, tests) so rollback granularity is fine
2. **Branch per feature:** Each feature agent works on its own branch (`feature/{NN}-{name}`), merged to main only after verification gate passes
3. **Contract-first development:** Phase 0 defines all interfaces upfront, reducing integration failures
4. **Agent memory continuity:** Downstream agents read upstream memories, preventing duplicate or conflicting patterns

### Branch Strategy

```
main (protected -- only merge after gate passes)
  |
  +-- phase0/foundation
  |
  +-- phase1/feature-11-auth
  +-- phase1/feature-01-crud
  |     (merge both to main after Phase 1 gate)
  |
  +-- phase2/feature-02-priority
  +-- phase2/feature-03-recurring
  +-- phase2/feature-05-subtasks
  |     (merge all three to main after Phase 2 gate)
  |
  +-- phase3/feature-04-reminders
  +-- phase3/feature-06-tags
  |     (merge both to main after Phase 3 gate)
  |
  +-- phase4/feature-07-templates
  +-- phase4/feature-08-search
  |     (merge both to main after Phase 4 gate)
  |
  +-- phase5/feature-09-export
  +-- phase5/feature-10-calendar
        (merge both to main after Phase 5 gate -- FINAL)
```

### Merge Order Within a Phase

When multiple feature branches merge to main after a gate:
1. Merge the feature with fewer shared-file modifications first
2. After first merge, rebase remaining branches on updated main
3. Resolve any conflicts (should be minimal due to ownership rules)
4. Re-run verification gate after all merges

---

## Appendix: File Ownership Map

### Complete File Tree (Planned)

```
app/
  layout.tsx                          [Phase 0]
  globals.css                         [Phase 0]
  page.tsx                            [Feature 01, extended by 02-08]
  login/
    page.tsx                          [Feature 11]
  calendar/
    page.tsx                          [Feature 10]
  api/
    auth/
      register-options/route.ts       [Feature 11]
      register-verify/route.ts        [Feature 11]
      login-options/route.ts          [Feature 11]
      login-verify/route.ts           [Feature 11]
      logout/route.ts                 [Feature 11]
      me/route.ts                     [Feature 11]
    todos/
      route.ts                        [Feature 01]
      [id]/
        route.ts                      [Feature 01, extended by 02, 03, 04]
        subtasks/
          route.ts                    [Feature 05]
        tags/
          route.ts                    [Feature 06]
      export/
        route.ts                      [Feature 09]
      import/
        route.ts                      [Feature 09]
    subtasks/
      [id]/
        route.ts                      [Feature 05]
    tags/
      route.ts                        [Feature 06]
      [id]/
        route.ts                      [Feature 06]
    templates/
      route.ts                        [Feature 07]
      [id]/
        route.ts                      [Feature 07]
        use/
          route.ts                    [Feature 07]
    notifications/
      check/
        route.ts                      [Feature 04]
    holidays/
      route.ts                        [Feature 10]
  components/
    ui/                               [Phase 0]
      button.tsx
      modal.tsx
      badge.tsx
      input.tsx
    todo-form.tsx                      [Feature 01, extended by 02, 03, 04]
    todo-list.tsx                      [Feature 01]
    todo-item.tsx                      [Feature 01, extended by 02, 03, 04, 05, 06]
    priority-badge.tsx                 [Feature 02]
    priority-filter.tsx                [Feature 02]
    subtask-list.tsx                   [Feature 05]
    progress-bar.tsx                   [Feature 05]
    tag-badge.tsx                      [Feature 06]
    tag-manager.tsx                    [Feature 06]
    tag-picker.tsx                     [Feature 06]
    reminder-select.tsx                [Feature 04]
    notification-button.tsx            [Feature 04]
    template-modal.tsx                 [Feature 07]
    save-template-form.tsx             [Feature 07]
    search-bar.tsx                     [Feature 08]
    filter-controls.tsx                [Feature 08]
    filter-summary.tsx                 [Feature 08]
    export-button.tsx                  [Feature 09]
    import-button.tsx                  [Feature 09]
    calendar-grid.tsx                  [Feature 10]
    calendar-day.tsx                   [Feature 10]
    calendar-nav.tsx                   [Feature 10]
    day-modal.tsx                      [Feature 10]

lib/
  types/
    index.ts                          [Phase 0]
    todo.ts                           [Phase 0, may be extended]
    auth.ts                           [Phase 0]
    tag.ts                            [Phase 0]
    subtask.ts                        [Phase 0]
    template.ts                       [Phase 0]
    holiday.ts                        [Phase 0]
  tokens/
    index.ts                          [Phase 0]
    colors.ts                         [Phase 0]
    spacing.ts                        [Phase 0]
  db/
    connection.ts                     [Phase 0]
    migrations.ts                     [Phase 0, each feature registers its migration]
    todos.ts                          [Feature 01]
    users.ts                          [Feature 11]
    authenticators.ts                 [Feature 11]
    subtasks.ts                       [Feature 05]
    tags.ts                           [Feature 06]
    todo-tags.ts                      [Feature 06]
    templates.ts                      [Feature 07]
    holidays.ts                       [Feature 10]
  api/
    client.ts                         [Phase 0]
    todos.ts                          [Feature 01]
    tags.ts                           [Feature 06]
    subtasks.ts                       [Feature 05]
    templates.ts                      [Feature 07]
    holidays.ts                       [Feature 10]
  hooks/
    useTodos.ts                       [Feature 01]
    useSubtasks.ts                    [Feature 05]
    useTags.ts                        [Feature 06]
    useTemplates.ts                   [Feature 07]
    useNotifications.ts               [Feature 04]
    useSearch.ts                      [Feature 08]
    useFilters.ts                     [Feature 08]
    useCalendar.ts                    [Feature 10]
    useAuth.ts                        [Feature 11]
  auth.ts                             [Feature 11]
  timezone.ts                         [Phase 0]
  recurrence.ts                       [Feature 03]
  export.ts                           [Feature 09]
  import.ts                           [Feature 09]
  providers/
    query-provider.tsx                [Phase 0]

contracts/
  interfaces.ts                       [Phase 0]

middleware.ts                         [Feature 11]

scripts/
  seed-holidays.ts                    [Feature 10]

tests/
  helpers.ts                          [Phase 0 skeleton, extended by features]
  01-authentication.spec.ts           [Feature 11]
  02-todo-crud.spec.ts                [Feature 01]
  03-priority.spec.ts                 [Feature 02]
  04-recurring.spec.ts                [Feature 03]
  05-subtasks.spec.ts                 [Feature 05]
  06-reminders.spec.ts                [Feature 04]
  07-tags.spec.ts                     [Feature 06]
  08-templates.spec.ts                [Feature 07]
  09-search.spec.ts                   [Feature 08]
  10-export-import.spec.ts            [Feature 09]
  11-calendar.spec.ts                 [Feature 10]

PRDs/
  agents/
    phase0-foundation.md
    phase1-feature01-crud.md
    phase1-feature11-auth.md
    phase2-feature02-priority.md
    phase2-feature03-recurring.md
    phase2-feature05-subtasks.md
    phase3-feature04-reminders.md
    phase3-feature06-tags.md
    phase4-feature07-templates.md
    phase4-feature08-search.md
    phase5-feature09-export.md
    phase5-feature10-calendar.md
```

---

## Quick Reference: Agent Invocation Commands

```bash
# Phase 0
claude --agent architect "Build Phase 0 foundation. Read ORCHESTRATION.md Section 1 Phase 0."

# Phase 1 (parallel -- run in separate terminals/sessions)
claude --agent planner "Plan Feature 11 Auth. Read PRDs/11-authentication-webauthn.md"
claude --agent planner "Plan Feature 01 CRUD. Read PRDs/01-todo-crud-operations.md"

# After planning, build each:
claude --agent tdd-guide "Build Feature 11 Auth per plan in PRDs/agents/phase1-feature11-plan.md"
claude --agent tdd-guide "Build Feature 01 CRUD per plan in PRDs/agents/phase1-feature01-plan.md"

# Phase 1 verification gate
claude --agent build-error-resolver "Verify Phase 1 gate: npm run build && npx tsc --noEmit && npx playwright test"

# Continue pattern for Phases 2-5...
```

---

*Last updated: 2026-04-08*
*Total features: 11*
*Total phases: 6 (Phase 0-5)*
*Estimated total build context: ~130,000 tokens across all agents*
```

---

## Relevant File Paths

The following files in the repository were read to produce this plan:

- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\PRDs\README.md` -- existing PRP index with feature descriptions and dependency graph
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.github\copilot-instructions.md` -- architecture reference with database patterns, auth flow, API conventions, timezone rules
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\EVALUATION.md` -- feature completeness checklist with acceptance criteria for all 11 features
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\USER_GUIDE.md` -- end-user documentation describing expected behavior
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\agents\architect.md` -- architect agent definition
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\agents\planner.md` -- planner agent definition
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\agents\tdd-guide.md` -- TDD agent definition
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\agents\code-reviewer.md` -- code reviewer agent definition
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\agents\security-reviewer.md` -- security reviewer agent definition
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\agents\build-error-resolver.md` -- build error resolver agent definition
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\agents\e2e-runner.md` -- E2E testing agent definition
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\agents\refactor-cleaner.md` -- refactor agent definition
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\agents\doc-updater.md` -- documentation agent definition
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\commands\orchestrate.md` -- existing orchestration command template
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\rules\agents.md` -- agent usage rules
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\rules\coding-style.md` -- immutability, file size, error handling rules
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\rules\git-workflow.md` -- commit and PR workflow
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\rules\performance.md` -- model selection strategy
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\rules\security.md` -- security guidelines
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\rules\testing.md` -- TDD requirements
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\skills\tdd-workflow\SKILL.md` -- TDD workflow skill
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\skills\backend-patterns\SKILL.md` -- backend patterns skill
- `C:\Development\NUS-ISS\AI-SDLC-Workshop-Day1n2\.claude\skills\frontend-patterns\SKILL.md` -- frontend patterns skill

**Key observation:** No source code (`.ts`, `.tsx`, `package.json`) exists yet. This is a greenfield build. The PRDs directory currently contains only `README.md` -- the 11 individual PRP files referenced in the README need to be created. The `PRPs/` directory was deleted (visible in git status). The orchestration plan assumes the 11 PRP files will be created in `PRDs/` following the structure defined in Section 6 of ORCHESTRATION.md.