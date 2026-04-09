# PRP-11: WebAuthn / Passkeys Authentication

**Depends on:** None (foundation feature)
**Feature:** Passwordless authentication using biometrics and security keys (WebAuthn/Passkeys)
**Last updated:** 2026-04-08

> **SECURITY-CRITICAL FEATURE**
> This PRP implements authentication — the security boundary of the entire application.
> Implementation MUST use the **Opus model** and the **security-reviewer agent** MUST review all code before commit.
> Any deviation from the patterns in this document requires explicit security review.

---

## 1. Feature Overview

WebAuthn authentication replaces traditional password login with passkeys — cryptographic credentials stored in the user's device (biometrics, OS PIN, or hardware security keys). Users register by providing a username; the browser generates a public/private key pair via the WebAuthn API, and the server stores only the public key. On subsequent logins, the server issues a cryptographic challenge that only the device holding the private key can sign.

The session is maintained via a JWT stored in an HTTP-only `Set-Cookie` header (not accessible to JavaScript). JWTs are signed with `JWT_SECRET` from environment variables and have a 7-day expiry. Middleware protects all application routes (`/`, `/calendar`) and redirects unauthenticated users to `/login`. The `/login` page hosts both a registration tab and a login tab, switching between them based on user intent.

Challenge storage uses an in-memory `Map` with a 60-second TTL to guard against replay attacks. Since this is a single-process Next.js server, the in-memory store is sufficient; a Redis store would be required for multi-process deployments (out of scope). Four environment variables are required: `JWT_SECRET`, `RP_ID` (Relying Party ID, typically the domain), `RP_NAME` (human-readable app name), and `RP_ORIGIN` (full origin URL including scheme).

---

## 2. User Stories

**US-01 — Register with passkey**
As a new user, I want to enter a username and click "Register", complete a biometric/PIN prompt, and be immediately logged in so that I can start using the app without a password.

**US-02 — Login with passkey**
As a returning user, I want to enter my username, click "Login", complete the biometric/PIN prompt, and be redirected to the main app so that I am securely authenticated.

**US-03 — Logout**
As a logged-in user, I want to click "Logout" and have my session immediately invalidated so that no one using the same device can access my data.

**US-04 — Session persistence**
As a logged-in user who closes and reopens the browser within 7 days, I want to still be logged in so that I do not need to re-authenticate on every visit.

**US-05 — Protected routes**
As an unauthenticated visitor who navigates to `/` or `/calendar`, I want to be automatically redirected to `/login` so that my data is protected.

**US-06 — Edge: duplicate username**
As a user who tries to register with a username that already exists, I want to receive a clear error "Username already taken" so that I can choose a different one.

**US-07 — Edge: expired challenge**
As a user who waits more than 60 seconds between clicking "Register/Login" and completing the biometric prompt, I want to receive "Authentication challenge expired. Please try again." so that I understand why it failed and can restart.

**US-08 — Edge: WebAuthn not supported**
As a user on a browser that does not support WebAuthn, I want to see a clear message "Your browser does not support passkeys. Please use a modern browser." instead of a broken UI.

**US-09 — Edge: cancelled biometric**
As a user who dismisses the biometric prompt, I want the form to return to its initial state without an error so that I can try again.

---

## 3. Technical Requirements

### 3.1 Architecture Reference

| Concern | Location |
|---------|----------|
| DB operations | `lib/db/users.ts` — synchronous (better-sqlite3) |
| Session management | `lib/auth.ts` — `createSession()`, `getSession()`, `deleteSession()` |
| Challenge storage | `lib/auth.ts` — module-level `Map<string, {challenge: string, expiresAt: number}>` |
| WebAuthn server | `@simplewebauthn/server` |
| WebAuthn browser | `@simplewebauthn/browser` (client-side only) |
| API routes | `app/api/auth/` (6 routes) |
| API client | `lib/api/auth.ts` |
| Shared types | `lib/types/user.ts` |
| TanStack hook | `lib/hooks/useAuth.ts` |
| Auth context | `components/providers/AuthProvider.tsx` |
| Components | `components/auth/` |
| Page | `app/login/page.tsx` |
| Route protection | `middleware.ts` |
| Env variables | `.env.local` — `JWT_SECRET`, `RP_ID`, `RP_NAME`, `RP_ORIGIN` |

