# Phase 02 — Database Architecture

Status: PASS

## Scope completed

- Configured the existing Mongoose connection module.
- Verified schemas for User, Hostel, Block, Floor, Room, and Bed.
- Kept each physical resource tenant-scoped with a required `hostelId` and required parent references.
- Enforced unique hostel codes and access codes, plus hierarchical names for blocks, floors, rooms, and beds.
- Scoped room-number uniqueness to a floor so separate floors may use the same room number.
- Verified lifecycle statuses, timestamps, and soft-delete defaults without inserting records.
- Added model contract tests to the backend test command.

## Verification

- Root `npm test`: PASS; all six backend model tests passed and the frontend production build passed.
- Local MongoDB connection through `server/src/config/db.js`: PASS; connected and disconnected without writing records.
- Model tests instantiate schemas only and do not insert business data.
- Cross-document tenant-reference checks belong in the tenant authorization/service phase; schemas alone cannot guarantee that referenced records share the same hostel.

## Phase boundary

Authentication, role authorization, CRUD APIs, and cross-tenant request enforcement are not part of this phase.
