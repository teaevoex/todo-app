# PRP 11: Authentication (WebAuthn/Passkeys)

## Feature Overview

Implement passwordless authentication using WebAuthn/Passkeys. Users register and log in using platform authenticators (fingerprint, Face ID, Windows Hello) or security keys. The system uses `@simplewebauthn/server` and `@simplewebauthn/browser` libraries. Sessions are managed via JWT tokens stored as HTTP-only cookies with a 7-day expiry. Middleware protects all application routes (`/` and `/calendar`), redirecting unauthenticated users to `/login`. This is a **foundation feature** — all other PRPs depend on authentication for user-scoped data.

---

## User Stories

### As a user, I want to:

1. **Register with a passkey** so I can create an account without a password
2. **Log in with my passkey** so I can access my todos securely
3. **Stay logged in for 7 days** so I don't have to authenticate frequently
4. **Log out** so I can end my session on shared devices
5. **See a login page** when not authenticated so I know I need to sign in
6. **Be redirected to the app** after successful login/registration

### As the system, I need to:

7. **Protect all routes** so unauthenticated users cannot access todo data
8. **Scope all data to the user** so users only see their own todos
9. **Handle multiple authenticators** per user account

---

## User Flow

### Registration

```
1. User navigates to /login
2. User enters a username in the input field
3. User clicks "Register"
4. Browser prompts for passkey creation:
   - Platform authenticator (fingerprint, Face ID, Windows Hello)
   - Or security key (USB, NFC)
5. User completes the authenticator gesture
6. Server verifies the registration response
7. Server creates the user account and stores the credential
8. Server creates a JWT session token (HTTP-only cookie)
9. User is redirected to / (main todo page)
```

### Login

```
1. User navigates to /login
2. User enters their username
3. User clicks "Login"
4. Browser prompts for passkey verification
5. User completes the authenticator gesture
6. Server verifies the authentication response
7. Server updates the authenticator counter
8. Server creates a JWT session token (HTTP-only cookie)
9. User is redirected to / (main todo page)
```

### Logout

```
1. User clicks "Logout" button (top-right corner of any page)
2. Client calls POST /api/auth/logout
3. Server clears the session cookie
4. User is redirected to /login
```

### Accessing Protected Routes

```
1. Unauthenticated user navigates to / or /calendar
2. Middleware detects missing/invalid session cookie
3. User is redirected to /login
4. After successful login, user is redirected back to /
```

---

## Technical Requirements

### Database Schema

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Authenticators table (WebAuthn credentials)
CREATE TABLE IF NOT EXISTS authenticators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  credential_public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Users Table:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INTEGER | Auto | Auto-increment | Primary key |
| `username` | TEXT | Yes | — | Unique username |
| `created_at` | TEXT | Yes | `datetime('now')` | Account creation timestamp |

**Authenticators Table:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | INTEGER | Auto | Auto-increment | Primary key |
| `user_id` | INTEGER | Yes | — | Foreign key to `users` |
| `credential_id` | TEXT | Yes | — | Base64URL-encoded credential ID |
| `credential_public_key` | TEXT | Yes | — | Base64URL-encoded public key |
| `counter` | INTEGER | Yes | `0` | Signature counter for replay protection |
| `transports` | TEXT | No | `NULL` | JSON array of transport types |
| `created_at` | TEXT | Yes | `datetime('now')` | Credential registration timestamp |

### TypeScript Interfaces

```typescript
// lib/db.ts

export interface User {
  id: number
  username: string
  created_at: string
}

export interface Authenticator {
  id: number
  user_id: number
  credential_id: string
  credential_public_key: string
  counter: number
  transports: string | null
  created_at: string
}
```

### Database CRUD Operations

```typescript
// lib/db.ts — userDB object

export const userDB = {
  findByUsername(username: string): User | undefined {
    return db.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).get(username) as User | undefined
  },

  findById(id: number): User | undefined {
    return db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).get(id) as User | undefined
  },

  create(username: string): User {
    const result = db.prepare(
      'INSERT INTO users (username) VALUES (?)'
    ).run(username.trim())
    return userDB.findById(result.lastInsertRowid as number)!
  },
}
```