> **Next.js 16 rule:** Route params are async. Always `const { id } = await params`.
> **better-sqlite3 rule:** All DB calls are synchronous — do NOT `await` them.
> **Security rule:** Never log JWT secrets, credential private keys, or session tokens.
> **CRITICAL:** Always use `authenticator.counter ?? 0` — the WebAuthn counter can be `undefined`.
> **CRITICAL:** Use `isoBase64URL` from `@simplewebauthn/server/helpers` for encoding/decoding `credential_id`.

### 3.2 Database Schema

```sql
-- Add to lib/db/connection.ts schema initialisation block

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT    NOT NULL UNIQUE,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS authenticators (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id              INTEGER NOT NULL,
  credential_id        TEXT    NOT NULL UNIQUE,   -- isoBase64URL encoded
  credential_public_key TEXT   NOT NULL,           -- isoBase64URL encoded
  counter              INTEGER NOT NULL DEFAULT 0,
  transports           TEXT,                       -- JSON array of AuthenticatorTransport strings, nullable
  created_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_authenticators_user_id      ON authenticators(user_id);
CREATE INDEX IF NOT EXISTS idx_authenticators_credential_id ON authenticators(credential_id);
```

**Note on `transports`:** Stored as a JSON string (e.g., `'["internal","hybrid"]'`). Deserialised on read with `JSON.parse()`.

### 3.3 API Endpoints

#### `POST /api/auth/register-options`

Generates a WebAuthn registration challenge for a new user.

**Request body:**
```json
{ "username": "alice" }
```

**Server logic:**
1. Validate `username` — non-empty, 3–50 chars, alphanumeric + hyphens/underscores only
2. Check `users` table — if username exists, return 409
3. Generate `userId` as a random 16-byte buffer (not inserted yet — inserted on verify)
4. Call `generateRegistrationOptions()` from `@simplewebauthn/server`
5. Store `{ challenge, expiresAt: Date.now() + 60_000 }` in the challenge Map keyed by `username`
6. Return options

**Response `200 OK`:**
```json
{ "success": true, "data": { ...PublicKeyCredentialCreationOptionsJSON } }
```

**Error `409 Conflict`:**
```json
{ "success": false, "error": "Username already taken" }
```

**Error `400 Bad Request`:**
```json
{ "success": false, "error": "Username must be 3-50 characters (letters, numbers, - _)" }
```

---

#### `POST /api/auth/register-verify`

Verifies the WebAuthn registration response and creates the user + authenticator records.

**Request body:**
```json
{
  "username": "alice",
  "response": { ...RegistrationResponseJSON }
}
```

**Server logic:**
1. Retrieve challenge from Map by `username`; if missing or expired → 400 "Authentication challenge expired"
2. Delete challenge from Map (single-use)
3. Call `verifyRegistrationResponse()` with `expectedChallenge`, `expectedOrigin` (RP_ORIGIN), `expectedRPID` (RP_ID)
4. If `verified === false` → 400 "Registration verification failed"
5. Extract `registrationInfo.credential.id`, `registrationInfo.credential.publicKey`, `registrationInfo.credential.counter`
6. Encode `credential_id` with `isoBase64URL.fromBuffer(registrationInfo.credential.id)`
7. Encode `credential_public_key` with `isoBase64URL.fromBuffer(registrationInfo.credential.publicKey)`
8. Begin SQLite transaction:
   - `INSERT INTO users (username)` → get `userId`
   - `INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter, transports)`
9. Call `createSession(userId, username)` → set HTTP-only cookie
10. Return success

**Response `200 OK`:**
```json
{ "success": true, "data": { "id": 1, "username": "alice" } }
```

**Error `400 Bad Request`:**
```json
{ "success": false, "error": "Authentication challenge expired. Please try again." }
```

---

#### `POST /api/auth/login-options`

Generates a WebAuthn authentication challenge for an existing user.

**Request body:**
```json
{ "username": "alice" }
```

