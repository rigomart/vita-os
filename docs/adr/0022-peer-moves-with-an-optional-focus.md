# Peer Moves with an optional Focus

**Status:** Accepted
**Date:** 2026-09-26

A **Thread**'s **Next Move** and its **Up Next** queue are replaced by **Moves**: an unordered set of peers, shown in the order they were captured. The user may single out one as the **Focused Move**, or leave all of them unfocused. Issue #366 is the specification.

The queue assumed the moves had a known order. Most of the situations Vita OS holds don't: the moves can be done in parallel, their order doesn't matter, or ranking them needs information the user doesn't have yet. The queue ranked them anyway. Whatever was written down first became the Next Move and led the Thread's card on the **Dashboard** — a priority the user never chose — and completing it promoted the next one, so the headline changed to something the user didn't pick either. Avoiding that meant deciding the order while capturing, which breaks the rule that capture needs no classification.

This supersedes ADR 0010 and amends ADRs 0003 and 0017. ADR 0009, which the spec also names, was already superseded by ADR 0021.

## Considered Options

- **Keep the queue and let the user reorder it.** Rejected: the order still reads as a priority, and capture still produces one the user never chose.
- **A checklist with done states.** Rejected, as in ADR 0010: done states duplicate the Activity Log and the list grows instead of shrinking.
- **Peer Moves with an optional Focus** — chosen.

For the Dashboard, three presentations were compared: a compact card that expands in place, the full list under each card, and a separate Moves pane. The compact card was chosen without expanding in place. The full list undoes the density work in ADR 0017, and opening a card already summons Thread detail (ADR 0007).

## Decision

- **Moves are peers.** Each has a stable ID and trimmed, non-blank text; no date, no done state, no nesting, no manual order, no limit. Adding a Move never asks whether to focus it.
- **At most one Focused Move**, always one of the Thread's Moves. Focusing a Move replaces any earlier focus; `null` unfocuses. Focus is emphasis only: attention, the Dashboard columns, and the **Ready to move** run read whether a Thread has Moves and its **Follow-up**, never the focus or the number of Moves.
- **Completing any Move** removes it and writes a `move_completed` Activity Log entry, which also stamps last activity. Completing or removing the Focused Move leaves the Thread unfocused — **nothing is promoted**. Completing every Move leaves the Thread open.
- **Adding, editing, removing, and focusing write no Activity Log entry.** Existing `next_move_change` entries keep their type, wording and label.
- **Resolving** discards the Moves and the focus, and the resolution entry names the discarded Moves in capture order. Reopening restores neither.
- **Commands are keyed by Move ID**, not a whole-list rewrite: add, edit, remove, complete, and set focus. Every command carries the revision the caller read. A stale revision, or a Move that is no longer there, is refused as a non-retryable conflict and writes nothing, so a command never lands on a different Move — and two competing completions record one.
- **The caller mints a Move's ID** when it adds it. A Move shown optimistically keeps the name every later command uses, so "add, then focus it" works before the add has returned. The service refuses an ID the Thread already holds.
- **The application queues a Thread's Move commands.** They share one mutation scope: each shows its change at once, but they reach the service one at a time, and each carries the revision the previous one brought back. Local changes run the same core rules the service runs.
- **Storage.** The Thread row holds `moves_json` — a JSON array of `{id, text}` in capture order, NULL when empty — and a nullable `focused_move_id`. The Activity Log's type constraint is widened by rebuilding the table.
- **The card has two fixed rows that never trade places** (a refinement made while prototyping, over the spec's "lead with the Focused Move"): the Thread title always heads the card, and the second row is the move slot — the Focused Move, else the only Move, else "N moves · none focused". Pips give a quiet count of the Moves, the focused one filled. A Thread with no Moves is its title alone. The rail completes only the Move the slot shows; focusing and removing happen in Thread detail.
- **Thread detail** lists every Move in capture order. Focus is a radio beside each Move: pressing it focuses that Move, and pressing the filled one unfocuses it. The Focused Move is tinted in place; it carries no label of its own.

## Consequences

- Step-by-step Threads lose automatic promotion: after completing the Focused Move the user focuses the next one by hand, or leaves it unfocused. This is the known cost, revisited only if it proves painful.
- Existing data converts without visibly changing (migration `0005_peer_moves`): a Next Move becomes the first Move and is focused, and Up Next entries follow, unfocused, in queue order, each with a new ID. Threads with neither — resolved ones included — get no Moves and no focus. Activity Log entries are untouched.
- "Next moves" is retired as a list name; that group of Threads is **Ready to move** everywhere.
- The design exploration that settled the card and the detail list is kept on the `prototype/366-peer-moves` branch.
