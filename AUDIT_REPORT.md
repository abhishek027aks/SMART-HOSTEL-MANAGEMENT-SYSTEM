# SHMS Audit Report

Updated: 2026-10-13

## Executive Summary

The current project is a real MERN implementation with authentication, tenant scoping, staff, students, facilities, allocation, photo upload, and automated tests. It is not yet a complete SHMS. QR, gate entry/exit, outpass, complaints, notices, notifications, fees, mess, reports, camera/security events, and full role dashboards remain incomplete or absent.

No live business records were created, deleted, reset, or modified during this audit.

## Video Findings

Video inspected: `C:\Users\aks27\Downloads\Recording 2026-10-07 125521.mp4`

Metadata:
- Duration: 144.70 seconds
- Resolution: 1918x1078
- Frame rate: 30 FPS
- Video: H.264
- Audio: AAC stereo, effectively silent (`mean_volume: -91.0 dB`, `max_volume: -91.0 dB`)
- Extracted frames: `.audit/video-frames/`

| Timestamp | Screen/action | Observed problem | User impact | Likely source file | Recommended fix | Verified? |
|---|---|---|---|---|---|---|
| ~00:15 | Student photo upload | `Route not found` shown after photo action | Photo save appears broken | `server/src/app.js`, `server/src/routes/uploadRoutes.js`, `client/src/components/PhotoField.jsx` | Verify current upload route and authenticated upload flow | Video yes; current source has route; live unauth returns 401 |
| ~00:20 | Student camera modal | “Camera is not ready yet” while camera preview/modal is visible | Confusing capture state | `client/src/components/PhotoField.jsx` | Add explicit camera states and disable capture until ready | Fixed; build/test pass |
| ~00:35 | Student captured photo | Captured preview appears while route error remains | User cannot tell whether photo is saved | `PhotoField.jsx`, upload route | Verify authenticated save and success/error placement | Partially fixed; authenticated E2E pending |
| ~00:50 | Facilities | Floors management visible | No fatal issue visible in sampled frame | `FacilityManager.jsx`, `facilityService.js` | Continue live CRUD verification | Automated tests pass |
| ~01:05 | Staff Management | Staff list shows `Route not found` | Staff module appears broken | `staffRoutes.js`, `staffService.js`, stale runtime possible | Verify current route and tests | Current route exists; tests pass after stale test fix |
| ~01:55 | Staff photo | Photo area shows `Route not found` | Staff photo save appears broken | upload route / `PhotoField.jsx` | Verify authenticated upload | Current source route exists; E2E pending |
| ~02:05 | Logout/login | User lands on marketing/login page | Expected after sign out if intentional | `AuthContext.jsx`, `Login.jsx` | Verify auth state persistence | Pending |
| ~02:20 | Role-specific login | Student-style access-code field visible | Role-based login fields exist | `Login.jsx`, `authController.js` | Verify each role login | Tests cover auth; live owner pending |

## Project Inventory

Implemented evidence:
- Root scripts exist and run server/client tests.
- Server uses Express, Mongoose, CORS, Helmet, dotenv.
- Client uses React/Vite.
- MongoDB config loads from `.env` without printing secrets.
- Auth, role middleware, tenant middleware, password hashing, and token utilities exist.
- Models exist for User, Hostel, HostelMembership, Student, StaffAudit, Block, Floor, Room, Bed, Allocation, EntryExit, Outpass, Complaint.
- Routes/controllers/services exist for auth, dashboard, hostel, facilities, students, allocation, staff, uploads.
- Frontend pages exist for login, hostel management, facility manager, student management, staff management, allocation manager.

## Verified Complete Modules

- Password hashing/token unit coverage: verified by tests.
- Backend auth rejection for missing tokens: verified by tests and live 401 checks.
- Facility validation/archive dependency rules: verified by tests.
- Allocation assign/release/transfer service rules: verified by tests.
- Staff validation/create/list service behavior: verified by tests after test correction.
- Photo file type/signature validation: verified by tests.

## Partial Or Unfinished Modules

- Owner dashboard: partial, data-backed summary exists but live authenticated view is pending.
- Student management: backend and frontend exist; live authenticated CRUD pending.
- Staff management: backend and frontend exist; live authenticated CRUD pending.
- Facility management: backend and frontend exist; live authenticated CRUD pending.
- Allocation: backend and frontend exist; live authenticated E2E pending.
- Photo upload: backend and frontend exist; authenticated E2E pending.
- Camera capture: UI component improved; real camera save pending.

## Not Implemented Or Not Complete

- QR generation and validation
- Entry/exit gate logs as a complete workflow
- Outpass approval workflow
- Complaints/help workflow
- Notices and notifications
- Fees/payment history
- Mess menu/rating/review workflow
- Camera/security event management
- Reports/export
- Audit logs beyond staff audit
- Student/Parent/Guard/Warden role-specific full dashboards
- Deployment hardening

## Test And Build Results

Commands verified:
- `npm test --prefix server -- --test-reporter=spec`: 57 pass, 0 fail
- `npm test`: backend 57 pass, frontend build pass
- `npm run build --prefix client`: pass
- `git diff --check`: pass
- `mongosh rs.status()`: replica set `rs0`, PRIMARY `127.0.0.1:27017`
- `Invoke-RestMethod http://localhost:5000/health`: returned `{"status":"ok"}`
- Protected dashboard/upload routes without token: returned `401`

## Fixes Applied

- Updated `server/test/staff.test.js` so the staff list test matches the current intended multi-field `$or` search pipeline.
- Updated `client/src/components/PhotoField.jsx` to track camera states (`IDLE`, `INITIALIZING`, `READY`, `CAPTURED`, `ERROR`), show readiness messages, disable capture until ready, and clear camera state on close.
- Updated `client/src/context/AuthContext.jsx` so the authenticated session survives page refresh in the current browser tab using `sessionStorage`, while logout removes it.
- Replaced corrupted dashboard/photo status text such as `â€¦` with plain ASCII UI text.

## Remaining Verification

Authenticated Owner live E2E is still required. The user must sign in locally with the existing Owner account; no password should be sent in chat.

Next recommended step: run the app, have the user sign in as Owner, then verify real student/staff/facility/photo/allocation flows using existing legitimate records only.
