# Phase 05 — Hostel and Facility Management

Status: PARTIAL — lifecycle APIs and UI are implemented and unit-tested; authenticated CRUD against real tenant records remains unverified.

## Implemented

- Added `/api/hostels/current` read and owner/system-admin profile update for the verified tenant. Profile output omits access codes and owner identifiers.
- Added system-admin-only hostel list/detail/edit, safe soft archive, restore, and reversible ACTIVE/INACTIVE status operations. Owner registration remains the actual hostel-creation workflow.
- Added tenant-scoped list, create, detail, update, and soft-archive endpoints for blocks, floors, rooms, and beds under `/api/facilities`.
- Enforced authentication, role authorization, verified tenant context, forced `hostelId` query scope, and mismatched body-hostel rejection.
- Validated object IDs, supported fields, statuses, pagination, room capacity, and same-hostel parent references across block → floor → room → bed.
- Prevented archiving blocks/floors/rooms while active child resources exist, and blocked room archive when active students or allocations remain.
- Prevented archiving occupied or allocated beds; reserved/maintenance transitions and allocation workflows retain their lifecycle constraints.
- Hostel archive is restricted to SYSTEM_ADMIN and rejected while non-deleted facility resources, active students, or active allocations exist. Restore is supported; historical business records are retained.
- Added room type/capacity fields to the room model. Bed creation and status changes cannot claim OCCUPIED outside the allocation workflow.
- Added authenticated facilities CRUD actions, including View, Edit, and confirmation-backed Archive, with server-backed refresh and explicit loading, error, and empty states.
- Added a SYSTEM_ADMIN hostel management screen for View/Edit/Archive/Restore; Add hostel uses the existing owner-registration API and workflow.

## Routes

- `GET /api/hostels` and `GET /api/hostels/:id`: SYSTEM_ADMIN only.
- `PATCH /api/hostels/:id/status`: SYSTEM_ADMIN only; status is ACTIVE or INACTIVE.
- `PATCH /api/hostels/:id`, `DELETE /api/hostels/:id`, and `POST /api/hostels/:id/restore`: SYSTEM_ADMIN only; archive is soft and dependency-checked.
- `GET /api/hostels/current`: SYSTEM_ADMIN, OWNER, WARDEN with a verified tenant.
- `PATCH /api/hostels/current`: SYSTEM_ADMIN or OWNER with a verified tenant.
- `GET|POST /api/facilities/{blocks,floors,rooms,beds}` and `GET|PATCH|DELETE /api/facilities/{resource}/:id`: SYSTEM_ADMIN, OWNER, WARDEN with a verified tenant.
- Facility DELETE and hostel DELETE are soft archives; no permanent-delete route is provided.

DELETE is a soft archive and does not physically remove documents.

## Verification

- Backend syntax checks and tests: PASS, 52 tests (including role, dependency, tenant-scope, soft-archive, and restore checks).
- Frontend production build: PASS.
- Live MongoDB replica set: `rs0` PRIMARY on `127.0.0.1:27017`.
- Live backend health: `/health` returned `ok`.
- Live unauthenticated requests to the new routes returned 401.
- Unit tests cover invalid capacity/status/input, cross-hostel parent references, tenant-pinned search/list filters, room capacity and maintenance constraints, archive dependency rejection, safe soft archive, and restore.
- No business records were inserted, edited, or deleted for verification.

## Remaining acceptance gap

No real authenticated owner/warden account was used to execute create/update/archive against the application database. That mutation flow is not claimed as end-to-end verified. The UI manages blocks, floors, rooms, and beds and includes a profile form for owners. Authenticated create/update/archive operations still require verification using an authorized real account. The full-system phases 06–15 are not implemented.