**Server logic:**
1. Look up user by username; if not found → 404 "User not found"
2. Fetch all `authenticators` for the user
3. Call `generateAuthenticationOptions()` with `allowCredentials` array
4. Store challenge in Map keyed by `username`
5. Return options

**Response `200 OK`:**
```json
{ "success": true, "data": { ...PublicKeyCredentialRequestOptionsJSON } }
```

**Error `404 Not Found`:**
```json
{ "success": false, "error": "User not found" }
```

---

#### `POST /api/auth/login-verify`

Verifies the WebAuthn authentication response and issues a session.

**Request body:**
```json
{
  "username": "alice",
  "response": { ...AuthenticationResponseJSON }
}
```

**Server logic:**
1. Retrieve challenge from Map; if missing or expired → 400
2. Delete challenge from Map
3. Look up user; find matching authenticator by `credential_id`
4. Call `verifyAuthenticationResponse()` with:
   - `expectedChallenge`
   - `expectedOrigin` (RP_ORIGIN)
   - `expectedRPID` (RP_ID)
   - `credential.id` decoded from isoBase64URL
   - `credential.publicKey` decoded from isoBase64URL
   - `credential.counter: authenticator.counter ?? 0`  **← CRITICAL: use ?? 0**
5. If `verified === false` → 400 "Authentication failed"
6. Update `authenticators SET counter = authenticationInfo.newCounter WHERE id = authenticator.id`
7. Call `createSession(userId, username)` → set HTTP-only cookie
8. Return user info

**Response `200 OK`:**
```json
{ "success": true, "data": { "id": 1, "username": "alice" } }
```

---

#### `POST /api/auth/logout`

Clears the session cookie.

**Server logic:** Call `deleteSession()` which sets `Set-Cookie` with an expired/empty value.

**Response `200 OK`:**
```json
{ "success": true }
```

---

#### `GET /api/auth/me`

Returns current user info if session is valid.

**Server logic:** Call `getSession()` — returns `null` if no valid session.

**Response `200 OK` (authenticated):**
```json
{ "success": true, "data": { "id": 1, "username": "alice" } }
```

**Response `200 OK` (unauthenticated):**
```json
{ "success": true, "data": null }
```

### 3.4 TypeScript Types

```typescript
// lib/types/user.ts

export interface User {
  id: number
  username: string
  created_at: string   // ISO-8601 UTC
}

export interface Session {
  userId: number
  username: string
  exp: number          // Unix timestamp (JWT expiry)
}

export interface Authenticator {
  id: number
  user_id: number
  credential_id: string         // isoBase64URL encoded
  credential_public_key: string // isoBase64URL encoded
  counter: number
  transports: string[] | null   // AuthenticatorTransport[]
  created_at: string            // ISO-8601 UTC
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

// lib/auth.ts — JWT payload shape
export interface JWTPayload {
  sub: string     // user ID as string
  username: string
  iat: number
  exp: number
}
```

```typescript
// lib/auth.ts — session management interface

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET not configured') })()
)
const COOKIE_NAME = 'session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7  // 7 days in seconds

export async function createSession(userId: number, username: string): Promise<void> {
  const token = await new SignJWT({ sub: String(userId), username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  })
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      userId:   Number(payload.sub),
      username: payload.username as string,
      exp:      payload.exp as number,
    }
  } catch {
    return null
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
```

---

## 4. React Components

### 4.1 Component Tree ASCII

```
app/login/page.tsx  ('use client')
└── main (centred layout)
    ├── [tab: 'register'] → RegisterForm
    └── [tab: 'login']    → LoginForm

app/layout.tsx
└── AppProviders
    └── AuthProvider     (wraps entire app, provides AuthContext)

components/layout/Header.tsx
└── LogoutButton         (only rendered when isAuthenticated)
```

### 4.2 Component Specs

---

#### `RegisterForm`

**File:** `components/auth/RegisterForm.tsx`
**Purpose:** Collect username and initiate WebAuthn registration ceremony.

**Props:**
```typescript
interface RegisterFormProps {
  onSuccess: () => void   // called after successful registration → redirects to /
}
```

**Local state:**
```typescript
const [username, setUsername] = useState('')
const [error, setError] = useState<string | null>(null)
const [isLoading, setIsLoading] = useState(false)
```

