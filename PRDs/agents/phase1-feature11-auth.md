# Agent Memory: Feature 11 - WebAuthn/Passkeys Authentication

## Phase
Phase 1

## Completed
2026-04-08T12:00:00+08:00

## Agent
feature-agent on Opus 4.6

---

## What Was Planned

Implement passwordless WebAuthn/Passkeys authentication for the Todo App including:
- Database module for users and authenticators (lib/db/users.ts)
- Session management with JWT and HTTP-only cookies (lib/auth.ts)
- In-memory challenge store with 60s TTL
- 6 API routes for register-options, register-verify, login-options, login-verify, logout, me
- Middleware for route protection (redirect unauthenticated to /login)
- Login page with Register/Login tabs
- Auth components: RegisterForm, LoginForm, LogoutButton
- AuthProvider with TanStack Query integration
- useAuth hook
- E2E tests with virtual authenticator

## What Was Built

All planned features were implemented as specified in PRP-11. Key implementation details:

1. **lib/db/users.ts** - Full UserDBContract + authenticator CRUD methods using db.prepare() synchronous API
2. **lib/auth.ts** - Challenge store (Map with 60s TTL), JWT session management (jose library, HS256, 7-day expiry), HTTP-only cookies
3. **6 API routes** - All under app/api/auth/, using @simplewebauthn/server v11 APIs
4. **middleware.ts** - Protects / and /calendar routes, redirects to /login; redirects /login to / if authenticated
5. **Login page** - Tab switcher (Login/Register) with proper ARIA roles
6. **Auth components** - RegisterForm, LoginForm with WebAuthn browser API, LogoutButton
7. **AuthProvider** - TanStack Query integration fetching /api/auth/me with 5min stale time
8. **lib/api/auth.ts** - Updated to use `response` field (not `credential`) matching route signatures
9. **E2E tests** - 8 tests using CDP virtual authenticator
10. **tests/helpers.ts** - Updated with register/login helper methods

## Interface Deviations

None. All interfaces implemented as specified in contracts/interfaces.ts.

### Added Interfaces
- `CreateAuthenticatorData` (local to lib/db/users.ts): Internal type for authenticator creation data, not exported
- `AuthenticatorRow` (local to lib/db/users.ts): Internal type for raw DB row mapping

### Modified Interfaces
- None

### Removed Interfaces
- None

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| app/api/auth/register-options/route.ts | Generate WebAuthn registration challenge | 52 |
| app/api/auth/register-verify/route.ts | Verify registration and create user+authenticator | 79 |
| app/api/auth/login-options/route.ts | Generate WebAuthn authentication challenge | 48 |
| app/api/auth/login-verify/route.ts | Verify authentication and issue session | 85 |
| app/api/auth/logout/route.ts | Clear session cookie | 14 |
| app/api/auth/me/route.ts | Return current user info from session | 23 |
| components/auth/RegisterForm.tsx | Username input + WebAuthn registration flow | 103 |
| components/auth/LoginForm.tsx | Username input + WebAuthn authentication flow | 110 |
| components/auth/LogoutButton.tsx | Session termination button | 25 |
| tests/01-authentication.spec.ts | E2E tests for auth flows | 150 |
| .env.local | Environment variables for JWT and RP config | 4 |

## Files Modified

| File | Changes | Reason |
|------|---------|--------|
| lib/db/users.ts | Full implementation of UserDBContract + authenticator methods | Was a stub throwing "Not implemented" |
| lib/auth.ts | Full implementation of challenge store + session management | Was a stub throwing "Not implemented" |
| middleware.ts | Route protection with JWT verification | Was a pass-through stub |
| components/providers/AuthProvider.tsx | TanStack Query integration, logout function | Was a stub with empty values |
| lib/hooks/useAuth.ts | Context consumption with error boundary | Was a basic stub |
| lib/api/auth.ts | Updated field names (credential -> response) | Body field names needed to match API routes |
| app/login/page.tsx | Full login page with tab switching | Was a placeholder |
| tests/helpers.ts | Added register/login helpers with virtual authenticator | Was all "Not implemented" stubs |

## Database Changes

### New Tables
- None (tables already created by Phase 0 in lib/db/connection.ts)

### Altered Tables
- None

### Indexes Added
- None (indexes already created by Phase 0)

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register-options | No | Generate WebAuthn registration challenge |
| POST | /api/auth/register-verify | No | Verify registration, create user, issue session |
| POST | /api/auth/login-options | No | Generate WebAuthn authentication challenge |
| POST | /api/auth/login-verify | No | Verify authentication, issue session |
| POST | /api/auth/logout | No | Clear session cookie |
| GET | /api/auth/me | No | Return current user info (null if unauthenticated) |

## Test Coverage

| Test File | Tests | Pass | Coverage Area |
|-----------|-------|------|---------------|
| tests/01-authentication.spec.ts | 8 | Pending E2E run | Register, login, logout, redirect, duplicate username, short username, unknown user, authenticated redirect |

## Known Issues / Tech Debt

- Challenge store is in-memory (Map) -- low -- Would need Redis for multi-process deployments
- No rate limiting on auth endpoints -- medium -- Recommended for production
- No account deletion or passkey management UI -- low -- Out of scope per PRP

## Integration Notes for Downstream Agents

### How to Use This Feature's Exports
- Import `{ getSession }` from `@/lib/auth` in every API route handler to authenticate requests
- Import `{ useAuth }` from `@/lib/hooks/useAuth` in any component needing user info or auth state
- Import `{ LogoutButton }` from `@/components/auth/LogoutButton` in Header component
- Import `{ userDB }` from `@/lib/db/users` if you need to look up user data

### Gotchas
- `getSession()` is async (uses `await cookies()` from next/headers)
- `userDB` methods are synchronous (better-sqlite3) -- do NOT await them
- The `me` endpoint returns `{ success: true, data: null }` when unauthenticated (not 401)
- The apiClient in lib/api/client.ts throws when `success: false`, so `authApi.me()` will throw for unauthenticated users -- the AuthProvider catches this and returns null
- WebAuthn credential.id in @simplewebauthn/server v11 is already a Base64URLString (not Uint8Array), but credential.publicKey IS a Uint8Array and must be encoded with `isoBase64URL.fromBuffer()`
- Always use `authenticator.counter ?? 0` when passing counter to verifyAuthenticationResponse

### Extension Points
- All API routes that need authentication should call `const session = await getSession()` and check for null
- The AuthProvider wraps the entire app via AppProviders -- any component can use `useAuth()` to get user state
- To add user-scoped data, use `session.userId` as the foreign key in queries
- middleware.ts protects `/` and `/calendar` -- add paths to `PROTECTED_PATHS` array for new protected routes
