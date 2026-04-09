# Todo App Codex

This folder contains the Todo App and its app-local PRP references.

## Included
- App Router project structure
- SQLite data layer via `better-sqlite3`
- WebAuthn route scaffolding
- Main dashboard and calendar pages
- API routes for todos, subtasks, tags, templates, notifications, holidays, and import/export
- Middleware route protection
- Playwright config and 11 feature test placeholders

## Quick Start
1. Copy `.env.example` to `.env.local`
2. Run `npm install`
3. Run `npm run seed:holidays`
4. Run `npm run dev`

## Deployment Notes
- Set `JWT_SECRET` to a long random string in Railway before using login or registration.
- For WebAuthn/passkeys in production, set `RP_ID` to your public hostname and `RP_ORIGIN` to your full site origin.
- Example Railway values: `JWT_SECRET=your-long-random-secret`, `RP_ID=your-app.up.railway.app`, and `RP_ORIGIN=https://your-app.up.railway.app`
- If these env vars are omitted, the app now falls back to the incoming request host and protocol.

## References
- `.github/PRPs/todo-app-core-features.md`
- `.github/PRPs/reference/README.md`
- `../USER_GUIDE.md`
- `../EVALUATION.md`