**Behaviour:**
1. On submit:
   a. Validate: `username.trim().length < 3` → `error = 'Username must be at least 3 characters'`
   b. Call `POST /api/auth/register-options` with `{ username }`
   c. Pass response to `startRegistration()` from `@simplewebauthn/browser`
   d. If user cancels browser prompt → `error = null`, `isLoading = false`, return
   e. Call `POST /api/auth/register-verify` with `{ username, response }`
   f. On success: call `onSuccess()` (→ `router.push('/')`)
   g. On any error: set `error` from response

2. Check WebAuthn support on mount:
   ```typescript
   useEffect(() => {
     if (typeof window !== 'undefined' && !window.PublicKeyCredential) {
       setError('Your browser does not support passkeys. Please use a modern browser.')
     }
   }, [])
   ```

**Design tokens:**
```
--color-surface-card
--color-border-default
--color-text-primary
--color-text-placeholder
--color-semantic-error
--color-interactive-primary
--color-interactive-primary-hover
--radius-md
--spacing-4
```

**Accessibility:**
- Username `<input>` has `<label htmlFor="username-register">` with id match
- Error uses `role="alert"` and `aria-live="assertive"`
- Submit button `aria-busy={isLoading}`
- `data-testid="register-form"`, `data-testid="register-username-input"`, `data-testid="register-submit-btn"`, `data-testid="register-error"`

---

#### `LoginForm`

**File:** `components/auth/LoginForm.tsx`
**Purpose:** Collect username and initiate WebAuthn authentication ceremony.

**Props:**
```typescript
interface LoginFormProps {
  onSuccess: () => void   // called after successful login → redirects to /
}
```

**Local state:**
```typescript
const [username, setUsername] = useState('')
const [error, setError] = useState<string | null>(null)
const [isLoading, setIsLoading] = useState(false)
```

**Behaviour:**
1. On submit:
   a. Validate: `username.trim().length === 0` → `error = 'Username is required'`
   b. Call `POST /api/auth/login-options` with `{ username }`
   c. If 404 from server → `error = 'User not found. Did you mean to register?'`
   d. Pass response to `startAuthentication()` from `@simplewebauthn/browser`
   e. If user cancels → `isLoading = false`, return silently
   f. Call `POST /api/auth/login-verify` with `{ username, response }`
   g. On success: call `onSuccess()` (→ `router.push('/')`)

2. Check WebAuthn support on mount (same as RegisterForm).

**Design tokens:** Same as `RegisterForm`.

**Accessibility:**
- `data-testid="login-form"`, `data-testid="login-username-input"`, `data-testid="login-submit-btn"`, `data-testid="login-error"`

---

#### `LogoutButton`

**File:** `components/auth/LogoutButton.tsx`
**Purpose:** Terminate the current session.

**Props:**
```typescript
interface LogoutButtonProps {
  className?: string
}
```

**Behaviour:**
1. On click: call `POST /api/auth/logout`
2. On success: call `queryClient.clear()` to purge all TanStack Query cache, then `router.push('/login')`
3. On error: show toast "Logout failed. Please try again."

**Design tokens:**
```
--color-interactive-secondary
--color-interactive-secondary-hover
--color-text-primary
--radius-md
```

**Accessibility:**
- `aria-label="Log out"`
- `data-testid="logout-button"`

---

#### `app/login/page.tsx`

**File:** `app/login/page.tsx`
**Purpose:** Container page with tab switching between Register and Login.

**Local state:**
```typescript
const [tab, setTab] = useState<'login' | 'register'>('login')
```

**Behaviour:**
- If user is already authenticated (from `useAuth`): redirect to `/` immediately
- Tab switcher renders two buttons; active tab gets primary styling
- `RegisterForm` rendered when `tab === 'register'`; `LoginForm` when `tab === 'login'`
- Both forms call `router.push('/')` on success

**Design tokens:**
```
--color-surface-page           (page background)
--color-surface-card           (card container)
--color-interactive-primary    (active tab)
--color-interactive-secondary  (inactive tab)
--shadow-md                    (card elevation)
--radius-lg                    (card corners)
```

