# Runtime PostgreSQL (Prisma) Migration Spec

## Why
The app currently uses a local JSON store for runtime persistence, which blocks production deployment on Railway. Migrating runtime reads/writes to PostgreSQL via Prisma enables a stable production runtime while preserving current MVP behavior.

## What Changes
- Replace runtime persistence in `lib/data-store.ts` from JSON file storage to PostgreSQL via Prisma Client.
- Preserve existing permissions and ticket visibility rules (no data leakage).
- Move ticket numbering allocation to a transactional `TicketCounter` write (no duplicates under concurrency).
- Persist ticket events and notification logs in PostgreSQL.
- Align Prisma schema with runtime `NotificationLog` needs (status + timestamps).
- Keep the current UI and server actions behavior stable (no UX changes expected).

## Impact
- Affected specs: deployment readiness, data integrity, permissions.
- Affected code:
  - `lib/data-store.ts` (major rewrite / replacement of implementation)
  - `prisma/schema.prisma` + new migration
  - `prisma/seed.mjs` (ensure still seeds required entities)
  - Any call sites relying on `readDatabase()` shape (may need refactor if the API changes)
- Out of scope:
  - Railway project creation and configuration itself (we document required env vars and commands, but do not automate Railway)
  - Attachments/FAQ/Admin CRUD/Reports (remain separate priorities)

## ADDED Requirements
### Requirement: PostgreSQL-backed runtime
The system SHALL use PostgreSQL as the source of truth for runtime data access using Prisma Client.

#### Scenario: Local dev uses PostgreSQL
- **WHEN** the app runs via Docker Compose (PostgreSQL available)
- **THEN** tickets, comments, events, and notification logs are stored and read from PostgreSQL

### Requirement: Transactional ticket numbering
The system SHALL allocate ticket numbers using `TicketCounter` in a transaction to prevent duplicate numbers.

#### Scenario: Concurrent ticket creation
- **WHEN** two tickets are created concurrently for the same year
- **THEN** both tickets have unique `IT-YYYY-NNNN` numbers

### Requirement: NotificationLog parity
The system SHALL persist notification log entries for all current notification types and allow updating statuses to `SENT` or `FAILED` with timestamps.

#### Scenario: Email send outcome recorded
- **WHEN** the app attempts to send an email notification
- **THEN** the corresponding `NotificationLog` is updated to `SENT` or `FAILED` and has a `sentAt` timestamp

## MODIFIED Requirements
### Requirement: Data store contract
`lib/data-store.ts` SHALL provide the same user-visible behavior (ticket lists/details, status updates, comments, internal-note visibility) but its persistence layer SHALL be PostgreSQL via Prisma instead of a JSON file.

## REMOVED Requirements
### Requirement: JSON file runtime persistence
**Reason**: JSON store is not suitable for Railway production runtime.
**Migration**: All runtime operations switch to PostgreSQL; the JSON store may remain only as a legacy fallback if explicitly required later.