```typescript
// lib/db.ts — authenticatorDB object

export const authenticatorDB = {
  findByCredentialId(credentialId: string): Authenticator | undefined {
    return db.prepare(
      'SELECT * FROM authenticators WHERE credential_id = ?'
    ).get(credentialId) as Authenticator | undefined
  },

  findByUserId(userId: number): Authenticator[] {
    return db.prepare(
      'SELECT * FROM authenticators WHERE user_id = ?'
    ).all(userId) as Authenticator[]
  },

  create(userId: number, data: {
    credentialId: string
    credentialPublicKey: string
    counter: number
    transports?: string
  }): Authenticator {
    const result = db.prepare(`
      INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter, transports)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userId,
      data.credentialId,
      data.credentialPublicKey,
      data.counter ?? 0,
      data.transports ?? null
    )
    return db.prepare('SELECT * FROM authenticators WHERE id = ?')
      .get(result.lastInsertRowid) as Authenticator
  },

  updateCounter(credentialId: string, counter: number): void {
    db.prepare(
      'UPDATE authenticators SET counter = ? WHERE credential_id = ?'
    ).run(counter, credentialId)
  },
}
```

---

### Session Management

```typescript
// lib/auth.ts

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

const COOKIE_NAME = 'session'
const SESSION_DURATION = 7 * 24 * 60 * 60 // 7 days in seconds

export interface Session {
  userId: number
  username: string
}