**Accessibility:**
- Tab buttons use `role="tab"` and `aria-selected`
- Tab panels use `role="tabpanel"` with `aria-labelledby`
- `data-testid="login-page"`, `data-testid="tab-login"`, `data-testid="tab-register"`

---

## 5. TanStack Query Hooks

**File:** `lib/hooks/useAuth.ts`

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'
import { AuthContext } from '@/components/providers/AuthProvider'
import { fetchMe } from '@/lib/api/auth'
import type { User } from '@/lib/types/user'

export const authKeys = {
  me: () => ['auth', 'me'] as const,
}

// Low-level query hook — used internally by AuthProvider
export function useMeQuery() {
  return useQuery<User | null>({
    queryKey: authKeys.me(),
    queryFn:  fetchMe,               // GET /api/auth/me → returns User | null
    staleTime: 300_000,              // 5 min — session changes are infrequent
    gcTime:    600_000,              // 10 min
    retry:     false,                // don't retry 401 errors
  })
}

// Consumer hook — reads from AuthContext (populated by AuthProvider)
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

**File:** `components/providers/AuthProvider.tsx`

```typescript
'use client'

import { createContext, useMemo } from 'react'
import { useMeQuery } from '@/lib/hooks/useAuth'
import type { AuthState } from '@/lib/types/user'

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useMeQuery()

  const value = useMemo<AuthState>(() => ({
    user:            user ?? null,
    isLoading,
    isAuthenticated: user != null,
  }), [user, isLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
```

**Hook configuration:**
| Hook | Query key | Stale Time | Cache Time | Retry |
|------|-----------|-----------|-----------|-------|
| `useMeQuery` | `['auth', 'me']` | 5 min | 10 min | false |

---

## 6. State Management

| State | Type | Location | Notes |
|-------|------|----------|-------|
| Authenticated user | Server state | TanStack Query `['auth', 'me']` | Fetched once on load, refreshed after login/logout |
| `isAuthenticated`, `isLoading` | Derived | `AuthContext` | Computed from TanStack data |
| Login tab (`login`/`register`) | Local UI | `app/login/page.tsx` | `useState<'login' | 'register'>` |
| Form username | Local UI | `LoginForm`, `RegisterForm` | Controlled `<input>` |
| Form error | Local UI | `LoginForm`, `RegisterForm` | `useState<string | null>` |
| In-flight loading | Local UI | `LoginForm`, `RegisterForm` | `useState<boolean>` |
| Challenge store | In-memory | `lib/auth.ts` module scope | `Map<string, {challenge: string, expiresAt: number}>` |

**URL state:** None. The login page is always `/login`; no query params.

**Contexts written:**
- `AuthContext` — written only by `AuthProvider` via TanStack Query data

**Contexts read:**
- `AuthContext` — read by any component needing user info or auth state via `useAuth()`

---

## 7. Test Specifications

### 7.1 E2E Tests (Playwright)

**File:** `tests/01-authentication.spec.ts`

> **Playwright WebAuthn note:** Use `page.context().addVirtualAuthenticator(...)` from `playwright-webauthn` or the built-in Chromium virtual authenticator to simulate passkeys in CI.

```typescript
// playwright.config.ts additions
use: {
  timezoneId: 'Asia/Singapore',
  // Enable virtual authenticator for WebAuthn tests
  launchOptions: { args: ['--enable-features=WebAuthnBrowserBridge'] }
}
```

#### Test: Register a new user

```
Setup:
- Navigate to /login
- Set up virtual authenticator: await page.context().addVirtualAuthenticator({ protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true })

Steps:
1. Navigate to /login
2. Click [data-testid="tab-register"]
3. Fill [data-testid="register-username-input"] with a unique username (e.g., "testuser_" + Date.now())
4. Click [data-testid="register-submit-btn"]
5. Wait for navigation

Assertions:
- URL is '/'
- [data-testid="logout-button"] is visible (user is logged in)
```

#### Test: Login with existing passkey

```
Setup:
- Register a user first (via the registration flow above or API helper)
- Log out

Steps:
1. Navigate to /login
2. Ensure [data-testid="tab-login"] is active (default)
3. Fill [data-testid="login-username-input"] with the registered username
4. Click [data-testid="login-submit-btn"]
5. Wait for navigation

Assertions:
- URL is '/'
- [data-testid="logout-button"] is visible
```

