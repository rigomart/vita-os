# Resolved Threads in the palette

Status: Amended by ADR 0031 — the Resolved chip is now History, holding Resolved threads (unchanged) and Archived notes.

Resolved Threads need a way back for reading and reopening. The Dashboard continues to hold open work; the palette reaches resolved history without adding another browsing surface.

## Decision

The palette starts with open Threads and its existing filters and actions. A visible **Resolved** chip switches to all resolved Threads, searchable by title and Area. Clicking the chip again returns to the normal palette. Switching clears the query, and opening the palette afresh starts with open work. Choosing a resolved Thread opens the existing pane in place, preserving the current page and Area filter; its existing Reopen action remains the way to return it to open work.

`GET /v1/threads/resolved` lists only the signed-in user's currently resolved Threads. It orders by the latest owned Activity Log entry with type `state_change` and new value `resolved`, newest first, with Thread ID breaking ties. Threads without a recorded resolution appear last. The Activity Log already records resolution, so no new timestamp or migration is needed.

## Consequences

Resolved history is fetched only when the chip is selected and refreshed after Thread changes. The chip makes history discoverable without adding history rows to open work or requiring a search first. Searching and reading do not reopen a Thread. Reopen retains its existing rules: discarded Moves, focus, and old Follow-up dates do not return. This extends ADR 0006's palette-first jumping surface.
