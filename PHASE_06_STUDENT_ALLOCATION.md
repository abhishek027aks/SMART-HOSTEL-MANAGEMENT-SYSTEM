# Phase 06 — Student Management and Bed Allocation

Status: PARTIAL — tenant-scoped APIs and UI implemented; unit-tested; authenticated live mutations remain unverified.

## Implemented

- Added tenant-scoped student list, create, detail, update, soft archive, and restore endpoints under `/api/students`.
- Validated student identity fields and rejected unsupported input, invalid IDs, and client-supplied hostel IDs that disagree with verified tenant context.
- Added allocation history under `/api/allocations`, including active allocation listing, hierarchy/availability options, assign, release, and transfer operations.
- Assignment, release, and transfer use MongoDB transactions and retain released allocation history.
- Enforced same-hostel active student, bed, room, block, and floor relationships; capacity and availability; and a single active allocation per student and bed.
- Excluded reserved and maintenance rooms from assignment options and enforced that restriction in the allocation API.
- Updated facility inventory to show bed occupancy and active student/allocation details, and to reflect room occupancy as allocations change.
- Added dashboard sections for students and allocation management with real API-backed forms, search, availability, release, and transfer.
- Added a confirmation-backed student Archive action, archived-record listing, and tenant-scoped Restore action. Archival is blocked until active bed allocation is released; student/allocation history is retained.
- Added automated checks for tenant boundaries, invalid allocation input, hierarchy validation, and role authorization.
- Added dependency checks for facility archive operations and regression coverage for hostel/student archive and restore.

## Verification

- `npm test` in `server`: PASS, 52 tests.
- Node syntax checks for all changed backend JavaScript files: PASS.
- `npm run build` in `client`: PASS.
- Existing backend `/health`: returned `{"status":"ok"}`.
- Unit and API tests verify unauthenticated student/allocation routes reject access.
- Mocked service tests exercise successful assignment, release, and transfer updates without writing MongoDB business records.
- No student, allocation, or other business records were created or changed for testing.

## Remaining acceptance gap

Authenticated live student creation, assignment, release, and transfer against real resident data remain unverified. The UI labels QR as not configured; no QR feature is claimed as implemented. This phase remains partial until authorized end-to-end verification can be run without fabricating business records.