#### Test: Logout clears session

```
Setup:
- Log in with a registered user

Steps:
1. Navigate to /
2. Click [data-testid="logout-button"]
3. Wait for navigation

Assertions:
- URL is '/login'
- Navigating to / redirects back to /login
```

#### Test: Unauthenticated access to / redirects to /login

```
Steps:
1. Clear all cookies: await page.context().clearCookies()
2. Navigate to /

Assertions:
- URL is '/login'
```

#### Test: Unauthenticated access to /calendar redirects to /login

```
Steps:
1. Clear all cookies
2. Navigate to /calendar

Assertions:
- URL is '/login'
```

#### Test: Duplicate username shows error

```
Setup:
- Register a user with username "duplicateuser" first

Steps:
1. Navigate to /login
2. Click [data-testid="tab-register"]
3. Fill username "duplicateuser"
4. Click [data-testid="register-submit-btn"]

Assertions:
- [data-testid="register-error"] is visible
- [data-testid="register-error"] contains "Username already taken"
- URL remains /login (no redirect)
```

#### Test: Username too short shows validation error

```
Steps:
1. Navigate to /login
2. Click [data-testid="tab-register"]
3. Fill username "ab" (only 2 chars)
4. Click [data-testid="register-submit-btn"]

Assertions:
- [data-testid="register-error"] is visible
- [data-testid="register-error"] contains "at least 3 characters"
- No API call is made (validated client-side)
```

#### Test: Login with unknown username shows error

```
Steps:
1. Navigate to /login
2. Fill [data-testid="login-username-input"] with "nosuchuser_99999"
3. Click [data-testid="login-submit-btn"]

Assertions:
- [data-testid="login-error"] contains "User not found"
```

### 7.2 Unit Tests

**File:** `lib/auth.test.ts`

| Function | Input | Expected Output |
|----------|-------|-----------------|
| `createSession` | `userId=1, username='alice'` | Sets HTTP-only cookie `session` with JWT |
| `getSession` | valid JWT cookie present | Returns `{ userId: 1, username: 'alice', exp: number }` |
| `getSession` | no cookie present | Returns `null` |
| `getSession` | expired JWT (exp in past) | Returns `null` |
| `getSession` | tampered JWT signature | Returns `null` |
| `deleteSession` | any | Deletes `session` cookie |

**File:** `lib/db/users.test.ts`

| Function | Input | Expected |
|----------|-------|----------|
| `createUser` | `{ username: 'alice' }` | User object with `id`, `username: 'alice'` |
| `createUser` | duplicate `username: 'alice'` | Throws `Error('Username already taken')` |
| `getUserByUsername` | `'alice'` (exists) | Returns `User` object |
| `getUserByUsername` | `'ghost'` (not exists) | Returns `null` |
| `createAuthenticator` | valid authenticator data | Authenticator object with `id` |
| `getAuthenticatorsByUserId` | `userId=1` | Array of authenticators |
| `updateAuthenticatorCounter` | `{ id: 1, counter: 5 }` | Updates counter in DB |
| `getAuthenticatorByCredentialId` | valid credential_id | Returns `Authenticator` or `null` |

**File:** `lib/auth.challenge.test.ts`

| Scenario | Input | Expected |
|----------|-------|----------|
| Store and retrieve challenge | `storeChallenge('alice', 'abc123')`, `getChallenge('alice')` | Returns `'abc123'` |
| Challenge consumed after retrieval | `getChallenge` called twice | Second call returns `null` (single-use) |
| Expired challenge | Store with `expiresAt = Date.now() - 1`, retrieve | Returns `null` |
| Unknown username | `getChallenge('nobody')` | Returns `null` |

### 7.3 Integration Tests

**File:** `app/api/auth/register-options/route.test.ts`

```
POST /api/auth/register-options
- valid new username → 200 + PublicKeyCredentialCreationOptionsJSON
- username already exists → 409 + "Username already taken"
- username too short (< 3 chars) → 400
- username with invalid chars → 400
- missing username → 400
```

**File:** `app/api/auth/register-verify/route.test.ts`

