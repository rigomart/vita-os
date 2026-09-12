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
4. Define a realtime delivery strategy for Thread detail and Activity Log updates, including cleanup and second-tab behavior.
5. Preserve accumulated Activity Log pagination and loading states.
6. Reproduce immediate optimistic promotion, confirmation, rollback, and consistency across Dashboard, Area, and Thread views.
7. Migrate the remaining operations incrementally rather than adding a generic CRUD layer.

This Convex-only slice does not establish whether D1 or another database is suitable. That decision requires the later transactional and realtime proof described by issue #322.
