# Ticket, Admin, E2E, and Observability Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining backend simplification, critical E2E coverage, and production observability work while preserving the public `@/lib/data-store` API.

**Architecture:** Keep `lib/data-store.ts` as a compatibility facade and move ticket reads/writes and admin CRUD into cohesive server-only modules that depend on the existing core, mapper, and audit helpers. Add browser coverage for activation, attachment authorization, schedule ownership, and admin CRUD. Add bounded email retry and a readiness health signal without changing existing request behavior.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma/PostgreSQL, JSON fallback provider, Playwright, Vitest, Brevo/SMTP email provider.

## Global Constraints

- Preserve the public imports from `@/lib/data-store`.
- Keep JSON and Prisma provider behavior equivalent.
- Authentication remains restricted to `@bagietka.pl` accounts.
- Internal notes remain hidden from reporters.
- Never add `.freebuff/` to Git.
- Required validation remains typecheck, lint, unit tests, build, and E2E.

---

### Task 1: Extract the ticket data-store domain

**Files:**
- Create: `lib/data-store-tickets.ts`
- Modify: `lib/data-store.ts`
- Test: existing `tests/data-store.test.ts`, `tests/prisma-integration.test.ts`

**Interfaces:**
- Consumes the existing `getPrisma`, provider helpers, mappers, filters, and ticket-number utilities.
- Produces the same ticket, comment, event, and ticket-page functions re-exported by `lib/data-store.ts`.

- [ ] Map ticket-related functions and dependencies before moving code.
- [ ] Move visible ticket listing, cursor pagination, ticket page references, ticket lookup, comments, events, ticket creation/update, and comment creation into the new module.
- [ ] Re-export every moved function from `lib/data-store.ts`.
- [ ] Run targeted data-store and Prisma integration tests.
- [ ] Commit the extraction after the targeted suite is green.

### Task 2: Extract the admin CRUD data-store domain

**Files:**
- Create: `lib/data-store-admin.ts`
- Modify: `lib/data-store.ts`
- Test: `tests/admin-actions.test.ts`, `tests/data-store.test.ts`

**Interfaces:**
- Consumes the existing audit helper, admin utility rules, provider helpers, and mappers.
- Produces the same user, store, category, admin audit, and MFA data-store exports through the facade.

- [ ] Move admin user/store/category list and mutation functions without changing validation or last-admin protections.
- [ ] Keep admin audit writes atomic in Prisma and serialized in JSON mode.
- [ ] Re-export moved functions and run admin-focused tests.
- [ ] Commit the extraction after the targeted suite is green.

### Task 3: Add the remaining critical E2E coverage

**Files:**
- Create or modify: `tests/e2e/activation.spec.ts`, `tests/e2e/attachments.spec.ts`, `tests/e2e/schedule.spec.ts`, `tests/e2e/admin-crud.spec.ts`
- Modify: `tests/e2e/helpers.ts`, `lib/seed.ts` only if deterministic fixture support is required

**Interfaces:**
- Uses the existing isolated JSON E2E fixture and Playwright helpers.
- Verifies activation links, attachment authorization, schedule ownership, and admin CRUD behavior from the browser.

- [ ] Add a deterministic admin-created activation flow using the fallback activation link when email is disabled.
- [ ] Verify reporters cannot download attachments linked to inaccessible tickets or internal comments.
- [ ] Verify an agent can complete only their own schedule task and cannot complete another agent’s task.
- [ ] Verify admin user/store/category CRUD and protections through visible UI.
- [ ] Run each new spec red/green, then run the full E2E suite.

### Task 4: Add production observability and email resilience

**Files:**
- Modify: `lib/email.ts`, `lib/notifications.ts`, `app/api/health/route.ts`
- Create: `app/api/health/ready/route.ts`, `tests/health-ready.test.ts`, `tests/email-retry.test.ts`
- Update: `README.md` and `docs/it-helpdesk-docs/deployment-railway.md`

**Interfaces:**
- Keep existing email provider selection and notification-log semantics.
- Add bounded retry for transient email failures and a readiness endpoint that checks required runtime dependencies without exposing secrets.

- [ ] Write failing tests for bounded notification retry and readiness failure/success responses.
- [ ] Implement minimal retry with no duplicate sends after a successful delivery.
- [ ] Implement readiness checks for Prisma configuration and attachment storage configuration.
- [ ] Document the endpoints and retry behavior.
- [ ] Run the complete validation suite and commit/push the final result.