```
POST /api/auth/register-verify
- valid response after challenge → 200 + user data + Set-Cookie header
- challenge expired (none in Map) → 400 + "Authentication challenge expired"
- verification fails (bad signature) → 400 + "Registration verification failed"
- body missing 'response' field → 400
```

**File:** `app/api/auth/login-options/route.test.ts`

```
POST /api/auth/login-options
- known username → 200 + PublicKeyCredentialRequestOptionsJSON
- unknown username → 404 + "User not found"
- missing username → 400
```

**File:** `app/api/auth/login-verify/route.test.ts`

```
POST /api/auth/login-verify
- valid response → 200 + user data + Set-Cookie
- challenge expired → 400
- bad credential → 400
```

**File:** `app/api/auth/me/route.test.ts`

```
GET /api/auth/me
- valid session cookie → 200 + { success: true, data: { id, username } }
- no session cookie → 200 + { success: true, data: null }
- tampered/expired JWT → 200 + { success: true, data: null }
```

**File:** `app/api/auth/logout/route.test.ts`

```
POST /api/auth/logout
- any request → 200 + clears session cookie (Set-Cookie with maxAge=0 or empty value)
```

**File:** `middleware.test.ts`

```
GET /
- no session cookie → 302 redirect to /login
- valid session cookie → 200 (no redirect)

GET /calendar
- no session cookie → 302 redirect to /login

GET /login
- no session cookie → 200 (public route, no redirect)
- valid session cookie → 200 (stays on login page, component handles redirect)

GET /api/auth/me
- not intercepted by middleware → passes through
```

---

## 8. Acceptance Criteria

1. A new user can register by entering a username (3–50 chars), completing a biometric/PIN prompt, and being redirected to `/`.
2. A returning user can log in by entering their username, completing a biometric/PIN prompt, and being redirected to `/`.
3. After logout, navigating to `/` or `/calendar` redirects to `/login`.
4. The session cookie is HTTP-only, `SameSite=lax`, and `Secure` in production.
5. The JWT expires after 7 days; expired tokens are treated as unauthenticated.
6. Registering with an existing username returns 409 and shows "Username already taken" in the UI.
7. A username shorter than 3 characters or longer than 50 characters is rejected client-side and server-side.
8. Waiting more than 60 seconds after requesting options before completing the browser prompt results in "Authentication challenge expired. Please try again."
9. Cancelling the browser biometric prompt returns the form to its ready state (no error shown).
10. On a browser that does not support `window.PublicKeyCredential`, a message "Your browser does not support passkeys. Please use a modern browser." is shown.
11. `GET /api/auth/me` returns `{ data: null }` (not 401) when no session exists.
12. All routes except `/login` and `/api/auth/*` are protected by `middleware.ts`.
13. `authenticator.counter ?? 0` is used in login-verify to handle undefined counters.
14. `isoBase64URL.fromBuffer` / `isoBase64URL.toBuffer` are used for all credential encoding/decoding.
15. `JWT_SECRET`, `RP_ID`, `RP_NAME`, `RP_ORIGIN` are read from environment variables; missing variables throw an error at startup, not at runtime.
16. The challenge Map is cleared after each use (single-use challenge).
17. All passwords/secrets are absent from logs and error messages.
18. The `/login` page has two accessible tabs (Register, Login) with proper `role="tab"` and `aria-selected` attributes.

---

## 9. Integration Points

### 9.1 What This Feature Consumes

| Dependency | Location | Usage |
|------------|----------|-------|
| `jose` library | npm | JWT sign and verify |
| `@simplewebauthn/server` | npm | `generateRegistrationOptions`, `verifyRegistrationResponse`, `generateAuthenticationOptions`, `verifyAuthenticationResponse` |
| `@simplewebauthn/browser` | npm | `startRegistration`, `startAuthentication` (client-side only) |
| `@simplewebauthn/server/helpers` | npm | `isoBase64URL.fromBuffer`, `isoBase64URL.toBuffer` |
| `next/headers` | Next.js | `cookies()` for reading/setting the session cookie |
| `lib/timezone.ts` | Shared | `nowSG()` used if any timestamp logic is needed |

### 9.2 What This Feature Exposes

