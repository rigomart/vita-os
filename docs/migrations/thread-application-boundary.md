# Thread Application Boundary

Issue [#325](https://github.com/rigomart/vita-os/issues/325) introduces the first transport-independent application slice while keeping Convex authoritative.

## Migrated flow

React now uses `ApplicationClient` from `@vita-os/contracts` for:

- subscribing to Thread detail by slug;
- subscribing to and paginating the Activity Log;
- completing the current Next Move.

`apps/web/src/application/convex/` is the transitional browser adapter. It owns generated Convex query references, Convex IDs, watch lifecycle, pagination statuses, error translation, and optimistic cache updates. `apps/web/src/main.tsx` creates the adapter from the existing `ConvexReactClient` and injects it into React.

The completion decision lives in `@vita-os/core`. Both the Convex mutation and the optimistic browser path use that decision. The Convex mutation remains the authoritative transaction: it checks ownership, updates the Thread, inserts one automatic Activity Log entry, and updates activity metadata together.

## Intentional Convex remainder

This issue does not migrate the whole Thread feature. The following paths still depend directly on Convex:

- Area picker loading and Thread moves;
- Thread title, definition, Follow-up, lifecycle, and deletion mutations;
- Up Next editing;
- Thread Notes loading, pagination, and mutations;
- Thread creation and picker data;
- Dashboard, Area, and other application reads;
- authentication, server functions, storage, and live delivery;
- legacy automatic-entry label support for stored `note` values.

The narrow casts from contract string IDs to generated Convex IDs live in the existing mutation hooks or the transitional adapter. Public contracts and the three migrated React consumers do not import Convex types.

## HTTP/Hono follow-on

A later HTTP implementation should keep the same `ApplicationClient` contract and must prove all of the following before replacing the Convex adapter:

1. Map the public opaque IDs deliberately without exposing database-generated types.
2. Implement `CompleteNextMoveStore.completeAtomically` with one real database transaction and server-side ownership enforcement.
3. Preserve missing-versus-foreign indistinguishability and the stable `ApplicationError` codes.
4. Keep Thread detail and Activity Log state consistent within the current browser tab. Automatic updates in other tabs or devices are deferred; the first HTTP adapter does not need a realtime transport.
5. Preserve accumulated Activity Log pagination and loading states.
6. Reproduce immediate optimistic promotion, confirmation, rollback, and consistency across every affected view in the current tab.
7. Migrate the remaining operations incrementally rather than adding a generic CRUD layer.

This Convex-only slice does not establish whether D1 or another database is suitable. That decision requires the later transactional proof described by issue #322; equivalent cross-session realtime delivery is now deferred.

## Updated migration decision: cross-session updates are deferred

The first Hono migration does not need Convex-equivalent live updates across browser tabs or devices. It must update the initiating tab immediately, reconcile that optimistic state with the server response, roll back cleanly on failure, and refresh other affected state held by that tab. Another open tab or device may remain stale until it performs a normal refresh or revalidation.

Cross-session realtime delivery is follow-on work rather than a migration blocker. The HTTP adapter should preserve the public live-resource shape so a later polling, Server-Sent Events, or WebSocket implementation can be added without changing React consumers.

For ordinary HTTP freshness, use TanStack Query's standard browser behavior rather than a Vita-specific refresh system: fetch when data is first observed, treat cached server data as stale by default, refetch stale data when a view mounts, the window regains focus, or the network reconnects, and do not enable interval polling. Mutations should update affected same-tab state optimistically, reconcile from the server result, and invalidate related data after settlement. Depart from these defaults only when observed product behavior justifies it.

The final production cutover may use a short maintenance window in which writes are disabled. Take one consistent Convex export, import it into the replacement database, verify ownership and relationships, and switch the application only after validation passes. Do not build dual writes merely to avoid this window; they add a second consistency problem to a one-time migration.

Migrated application records keep their existing Convex ID values as opaque text IDs. This preserves relationships, simplifies verification, and makes rollback comparisons direct. Records created after cutover may use a new application-owned ID generator; callers must treat both historical and new formats as opaque and must not infer their storage origin.

Account records and every application `userId` ownership relationship must survive the migration, but active Convex sessions do not. The cutover may invalidate existing sessions and require users to sign in once against the new Better Auth integration.
