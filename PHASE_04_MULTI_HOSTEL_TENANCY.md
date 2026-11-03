# Phase 04 — Multi-Hostel / Multi-Tenant

Status: PASS

## Implemented

- Added `HostelMembership` records for user-to-hostel assignments with role, active/inactive status, soft-delete state, assignment actor, and timestamps.
- Added a unique active-record index for each user/hostel pair and a hostel/role/status lookup index.
- Staff and parent login now requires an active membership to an active hostel. A user with multiple assigned hostels can select one using `hostelId`; an unassigned or inactive hostel is rejected.
- Student login remains scoped by hostel access code and student ID, and the token tenant must match that same hostel.
- Every authenticated request rechecks the account, role, selected active membership, and active hostel in MongoDB. Student requests additionally recheck the active student profile within the token hostel.
- Added `tenantMiddleware`: staff can select only a hostel in their active memberships; `SYSTEM_ADMIN` may select an existing active hostel through its token/header or remain platform-scoped.
- Added `requireTenant` and `hostelScope` to require a verified tenant and pin query filters to its `hostelId`.
- Tenant-scoped dashboard counts and lists apply the same `hostelId` filter, and populated student data is matched to that tenant. Dashboard access is limited to `SYSTEM_ADMIN`, `OWNER`, and `WARDEN`; guards, students, and parents cannot see this aggregate dashboard.
- Added an optional Hostel ID field to staff/parent login for users assigned to multiple hostels.

## Verification

- Root `npm test`: PASS; backend tests and client production build pass.
- Tenant tests verify primary and assigned-hostel selection, denial of unassigned hostels, platform-admin hostel validation, required tenant context, and forced `hostelId` query scope.
- Dashboard service tests verify every tenant-scoped count/list and populated student record is constrained to the selected hostel.
- Auth tests verify that active membership is mandatory, a user can select an assigned hostel, a foreign hostel is rejected, and a student cannot mismatch the access-code hostel with the selected tenant.
- Local MongoDB was used for read-only API and dashboard checks; no business records were inserted or modified.

## Phase boundary

This phase provides reusable tenant authorization primitives and scopes the existing dashboard API. All future hostel-owned CRUD routes must use `requireAuth`, role authorization, `tenantMiddleware`, and `hostelScope` (or equivalent explicit `hostelId` filters). Cross-document consistency for block/floor/room/bed references is validated in the relevant resource-service phase.
