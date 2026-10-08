# Drizzle queries over D1

**Status:** Accepted. Amends the native-query implementation in [ADR 0020](./0020-api-layering-operations-and-one-round-trip-storage.md), retained by [ADR 0035](./0035-hono-valibot-result-api.md).
**Date:** 2026-10-08

Issue [#369](https://github.com/rigomart/vita-os/issues/369) replaces hand-maintained SQL column lists, row interfaces, and update builders with Drizzle's typed schema and queries. The existing feature storage boundary already isolates this change from operations, routes, domain rules, and the browser contract.

## Decision

Each feature creates a Drizzle D1 client from its authenticated request scope. The scope continues to carry the native request-local D1 binding, clock, and actor. Better Auth continues to use that binding directly; its tables and adapter are outside this change.

`apps/api/src/platform/d1/schema.ts` describes the five existing product tables. Storage row types and projections are inferred from those tables. Row adapters still map SQL NULL to absent contract properties, translate historical storage names, and validate Tasks and Repeat JSON. Drizzle types do not validate previously stored data.

Use query builders for ordinary reads and writes and parameterized `sql` templates where a guarded insert-from-select or another expression is clearer. A storage function still makes one D1 round trip: one statement or one batch. Every read and write is scoped by its owner, including related records in joins and subqueries. No generic repository interface is added.

Thread revisions, change tokens, conditional inserts, and operation retries remain. Task completion, its Activity Log entries, and an optional Thread Note are one atomic D1 batch. Adding a Standalone Note to a Thread still copies it and deletes the original in one guarded batch. Drizzle's result mapping changes how storage reads returned rows; it does not replace the guards or the batch assertions. Unique-violation classification inspects the native cause of a Drizzle query error, rather than its query-containing message.

## Schema changes

The seven existing SQL migrations remain unchanged. Drizzle metadata records the product schema after `0007` as its baseline without adding a table-creation migration. Generating against the adopted schema must produce no SQL.

Future product schema changes start in the TypeScript schema. Run `bun run --filter=@vita-os/api migrations:generate`, then review and commit the generated SQL and metadata. Hand-written data transformations may still be needed. Better Auth schema changes remain separately managed, and must not be included in the product baseline.

The existing Area and Thread slug constraints are inline SQLite UNIQUE constraints. Drizzle Kit represents them as named unique indexes in its snapshots. Enforcement matches, but those names do not exist in the deployed database. Changing or removing those constraints therefore requires reviewed, hand-written table-rebuild SQL that preserves dependent records; Kit's generated DROP INDEX alone cannot change the historical constraints. A migration test characterizes this limitation against the applied SQL history.

Wrangler remains the only migration runner: local setup, isolated verification, tests, and deployment continue applying `apps/api/migrations`. Do not use Drizzle's migrator to replay this baseline or push a schema directly to a deployed database. Generated changes must remain compatible with the serving API because deployment applies migrations before replacing the Worker.

## Consequences

Column references and ordinary query results are checked together by TypeScript. Some explicit SQL and domain conversion remain because the application has stronger requirements than a table type can express. We add two pinned dependencies and migration snapshots, but no new database, public model, or user workflow. The runtime and migration tools can be upgraded separately after checking their D1 and Wrangler behavior.
