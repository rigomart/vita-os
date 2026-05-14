# Architecture Improvements

This note records architecture deepening opportunities found on 2026-05-13.
The goal is to turn shallow modules into deeper ones, improving locality for
maintainers and leverage for callers and tests.

## Context

The current domain language is in `CONTEXT.md`: Area, Project, Item, Inbox,
Action queue, Project log, and Health status. No ADRs were present in
`docs/adr/` during this review.

## Improvement Plan

1. Deepen Project changes and automatic Project log entries.
   - Current friction: Project log rules are spread across Project updates,
     Project removal, Action queue completion, and Inbox processing.
   - Improvement: centralize automatic Project log entries behind a Project
     change module, while leaving manual notes in `projectLogs.create`.
   - Test gain: Project state and Project log side effects can be tested
     together through one interface.

2. Deepen Inbox processing.
   - Current friction: processing an Item crosses Item deletion, Project
     creation, Project log copying, and Action queue changes.
   - Improvement: make Inbox processing the module that owns the domain rule
     that an Item can be dated, discarded, copied, or promoted.
   - Test gain: tests can prove that Items never become attached to Areas or
     Projects.

3. Deepen Area and Project relationship checks.
   - Current friction: Project creation and update paths accept Area ids
     without consistently checking ownership, and Area deletion can leave old
     Projects pointing at deleted Areas.
   - Improvement: centralize Area membership checks and the Area deletion
     policy.
   - Test gain: tests can cover missing, foreign, and deleted Area cases in
     one place.

4. Deepen Health status meaning.
   - Current friction: Health status values, validators, labels, and colors are
     split, and Project attention can be confused with Area Health status.
   - Improvement: keep Area Health status semantics in one module and expose a
     small UI adapter for display.
   - Test gain: tests can lock down that Project attention never derives or
     mutates Area Health status.

5. Deepen optimistic update behavior.
   - Current friction: route code duplicates server rules for slugs, ordering,
     default fields, and cache fan-out.
   - Improvement: add client-side optimistic update adapters per domain concept
     or reduce optimistic behavior where the server owns the result.
   - Test gain: cache behavior can be tested separately from server mutation
     behavior.

6. Move toward feature slices by product language.
   - Current friction: `src/components` is grouped partly by feature, but the
     folder name implies UI-only code. As Area, Project, Item, Inbox, and
     Dashboard behavior grows, colocating feature UI, client adapters, and
     small pure helpers under `components` will become unclear.
   - Improvement: introduce `src/features/` gradually, using the product
     language as folder names: `areas`, `projects`, `items`, `inbox`, and
     `dashboard`. Keep route files in `src/routes` focused on params,
     navigation, and page composition. Use route-local `-*` folders only for
     implementation details that truly belong to one route.
   - Shape:

     ```text
     apps/web/src/features/
       areas/
         components/
         optimistic.ts
       projects/
         components/
         optimistic.ts
       items/
         components/
       inbox/
         components/
       dashboard/
         components/
       shared/
         optimistic.ts
     ```

   - Backend follow-up: move domain helpers from `convex/lib` toward
     `convex/domain` when the separation becomes useful:

     ```text
     apps/web/convex/domain/
       areaProjects.ts
       healthStatus.ts
       inboxProcessing.ts
       projectChanges.ts
     ```

   - Test gain: feature-level client adapters can be tested close to the
     feature they serve, while pure domain helpers remain testable without
     React or Convex.