export async function createSession(userId: number, username: string): Promise<void> {
  const token = await new SignJWT({ userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(JWT_SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION,
    path: '/',
  })
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      userId: payload.userId as number,
      username: payload.username as string,
    }
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
```

**Session Properties:**

| Property | Value |
|----------|-------|
| Token type | JWT (HS256) |
| Storage | HTTP-only cookie |
| Name | `session` |
| Duration | 7 days |
| Secure flag | `true` in production |
| SameSite | `lax` |
| Path | `/` |

**Critical: JWT_SECRET**
- Must be set via environment variable `JWT_SECRET`
- Fallback value is for development only
- Must be changed in production

---

### Middleware

```typescript
// middleware.ts

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, JWT_SECRET)
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/', '/calendar'],
}
```

**Protected Routes:**
- `/` — Main todo page
- `/calendar` — Calendar view

**Unprotected Routes:**
- `/login` — Login/registration page
- `/api/auth/*` — Authentication API routes
- `/api/*` — API routes (protected by `getSession()` inside each handler)

---

### WebAuthn Configuration

```typescript
// lib/webauthn.ts (or inline in API routes)

const rpName = 'Todo App'
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost'
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000'
```

**Relying Party Configuration:**

| Property | Dev Value | Production Value |
|----------|-----------|-----------------|
| `rpName` | `'Todo App'` | `'Todo App'` |
| `rpID` | `'localhost'` | Your domain (e.g., `'todo.example.com'`) |
| `origin` | `'http://localhost:3000'` | `'https://todo.example.com'` |

---

### API Endpoints

#### `POST /api/auth/register-options` — Get registration challenge

```typescript
// app/api/auth/register-options/route.ts

import { generateRegistrationOptions } from '@simplewebauthn/server'

export async function POST(request: NextRequest) {
  const { username } = await request.json()

  if (!username || !username.trim()) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 })
  }

  // Check if username is already taken
  const existingUser = userDB.findByUsername(username.trim())
  if (existingUser) {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
  }

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: username.trim(),
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })

  // Store challenge temporarily (in-memory or cookie)
  // For simplicity, store in a cookie
  const cookieStore = await cookies()
  cookieStore.set('registration-challenge', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/',
  })
  cookieStore.set('registration-username', username.trim(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })

  return NextResponse.json(options)
}
```

**Request Body:**
```json
{ "username": "john" }
```

**Response:** `200 OK` — WebAuthn `PublicKeyCredentialCreationOptions`

---

#### `POST /api/auth/register-verify` — Verify registration response

```typescript
// app/api/auth/register-verify/route.ts

import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'

export async function POST(request: NextRequest) {
  const body = await request.json()

  const cookieStore = await cookies()
  const expectedChallenge = cookieStore.get('registration-challenge')?.value
  const username = cookieStore.get('registration-username')?.value

  if (!expectedChallenge || !username) {
    return NextResponse.json({ error: 'Registration session expired' }, { status: 400 })
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Registration verification failed' }, { status: 400 })
    }

    const { credential } = verification.registrationInfo

    // Create user
    const user = userDB.create(username)

    // Store authenticator
    authenticatorDB.create(user.id, {
      credentialId: isoBase64URL.fromBuffer(credential.id),
      credentialPublicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter ?? 0,
      transports: body.response?.transports
        ? JSON.stringify(body.response.transports)
        : null,
    })

    // Create session
    await createSession(user.id, user.username)

    // Clean up challenge cookies
    cookieStore.delete('registration-challenge')
    cookieStore.delete('registration-username')

    return NextResponse.json({ verified: true, username: user.username })
  } catch (error) {
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 400 }
    )
  }
}
```

**Response:** `200 OK` — `{ verified: true, username: "john" }`

**Critical Pattern: `counter: credential.counter ?? 0`**
- The counter field can be `undefined` from some authenticators
- Always use `?? 0` to provide a safe default
- This was a known bug fix in the project

---

#### `POST /api/auth/login-options` — Get login challenge

```typescript
// app/api/auth/login-options/route.ts

import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'

export async function POST(request: NextRequest) {
  const { username } = await request.json()

  if (!username || !username.trim()) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 })
  }

  const user = userDB.findByUsername(username.trim())
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const authenticators = authenticatorDB.findByUserId(user.id)
  if (authenticators.length === 0) {
    return NextResponse.json({ error: 'No authenticators registered' }, { status: 400 })
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: authenticators.map(auth => ({
      id: isoBase64URL.toBuffer(auth.credential_id),
      type: 'public-key',
      transports: auth.transports ? JSON.parse(auth.transports) : undefined,
    })),
    userVerification: 'preferred',
  })

  // Store challenge
  const cookieStore = await cookies()
  cookieStore.set('login-challenge', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })
  cookieStore.set('login-username', username.trim(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })

  return NextResponse.json(options)
}
```

**Request Body:**
```json
{ "username": "john" }
```

**Response:** `200 OK` — WebAuthn `PublicKeyCredentialRequestOptions`

---

#### `POST /api/auth/login-verify` — Verify login response

```typescript
// app/api/auth/login-verify/route.ts

import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'

export async function POST(request: NextRequest) {
  const body = await request.json()

  const cookieStore = await cookies()
  const expectedChallenge = cookieStore.get('login-challenge')?.value
  const username = cookieStore.get('login-username')?.value

  if (!expectedChallenge || !username) {
    return NextResponse.json({ error: 'Login session expired' }, { status: 400 })
  }

  const user = userDB.findByUsername(username)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Find the authenticator that was used
  const credentialId = isoBase64URL.fromBuffer(body.id)
  const authenticator = authenticatorDB.findByCredentialId(credentialId)

  if (!authenticator) {
    return NextResponse.json({ error: 'Authenticator not found' }, { status: 400 })
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: isoBase64URL.toBuffer(authenticator.credential_id),
        publicKey: isoBase64URL.toBuffer(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
        transports: authenticator.transports
          ? JSON.parse(authenticator.transports)
          : undefined,
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 400 })
    }

    // Update counter
    authenticatorDB.updateCounter(
      authenticator.credential_id,
      verification.authenticationInfo.newCounter ?? 0
    )

    // Create session
    await createSession(user.id, user.username)

    // Clean up challenge cookies
    cookieStore.delete('login-challenge')
    cookieStore.delete('login-username')

    return NextResponse.json({ verified: true, username: user.username })
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 400 }
    )
  }
}
```

**Response:** `200 OK` — `{ verified: true, username: "john" }`

**Critical Pattern: `counter: authenticator.counter ?? 0`**
- Used both when building the credential object for verification
- And when updating the counter after verification (`newCounter ?? 0`)
- Prevents crashes from undefined counter values

---

#### `POST /api/auth/logout` — End session

```typescript
// app/api/auth/logout/route.ts

export async function POST() {
  await clearSession()
  return NextResponse.json({ success: true })
}
```

**Response:** `200 OK` — `{ success: true }`

---

#### `GET /api/auth/session` — Check current session

```typescript
// app/api/auth/session/route.ts

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json({
    authenticated: true,
    username: session.username,
  })
}
```

**Response:** `200 OK` — `{ authenticated: true, username: "john" }`

---

## UI Components

### Login Page

```tsx
// app/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50
                    dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8
                      w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6 dark:text-white">
          Todo App
        </h1>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm
                          dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Username input */}
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full border rounded-lg px-4 py-3 mb-4
                     dark:bg-gray-700 dark:border-gray-600 dark:text-white
                     dark:placeholder-gray-400"
          disabled={loading}
        />

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleRegister}
            disabled={loading || !username.trim()}
            className="flex-1 py-3 bg-blue-500 text-white rounded-lg
                       hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                       dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            {loading ? 'Processing...' : 'Register'}
          </button>
          <button
            onClick={handleLogin}
            disabled={loading || !username.trim()}
            className="flex-1 py-3 bg-green-500 text-white rounded-lg
                       hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed
                       dark:bg-green-600 dark:hover:bg-green-700"
          >
            {loading ? 'Processing...' : 'Login'}
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Use your device's biometric or security key to authenticate.
          No passwords needed.
        </p>
      </div>
    </div>
  )
}
```

### Logout Button

Displayed on every protected page (top-right corner):

```tsx
// Shared across app/page.tsx and app/calendar/page.tsx