| Export | Downstream Consumers |
|--------|---------------------|
| `users` table | All features that reference `user_id` FK (todos, tags, templates) |
| `getSession()` | Every API route handler calls this to authenticate requests |
| `AuthContext` / `useAuth()` | Every component that needs user info or auth state |
| `session` cookie | `middleware.ts` reads it for route protection |
| `User` type | `lib/types/user.ts` — used throughout the codebase |
| `GET /api/auth/me` | `AuthProvider` fetches this on mount to hydrate auth state |
| `middleware.ts` | Protects `/` and `/calendar` routes automatically |

---

## 10. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| `window.PublicKeyCredential` undefined | Show unsupported browser message; disable form |
| User cancels biometric prompt | `startRegistration`/`startAuthentication` throws `NotAllowedError`; catch it, reset `isLoading` to `false`, do not show error |
| Challenge expired (> 60s) | Server returns 400; client shows "Authentication challenge expired. Please try again." |
| Duplicate username registration | Server returns 409; client shows "Username already taken" |
| Username with SQL-injection chars | Server validates format (alphanumeric + `-_` only) → 400; SQLite parameterised queries prevent injection anyway |
| `authenticator.counter` is `undefined` | Always use `authenticator.counter ?? 0` before passing to `verifyAuthenticationResponse` |
| `credential.publicKey` is a `Uint8Array` | Must encode with `isoBase64URL.fromBuffer()` before storing in SQLite TEXT column |
| `credential.id` mismatch on login | No authenticator found → 400 "Authentication failed" (do not reveal whether user exists) |
| JWT_SECRET not set | `lib/auth.ts` throws `Error('JWT_SECRET not configured')` at module load |
| RP_ID mismatch | `verifyRegistrationResponse` returns `verified: false` → 400 |
| RP_ORIGIN mismatch (HTTP vs HTTPS) | Same as above — must match exactly; in development use `http://localhost:3000` |
| Multiple authenticators per user | `getAuthenticatorsByUserId` returns all; `generateAuthenticationOptions` lists all as `allowCredentials` |
| User deleted while session active | `GET /api/auth/me` returns `{ data: null }` (user not found in DB); AuthProvider updates state; middleware redirects on next navigation |
| Session cookie present but JWT is tampered | `jwtVerify` throws; `getSession()` returns `null`; treated as unauthenticated |
| Browser storage cleared (IndexedDB passkey gone) | User must re-register with same username; old authenticator row remains (orphaned but harmless) |
| Concurrent registration requests for same username | First succeeds (unique constraint); second gets 409 |
| CSRF on logout | Not applicable — session cookie is HTTP-only; `POST /api/auth/logout` only clears the cookie, no state change |

---

## 11. Out of Scope

- Password-based authentication (WebAuthn only)
- OAuth / social login (Google, GitHub, etc.)
- Multi-device passkey sync (each device registers separately)
- Passkey management UI (view/delete registered authenticators)
- "Remember me" / session duration preferences
- Account deletion
- Admin roles or role-based access control
- Email verification or recovery codes
- Multi-factor authentication (WebAuthn is already phishing-resistant)
- Rate limiting on auth endpoints (recommended for production but not implemented here)
- Redis challenge store for multi-process deployments
- Authenticator attestation validation (basic verification only)

---

## 12. Singapore Timezone Considerations

Authentication itself is timezone-independent (JWT expiry is calculated in Unix timestamps / UTC). However, the following apply:

- All `created_at` timestamps in `users` and `authenticators` tables are stored as UTC ISO-8601 strings using SQLite's `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`.
- If any auth-related timestamp is ever displayed to the user (e.g., "Account created on…"), it must be formatted using `lib/timezone.ts#toSGDisplay()`.
- The challenge TTL (`60_000` ms) is calculated using `Date.now()` — this is timezone-independent and correct.
- The JWT `exp` claim is a Unix timestamp (seconds since epoch) — timezone-independent.

```typescript
// DO NOT do this for display:
new Date(user.created_at).toLocaleDateString()

// DO this:
import { toSGDisplay } from '@/lib/timezone'
toSGDisplay(user.created_at)   // 'Apr 8, 2026 10:30'
```
