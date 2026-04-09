# PRP 11: Authentication (WebAuthn)

## Feature Overview
Implement passwordless authentication using WebAuthn/Passkeys. Users should be able to register and log in with their device biometrics, passkeys, or security keys. Authenticated sessions must protect the main app routes and API usage.

## User Stories
- As a user, I want to register without a password so login is easier and more secure.
- As a user, I want to sign in with a passkey or biometric prompt.
- As a user, I want my session to persist safely across page refreshes.
- As a user, I want protected routes so my todos stay private.

## User Flow
1. User opens the login/register page.
2. User enters a username for registration.
3. Client requests registration options from the server.
4. Browser invokes WebAuthn authenticator ceremony.
5. Client sends credential response to the server for verification.
6. Server stores authenticator data and creates session cookie.
7. For login, client repeats the options and verification flow using an existing credential.
8. Authenticated user is redirected to the main app.

## Technical Requirements

### Libraries and Patterns
Use project-standard tooling:
- `@simplewebauthn/server`
- `@simplewebauthn/browser`
- JWT session cookie helpers in `lib/auth.ts`

Critical documented rule:
```ts
counter: authenticator.counter ?? 0
```
Use null coalescing when persisting or passing authenticator counters.

### Data Model
Create or confirm tables:
- `users`
  - `id`
  - `username`
  - `created_at`
- `authenticators`
  - `id`
  - `user_id`
  - `credential_id`
  - `public_key`
  - `counter`
  - `device_type`
  - `backed_up`
  - `transports`
  - `created_at`

### Server Routes
Required auth API routes:
- `POST /api/auth/register-options`
- `POST /api/auth/register-verify`
- `POST /api/auth/login-options`
- `POST /api/auth/login-verify`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Session Management
- Use HTTP-only cookie for JWT session.
- Session expiry follows project convention, currently 7 days.
- All protected application routes and API routes must rely on session validation.

### Route Protection
- Middleware protects at least:
  - `/`
  - `/calendar`
- Unauthenticated users are redirected to `/login` or receive `401` for API requests depending on route type.

### WebAuthn Ceremony Requirements
- Registration options should create challenge and expected RP data.
- Login options should target the user or allowed credentials as needed.
- Verification must validate challenge, origin, RP ID, and authenticator response.
- Credential IDs need correct base64/base64url handling using documented helpers such as `isoBase64URL`.

## UI Components
- Login/register page
- Username input
- Register button
- Login button or user selection/login initiation
- Loading and error states
- Logout button in authenticated UI

## Behavior Rules
- No password fields anywhere.
- Duplicate username policy should be clear and enforced.
- On successful registration, user can be logged in immediately.
- Session should survive page reload until expiry or logout.
- Authenticated users visiting `/login` should be redirected away from the login page.

## Edge Cases
- Browser does not support WebAuthn.
- User cancels authenticator prompt.
- Authenticator counter missing or undefined.
- Existing username registration attempt.
- Credential is registered twice.
- Challenge mismatch or stale challenge.

## Acceptance Criteria
- User can register with WebAuthn using a username.
- User can log in using the registered passkey.
- Session cookie is created on successful verification.
- Protected routes reject unauthenticated access.
- Logout clears session.
- Counter handling does not break when authenticator counter is undefined.

## Testing Requirements

### E2E
- Register a new user using Playwright virtual authenticator.
- Log out and log back in with same credential.
- Reload page and verify session persists.
- Attempt to access protected route while unauthenticated.
- Verify logout redirects or blocks access appropriately.

### Unit / Integration
- Session helper encode/decode
- WebAuthn verification wrappers
- Middleware protection logic
- Counter fallback handling with `?? 0`

## Out of Scope
- Password fallback auth
- Social login
- Multi-factor auth beyond WebAuthn itself
- Account recovery flows beyond standard passkey/device behavior

## Success Metrics
- Authentication is passwordless, secure, and stable.
- Protected routes stay inaccessible without a valid session.
- Playwright virtual-authenticator tests can validate the full happy path.

## Evaluation Alignment

### Required Implementation Checklist
- Database tables: `users` and `authenticators`
- API endpoint: `POST /api/auth/register-options`
- API endpoint: `POST /api/auth/register-verify`
- API endpoint: `POST /api/auth/login-options`
- API endpoint: `POST /api/auth/login-verify`
- API endpoint: `POST /api/auth/logout`
- API endpoint: `GET /api/auth/me`
- Auth utility in `lib/auth.ts`: `createSession`, `getSession`, `deleteSession`
- Middleware in `middleware.ts` protects routes
- Login page at `/login`
- Registration flow
- Login flow
- Logout button
- Session cookie is HTTP-only with 7-day expiry
- Protected routes redirect to login

### Required Testing
- E2E: register new user with virtual authenticator
- E2E: login existing user
- E2E: logout clears session
- E2E: protected route redirects when unauthenticated
- E2E: login page redirects when already authenticated
- Unit test: JWT creation and verification

### Required Acceptance Criteria
- Registration works with passkey
- Login works with passkey
- Session persists 7 days
- Logout clears session immediately
- Protected routes secured