<div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold dark:text-white">My Todos</h1>
  <div className="flex items-center gap-3">
    <span className="text-sm text-gray-500 dark:text-gray-400">
      {username}
    </span>
    <button
      onClick={handleLogout}
      className="text-sm px-3 py-1.5 rounded-lg border
                 border-red-300 text-red-600 hover:bg-red-50
                 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      Logout
    </button>
  </div>
</div>
```

---

## Event Handlers

```typescript
// app/login/page.tsx

async function handleRegister() {
  setError('')
  setLoading(true)

  try {
    // Step 1: Get registration options
    const optionsRes = await fetch('/api/auth/register-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim() }),
    })

    if (!optionsRes.ok) {
      const data = await optionsRes.json()
      setError(data.error || 'Registration failed')
      return
    }

    const options = await optionsRes.json()

    // Step 2: Create credential with browser API
    const credential = await startRegistration({ optionsJSON: options })

    // Step 3: Verify with server
    const verifyRes = await fetch('/api/auth/register-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credential),
    })

    if (!verifyRes.ok) {
      const data = await verifyRes.json()
      setError(data.error || 'Registration verification failed')
      return
    }

    // Success — redirect to main page
    router.push('/')
  } catch (err) {
    setError('Registration was cancelled or failed. Please try again.')
  } finally {
    setLoading(false)
  }
}

async function handleLogin() {
  setError('')
  setLoading(true)

  try {
    // Step 1: Get authentication options
    const optionsRes = await fetch('/api/auth/login-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim() }),
    })

    if (!optionsRes.ok) {
      const data = await optionsRes.json()
      setError(data.error || 'Login failed')
      return
    }

    const options = await optionsRes.json()

    // Step 2: Authentication with browser API
    const credential = await startAuthentication({ optionsJSON: options })

    // Step 3: Verify with server
    const verifyRes = await fetch('/api/auth/login-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credential),
    })

    if (!verifyRes.ok) {
      const data = await verifyRes.json()
      setError(data.error || 'Login verification failed')
      return
    }

    // Success — redirect to main page
    router.push('/')
  } catch (err) {
    setError('Login was cancelled or failed. Please try again.')
  } finally {
    setLoading(false)
  }
}

// Shared logout handler (used in app/page.tsx and app/calendar/page.tsx)
async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}
```

---

## WebAuthn Flow Diagrams

### Registration Flow

```
Client                          Server                        Authenticator
  |                               |                               |
  |-- POST /register-options ---->|                               |
  |   { username }                |                               |
  |                               |-- Generate challenge -------->|
  |<-- options (challenge) -------|                               |
  |                               |                               |
  |-- startRegistration() ------->|                               |
  |                               |                               |
  |<---- credential response -----|                               |
  |                               |                               |
  |-- POST /register-verify ----->|                               |
  |   { credential }              |                               |
  |                               |-- Verify response             |
  |                               |-- Create user                 |
  |                               |-- Store authenticator         |
  |                               |-- Create session (JWT)        |
  |<-- { verified: true } --------|                               |
  |                               |                               |
  |-- Redirect to / ------------>                                 |
