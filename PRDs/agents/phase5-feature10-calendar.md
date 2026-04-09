# Agent Memory: Phase 5 — Feature 10 — Calendar View

**Implemented by:** Claude Sonnet 4.6 (Feature Agent)
**Date:** 2026-04-08
**Status:** Complete

---

## What Was Implemented

### Files Created

| File | Purpose |
|------|---------|
| `lib/db/holidays.ts` | HolidayDBContract implementation using better-sqlite3 |
| `lib/calendar.ts` | Pure calendar utility: `buildCalendarMonth`, `toSGDateStr`, `todaySG`, `currentSGMonth`, `getMonthBounds`, `isWeekend` |
| `lib/hooks/useHolidays.ts` | TanStack Query hook with 24h staleTime |
| `lib/hooks/useCalendar.ts` | Composed hook: todos + holidays → CalendarMonth grid |
| `app/api/holidays/route.ts` | GET /api/holidays?year=YYYY&month=MM with auth + validation |
| `components/calendar/HolidayBadge.tsx` | Red text holiday label with data-testid |
| `components/calendar/CalendarDay.tsx` | Single day cell with today highlight, weekend bg, todo badge |
| `components/calendar/CalendarGrid.tsx` | 6×7 grid table with Sun–Sat headers |
| `components/calendar/CalendarDayModal.tsx` | shadcn Dialog with todo list and holiday callout |
| `components/calendar/CalendarNav.tsx` | Prev/Next/Today navigation with shadcn Button |
| `app/calendar/page.tsx` | Full calendar page with URL state (`?month=YYYY-MM`) |
| `scripts/seed-holidays.ts` | Idempotent seed for SG public holidays 2024–2026 |
| `tests/11-calendar-view.spec.ts` | E2E tests covering all acceptance criteria |

### Files Modified

| File | Change |
|------|--------|
| `app/page.tsx` | Added `Link` import + Calendar navigation button |
| `lib/hooks/useHolidays.ts` | Replaced stub with full TanStack Query implementation |

---

## Key Design Decisions

### Calendar Grid Algorithm
- Grid always has 6 rows × 7 columns (42 cells)
- First column = Sunday (day index 0)
- Grid starts on the Sunday before (or on) the 1st of the month
- Uses `addDays()` with UTC arithmetic to avoid timezone edge cases
- `getDayOfWeek()` uses column index (0–6) directly — avoids calling `getDay()` on Date objects

### Singapore Timezone
- `toSGDateStr(isoUTC)` converts UTC ISO strings to 'YYYY-MM-DD' in SGT using `sv-SE` locale
- `getSingaporeNow()` from `lib/timezone.ts` used for today detection
- Holiday dates stored as Singapore local dates (YYYY-MM-DD) — no conversion needed
- Calendar page uses `currentSGMonth()` as default when no `?month=` param present

### API Client
- Existing `lib/api/holidays.ts` was already correct — kept as-is
- Returns `Promise<Holiday[]>` directly (apiClient unwraps `data` from ApiResponse)

### URL State
- Month state lives in `?month=YYYY-MM` URL parameter
- `useSearchParams()` with `Suspense` wrapper for Next.js RSC compatibility
- Malformed params fall back to current SG month

### Modal Interaction
- Clicking "other month" day: navigates to that month AND opens modal
- Clicking current month day: opens modal directly

---

## Seed Script Output
```
Seeded 33 holiday records (0 already existed).
```
Covers 11 holidays per year × 3 years (2024–2026) = 33 records.
Chinese New Year gets 2 rows per year (Day 1 + Day 2).

---

## TypeScript
- `npx tsc --noEmit` passes with zero errors
- All components use strict prop types
- `CalendarDay`, `CalendarMonth`, `CalendarTodo` types defined in `lib/calendar.ts`

---

## Integration Points

### Consumed
- `lib/hooks/useTodos` → `queryKeys.todos` (shared cache, no invalidation)
- `lib/timezone.ts` → `getSingaporeNow()`
- `lib/auth.ts` → `getSession()` in API route
- `lib/db/connection.ts` → holidays table (already exists)
- shadcn: `Button`, `Dialog`, `Badge`

### Exposed
- `GET /api/holidays?year=YYYY&month=MM` — usable by any future feature
- `useHolidays(year, month)` — 24h cached hook
- `buildCalendarMonth()` — pure function, unit-testable
- `/calendar?month=YYYY-MM` — bookmarkable URL

---

## Caveats / Known Limitations
- `lib/hooks/useCalendar.ts` uses its own `useQuery` for todos (same key as `useTodos`) rather than calling `useTodos()` to avoid bringing in mutation functions. Both share the same TanStack cache.
- Holiday data beyond 2026 not seeded — extend `scripts/seed-holidays.ts` as needed.
- `lib/api/holidays.ts` was already present with a correct stub — only `useHolidays.ts` needed replacement.
