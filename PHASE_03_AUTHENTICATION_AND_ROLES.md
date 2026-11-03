# Phase 03 — Authentication & Roles

Status: PASS

## Implemented

- Added staff/parent login using registered email or mobile, and student login using hostel access code + student ID + password.
- Added salted scrypt password hashing and constant-time verification; the raw password is never returned or logged.
- Added one-hour HS256 bearer tokens with issuer, role, account ID, hostel ID, and expiry claims. The signing secret is required at server startup and must be at least 32 bytes.
- Added authenticated `GET /api/auth/me` and protected the global dashboard so only `SYSTEM_ADMIN` can read cross-hostel totals until tenant-scoped dashboard access is implemented.
- Every authenticated request reloads account status and role from MongoDB. Student access also re-checks that both the student and hostel remain active.
- Added a React login screen and in-memory auth context. The token is not persisted in browser storage; a page refresh requires signing in again.
- Added transactional owner registration at `POST /api/auth/register` (also available through the existing `/register-owner` alias). The owner, hostel profile, and active membership are committed together.
- Login accepts an optional requested role for client-side role selection, but the server compares it to the account role loaded from MongoDB; it never grants the requested role.
- Owner onboarding validates required email, phone, hostel-code, image URL, and gallery fields before opening a database transaction. Hostel photos are accepted as HTTP(S) URLs; file uploads are not configured.
- Added `JWT_SECRET` to `.env.example`. A local ignored `.env` was initialized with a randomly generated development secret; it is not tracked by Git.
- Replaced hard-coded maintenance-bed totals with MongoDB counts; vacant, reserved, occupied, and maintenance beds now use their actual statuses.
- Loading and failed dashboard requests no longer render fabricated zero-valued business metrics.

## API

- `POST /api/auth/login`: accepts `{ "identifier", "password" }` for staff/parents, or `{ "accessCode", "identifier", "password" }` for students.
- `GET /api/auth/me`: requires `Authorization: Bearer <token>`.
- `POST /api/auth/register`: creates an owner and a separate hostel profile atomically, with optional location and HTTP(S) photo URLs. Room and bed inventory still requires actual resource records and is not created by registration.

## Verification

- Root `npm test`: previously passed before landing-page/auth refinements. The latest full run requires the local MongoDB replica-set service, which was stopped and could not be started with the current Windows service permissions.
- Database-independent backend suite: PASS; all 25 selected auth, model, and tenant/dashboard tests passed after the role-validation changes.
- Frontend production build: PASS after the responsive landing-page/auth and backend-data dashboard changes.
- Fifteen backend tests cover password hashing, token expiry/signature validation, role checks, successful staff/student login controller flows, duplicate identifiers, API input handling, stale tokens, and dashboard protection.
- API tests used the existing local MongoDB connection for read-only checks and created no business records.
- All backend JavaScript source files pass `node --check`.
- A valid credential could not be exercised through the live HTTP API because the project intentionally has no bootstrap/registration flow or test business accounts. Successful controller flows are verified with in-memory model stubs; no fake database records were added.

## Phase boundary

Role-specific dashboards and account provisioning remain in their planned later phases. Multi-hostel membership and tenant-scoped dashboard authorization are implemented in Phase 04; global platform metrics remain limited to `SYSTEM_ADMIN`.