```

### Login Flow

```
Client                          Server                        Authenticator
  |                               |                               |
  |-- POST /login-options ------->|                               |
  |   { username }                |                               |
  |                               |-- Find user + authenticators  |
  |                               |-- Generate challenge          |
  |<-- options (challenge) -------|                               |
  |                               |                               |
  |-- startAuthentication() ----->|                               |
  |                               |                               |
  |<---- assertion response ------|                               |
  |                               |                               |
  |-- POST /login-verify -------->|                               |
  |   { assertion }               |                               |
  |                               |-- Find authenticator by ID    |
  |                               |-- Verify response             |
  |                               |-- Update counter              |
  |                               |-- Create session (JWT)        |
  |<-- { verified: true } --------|                               |
  |                               |                               |
  |-- Redirect to / ------------>                                 |
```

---

## Challenge Storage

Challenges are stored in HTTP-only cookies with a 5-minute expiry:

| Cookie | Purpose | Expiry |
|--------|---------|--------|
| `registration-challenge` | Registration challenge string | 5 min |
| `registration-username` | Username being registered | 5 min |
| `login-challenge` | Login challenge string | 5 min |
| `login-username` | Username logging in | 5 min |

**Why cookies (not in-memory)?**
- Next.js API routes are stateless — no in-memory store persists
- Cookies are tied to the client session
- HTTP-only prevents JavaScript access
- Short expiry (5 min) limits replay window

**Alternatives considered:**
- In-memory map: doesn't work with serverless/multiple instances
- Database: unnecessary persistence for ephemeral challenges
- Cookies: simple, stateless, self-expiring ✓

---

## Buffer Encoding

WebAuthn credentials involve binary data that must be encoded for storage:

```typescript
import { isoBase64URL } from '@simplewebauthn/server/helpers'

// Encoding (Buffer → String) for storage
const credentialIdStr = isoBase64URL.fromBuffer(credential.id)
const publicKeyStr = isoBase64URL.fromBuffer(credential.publicKey)

