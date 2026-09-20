# D1 cloud storage

**Status:** Accepted  
**Date:** 2026-09-19

D1 is accepted as the storage target for the Convex-to-Cloudflare migration. The decision is limited to the production-shaped workflow proven in issue 348 and to future operations that establish equivalent evidence. The application reaches D1 through operation-shaped storage interfaces; neither database rows nor D1 types enter the public application contract.

## Decision

The Cloudflare host is a separate Hono Worker. Better Auth stores its user, session, account, and verification data directly in D1. Protected application routes resolve an authenticated actor before constructing application storage, and every Thread and Activity Log operation is explicitly owner-scoped.

Next Move completion uses an owned read, the shared `@vita-os/core` completion decision, and a compare-and-swap precondition supplied by the client:

- the expected Next Move text;
- the revision observed in Thread detail.

The store verifies both values and then submits one D1 batch. Its first statement conditionally updates the owned Thread by ID, owner, expected revision, and expected Next Move; it promotes Up Next, stamps activity metadata, increments the revision, and stores a unique operation token. Its second statement inserts the automatic Activity Log Entry only from the Thread carrying that operation token. Success requires exactly one changed Thread and one inserted log.

The public contract remains asynchronous and framework-free. The browser host owns Better Auth and HTTP client construction. The shared React package owns TanStack Query state, including bounded Activity Log accumulation, revision-aware optimistic detail changes, exact rollback, invalidation, and server reconciliation. This proof remains dormant beside the current Convex composition; it does not add a runtime backend switch.

## Evidence

The proof runs with Cloudflare's Worker test runtime and a real isolated local D1 binding using the committed Better Auth and Vita OS migrations.

- Public Better Auth signup and session recovery pass through the Worker. Unauthenticated `/v1` requests are rejected before storage is constructed.
- Owned Thread detail, cross-owner not-found behavior, strict stored-data decoding, and bounded cursor pagination pass against real D1.
- A forced Activity Log primary-key collision makes the D1 batch fail. The test observes no change to Next Move, Up Next, activity timestamp/content, revision, operation token, or Activity Log rows.
- Two competing public requests carry the same expected Next Move and revision while the promoted move repeats the same text. The observed result is one `completed`, one `conflict`, one revision increment, one promotion, and one Activity Log Entry.
- The real browser HTTP client passes against the Worker with a Better Auth cookie. The shared React boundary passes loading, pagination, optimistic update, cancellation, rollback-before-refetch, conflict reconciliation, and retry-disabled tests against TanStack Query itself.
- The focused go/no-go run passed 45 API tests, 1 contract test, 5 core tests, 14 shared-application tests, and 57 selected web/Convex compatibility tests. The two named D1 proofs also passed independently with the verbose reporter.
- Repository lint, production builds, Worker dry-run, and the full test suite pass with the active Convex application unchanged.

## Consequences

D1 is the chosen storage engine for the remaining migration slices. New operations must keep database behavior behind focused store methods and must supply their own real-D1 evidence for ownership, bounds, rollback, and concurrency where those properties matter.

D1 still does not provide an interactive transaction API for arbitrary application code. A successful statement batch proves only the operation it implements; it does not make a separate read followed by later writes safe by default. Multi-record workflows must be expressible as an operation-specific atomic batch with characterized contention behavior. If a later workflow cannot meet that standard, the migration must use the managed Postgres fallback for that workflow or revisit the storage decision before shipping it.
