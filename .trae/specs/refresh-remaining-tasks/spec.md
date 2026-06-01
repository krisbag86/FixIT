# FixIT Remaining Tasks Refresh Spec

## Why
The current backlog in `docs/it-helpdesk-docs/remaining-tasks.md` is coarse-grained and no longer reflects completed work (Email + npm audit). A refreshed, decomposed backlog makes future work easier to execute and verify.

## What Changes
- Update the project backlog to remove completed items (Priority 3 Email, Priority 4 npm audit) and reflect current status.
- Split remaining priorities (1, 2, 5–8) into smaller, verifiable tasks with clear acceptance/validation notes.
- Normalize terminology for notification types used across the system (e.g. `TICKET_CREATED`, `TICKET_ASSIGNED`, `TICKET_RESOLVED`, `COMMENT_CREATED`) so the runtime migration to Prisma can preserve behavior.
- Keep the existing priority ordering; only change task granularity and status.

## Impact
- Affected specs: delivery planning, deployment readiness, QA gates.
- Affected code: none directly in this change (this is a backlog refinement spec), but the refreshed tasks point at areas like Prisma runtime migration, e2e, attachments, KB, admin CRUD, and reporting.
- Affected docs:
  - `docs/it-helpdesk-docs/remaining-tasks.md`
  - `docs/it-helpdesk-docs/build-status.md` (only if it repeats the old “still missing” list)

## ADDED Requirements
### Requirement: Single-source backlog
The project SHALL maintain a single backlog document that reflects completed work and decomposes remaining work into small, verifiable tasks.

#### Scenario: Backlog updated
- **WHEN** the backlog is refreshed
- **THEN** completed items are removed (or moved to a clearly marked “Done” section)
- **AND** remaining items are split into tasks that each have a clear outcome and validation step(s)

## MODIFIED Requirements
### Requirement: Remaining tasks doc
`docs/it-helpdesk-docs/remaining-tasks.md` SHALL be updated so that:
- Priority 3 (Email) is marked done and removed from “remaining”
- Priority 4 (npm audit) is marked done and removed from “remaining”
- Priority 1, 2, 5–8 are decomposed into smaller tasks without changing their intent

## REMOVED Requirements
None.