// Decoding (String → Buffer) for verification
const credentialIdBuf = isoBase64URL.toBuffer(authenticator.credential_id)
const publicKeyBuf = isoBase64URL.toBuffer(authenticator.credential_public_key)
```

**Key rule:** Always use `isoBase64URL` from `@simplewebauthn/server/helpers`. Do not use Node.js `Buffer.from()` directly — the encoding format must be base64url (not base64).

---

## Edge Cases

### Registration

| Scenario | Expected Behavior |
|----------|-------------------|
| Empty username | "Username is required" (400) |
| Whitespace-only username | "Username is required" (400) |
| Username already taken | "Username already exists" (409) |
| User cancels authenticator prompt | "Registration was cancelled" error in UI |
| Authenticator not supported | Browser shows unsupported error |
| Challenge expired (>5 min) | "Registration session expired" (400) |
| Invalid registration response | "Registration verification failed" (400) |
| Counter is undefined | Defaults to 0 via `?? 0` |

### Login

| Scenario | Expected Behavior |
|----------|-------------------|
| Empty username | "Username is required" (400) |
| Username not found | "User not found" (404) |
| No authenticators registered | "No authenticators registered" (400) |
| User cancels authenticator prompt | "Login was cancelled" error in UI |
| Wrong authenticator for user | "Authenticator not found" (400) |
| Challenge expired (>5 min) | "Login session expired" (400) |
| Invalid authentication response | "Authentication failed" (400) |
| Counter mismatch (replay attack) | Verification fails per WebAuthn spec |
| Counter is undefined | Defaults to 0 via `?? 0` |

### Session

| Scenario | Expected Behavior |
|----------|-------------------|
| Valid session cookie | User authenticated, data accessible |
| Missing session cookie | Redirect to /login |
| Expired JWT (>7 days) | Redirect to /login |
| Tampered JWT | Redirect to /login (signature invalid) |
| Cookie deleted | Redirect to /login |

### Logout

| Scenario | Expected Behavior |
|----------|-------------------|
| Click logout | Cookie cleared, redirect to /login |
| Multiple logout calls | Idempotent — no error |

### Multi-Authenticator

| Scenario | Expected Behavior |
|----------|-------------------|
| User registers second authenticator | Both stored, either can be used for login |
| Login with authenticator A | Uses authenticator A's counter |
| Login with authenticator B | Uses authenticator B's counter |

---

## Acceptance Criteria

### Registration

- [ ] Login page is displayed at `/login`
- [ ] Username input field is present
- [ ] "Register" button creates a new account
- [ ] Browser prompts for passkey creation (biometric/security key)
- [ ] Successful registration creates user and authenticator records
- [ ] Session cookie is set after registration
- [ ] User is redirected to `/` after registration
- [ ] Duplicate username is rejected with clear error message
- [ ] Empty username is rejected
- [ ] Registration cancellation shows user-friendly error

### Login

- [ ] "Login" button authenticates existing user
- [ ] Browser prompts for passkey verification
- [ ] Successful login sets session cookie
- [ ] User is redirected to `/` after login
- [ ] Non-existent username shows "User not found"
- [ ] Login cancellation shows user-friendly error
- [ ] Counter is updated after successful login

### Session Management

- [ ] JWT session token stored as HTTP-only cookie
- [ ] Session expires after 7 days
- [ ] `getSession()` returns user data for valid sessions
- [ ] `getSession()` returns null for invalid/expired sessions
- [ ] Cookie is secure in production (`secure: true`)

### Route Protection

- [ ] `/` redirects to `/login` when not authenticated
- [ ] `/calendar` redirects to `/login` when not authenticated
- [ ] `/login` is accessible without authentication
- [ ] API routes return 401 when `getSession()` returns null

### Logout

- [ ] "Logout" button is visible on protected pages
- [ ] Username is displayed next to logout button
- [ ] Clicking logout clears the session cookie
- [ ] User is redirected to `/login` after logout

### Security

- [ ] Challenges stored in HTTP-only cookies (not accessible by JavaScript)
- [ ] Challenge cookies expire after 5 minutes
- [ ] Challenge cookies cleaned up after verification
- [ ] JWT secret configurable via environment variable
- [ ] No sensitive data exposed in error messages
- [ ] Counter validation prevents replay attacks
- [ ] `?? 0` used for counter fields to prevent undefined errors

### Dark Mode

- [ ] Login page renders correctly in dark mode
- [ ] Error messages styled for dark mode
- [ ] Logout button styled for dark mode

---

## Testing Requirements

### E2E Tests (Playwright)

WebAuthn testing requires a virtual authenticator. Playwright supports this via Chromium's CDP:

```typescript
// playwright.config.ts — virtual authenticator setup

import { defineConfig } from '@playwright/test'

export default defineConfig({
  use: {
    baseURL: 'http://localhost:3000',
    timezoneId: 'Asia/Singapore',
    launchOptions: {
      args: [
        '--enable-web-authentication-testing-api',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
```

```typescript
// tests/01-authentication.spec.ts

import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {

  test.beforeEach(async ({ page }) => {
    // Set up virtual authenticator
    const cdpSession = await page.context().newCDPSession(page)
    await cdpSession.send('WebAuthn.enable')
    await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    })
  })

  test('should show login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Todo App')).toBeVisible()
    await expect(page.getByPlaceholder('Username')).toBeVisible()
    await expect(page.getByText('Register')).toBeVisible()
    await expect(page.getByText('Login')).toBeVisible()
  })

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('should redirect from /calendar to login', async ({ page }) => {
    await page.goto('/calendar')
    await expect(page).toHaveURL(/\/login/)
  })

  test('should register a new user', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'testuser')
    await page.click('button:has-text("Register")')

    // Should redirect to main page
    await expect(page).toHaveURL(/\/$/)
  })

  test('should reject empty username on register', async ({ page }) => {
    await page.goto('/login')
    // Register button should be disabled without username
    const registerBtn = page.locator('button:has-text("Register")')
    await expect(registerBtn).toBeDisabled()
  })

  test('should reject duplicate username', async ({ page }) => {
    await page.goto('/login')

    // Register first user
    await page.fill('input[placeholder="Username"]', 'duplicateuser')
    await page.click('button:has-text("Register")')
    await expect(page).toHaveURL(/\/$/)

    // Logout
    await page.click('button:has-text("Logout")')

    // Try to register same username
    await page.fill('input[placeholder="Username"]', 'duplicateuser')
    await page.click('button:has-text("Register")')

    await expect(page.getByText('Username already exists')).toBeVisible()
  })

  test('should login with registered user', async ({ page }) => {
    await page.goto('/login')

    // Register
    await page.fill('input[placeholder="Username"]', 'loginuser')
    await page.click('button:has-text("Register")')
    await expect(page).toHaveURL(/\/$/)

    // Logout
    await page.click('button:has-text("Logout")')

    // Login
    await page.fill('input[placeholder="Username"]', 'loginuser')
    await page.click('button:has-text("Login")')
    await expect(page).toHaveURL(/\/$/)
  })

  test('should reject login for non-existent user', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'nonexistentuser')
    await page.click('button:has-text("Login")')

    await expect(page.getByText('User not found')).toBeVisible()
  })

  test('should display username after login', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'displayuser')
    await page.click('button:has-text("Register")')

    await expect(page.getByText('displayuser')).toBeVisible()
  })

  test('should logout successfully', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'logoutuser')
    await page.click('button:has-text("Register")')

    // Click logout
    await page.click('button:has-text("Logout")')

    // Should be on login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('should not access protected route after logout', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'protecteduser')
    await page.click('button:has-text("Register")')

    await page.click('button:has-text("Logout")')

    // Try to access protected route
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('should scope data to authenticated user', async ({ page }) => {
    // Register user A and create a todo
    await page.goto('/login')
    await page.fill('input[placeholder="Username"]', 'userA')
    await page.click('button:has-text("Register")')

    await page.fill('input[placeholder="Add a new todo..."]', 'User A Todo')
    await page.click('button:has-text("Add")')
    await expect(page.getByText('User A Todo')).toBeVisible()

    // Logout, register user B
    await page.click('button:has-text("Logout")')
    await page.fill('input[placeholder="Username"]', 'userB')
    await page.click('button:has-text("Register")')

    // User B should NOT see User A's todo
    await expect(page.getByText('User A Todo')).not.toBeVisible()
  })
})
```

### Test Helper — Login Method

```typescript
// tests/helpers.ts

export class TodoHelper {
  constructor(private page: Page) {}

  async login(username: string = 'testuser') {
    // Set up virtual authenticator
    const cdpSession = await this.page.context().newCDPSession(this.page)
    await cdpSession.send('WebAuthn.enable')
    await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    })

    await this.page.goto('/login')

    // Try login first, fall back to register
    await this.page.fill('input[placeholder="Username"]', username)
    await this.page.click('button:has-text("Register")')

    // Wait for redirect to main page
    await this.page.waitForURL('/')
  }

  // ... other methods
}
```

### API Tests

```typescript
test('POST /api/auth/register-options returns challenge', async () => {
  const res = await fetch('/api/auth/register-options', {
    method: 'POST',
    body: JSON.stringify({ username: 'apitest' }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(200)

  const options = await res.json()
  expect(options.challenge).toBeTruthy()
  expect(options.rp).toBeTruthy()
})

test('POST /api/auth/register-options rejects empty username', async () => {
  const res = await fetch('/api/auth/register-options', {
    method: 'POST',
    body: JSON.stringify({ username: '' }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(400)
})

test('POST /api/auth/register-options rejects duplicate username', async () => {
  // Assuming 'existinguser' already registered
  const res = await fetch('/api/auth/register-options', {
    method: 'POST',
    body: JSON.stringify({ username: 'existinguser' }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(409)
})

test('POST /api/auth/login-options rejects non-existent user', async () => {
  const res = await fetch('/api/auth/login-options', {
    method: 'POST',
    body: JSON.stringify({ username: 'noone' }),
    headers: { 'Content-Type': 'application/json' },
  })
  expect(res.status).toBe(404)
})

test('GET /api/auth/session returns authenticated status', async () => {
  // With valid session
  const res = await fetch('/api/auth/session')
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.authenticated).toBe(true)
  expect(data.username).toBeTruthy()
})

test('POST /api/auth/logout clears session', async () => {
  const res = await fetch('/api/auth/logout', { method: 'POST' })
  expect(res.status).toBe(200)

  // Session should be invalid now
  const sessionRes = await fetch('/api/auth/session')
  expect(sessionRes.status).toBe(401)
})
```

---

## Out of Scope

These are future enhancements not part of the initial implementation:

- Password-based authentication → WebAuthn only
- OAuth/social login (Google, GitHub) → Future enhancement
- Email verification → No email in the system
- Password reset → No passwords
- Multi-factor authentication (beyond WebAuthn) → Future enhancement
- Account deletion → Future enhancement
- Username change → Future enhancement
- Profile management → Future enhancement
- Rate limiting on auth endpoints → Future enhancement (recommended)
- Account lockout after failed attempts → Future enhancement
- Session refresh/renewal → JWT replaced on re-login
- Multiple simultaneous sessions → Allowed (each gets own JWT)
- CSRF protection → SameSite=lax on cookies provides baseline protection

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Registration success rate | > 95% (5% user cancellations expected) |
| Login success rate | > 99% |
| Session validation time | < 5ms |
| Challenge generation time | < 50ms |
| Verification time | < 100ms |
| Redirect latency | < 200ms |
| Session duration | 7 days exact |
| Data isolation | 100% — no cross-user data leakage |
| Authentication enforcement | 100% — all protected routes checked |
| Counter update accuracy | 100% — updated on every login |
| E2E test pass rate | 100% |

---

## Implementation Notes

### Project-Specific Patterns

1. **WebAuthn only** — no traditional passwords. The entire auth system uses `@simplewebauthn/server` (v11+) and `@simplewebauthn/browser` (v11+).
2. **`?? 0` for counter** — critical pattern. Both `credential.counter` and `verification.authenticationInfo.newCounter` can be `undefined`. Always use `?? 0`.
3. **`isoBase64URL` for encoding** — use `isoBase64URL.fromBuffer()` and `isoBase64URL.toBuffer()` from `@simplewebauthn/server/helpers`. Never use raw `Buffer.from()` for credential IDs.
4. **Challenge in cookies** — challenges are stored in HTTP-only cookies, not in-memory maps, because Next.js API routes are stateless.
5. **JWT via `jose`** — uses the `jose` library for JWT signing/verification. Lightweight, edge-compatible.
6. **Middleware for route protection** — `middleware.ts` with `config.matcher` for `/` and `/calendar`. API routes are protected by `getSession()` inside each handler.
7. **Session in every API route** — every protected API route starts with `const session = await getSession(); if (!session) return 401`. User ID from `session.userId` scopes all database queries.
8. **`params` is async** — not directly applicable to auth routes, but important for route handlers in other PRPs.
9. **Synchronous DB operations** — `better-sqlite3` means `userDB.create()`, `authenticatorDB.create()`, etc. are synchronous.
10. **Virtual authenticator for tests** — Playwright tests use `WebAuthn.addVirtualAuthenticator` via CDP to simulate biometric authentication.
11. **Environment variables** — `JWT_SECRET`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` must be configured for production.

### File Locations

```
app/login/page.tsx                     # Login/register page (client component)
app/api/auth/register-options/route.ts # POST — registration challenge
app/api/auth/register-verify/route.ts  # POST — verify registration
app/api/auth/login-options/route.ts    # POST — login challenge
app/api/auth/login-verify/route.ts     # POST — verify login
app/api/auth/logout/route.ts           # POST — clear session
app/api/auth/session/route.ts          # GET — check session status
lib/auth.ts                             # createSession, getSession, clearSession
lib/db.ts                               # userDB, authenticatorDB, User, Authenticator
middleware.ts                           # Route protection
```

### Dependencies

```json
{
  "@simplewebauthn/server": "^11.0.0",
  "@simplewebauthn/browser": "^11.0.0",
  "jose": "^5.0.0"
}
```

- `@simplewebauthn/server` — server-side WebAuthn operations (generate options, verify responses)
- `@simplewebauthn/browser` — client-side WebAuthn operations (`startRegistration`, `startAuthentication`)
- `jose` — JWT signing and verification (edge-compatible, no Node.js crypto dependency)
- `better-sqlite3` — user and authenticator storage

### Security Checklist

- [x] No passwords stored
- [x] JWT secret configurable via environment variable
- [x] HTTP-only cookies for session and challenges
- [x] Secure flag in production
- [x] SameSite=lax on all cookies
- [x] Challenge expires after 5 minutes
- [x] Counter validation prevents replay attacks
- [x] Error messages don't leak sensitive information
- [x] User data scoped by `session.userId` in all queries
- [x] Prepared statements prevent SQL injection
