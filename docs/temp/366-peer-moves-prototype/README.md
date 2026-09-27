# PROTOTYPE — peer Moves with an optional Focus (#366)

Throwaway design prototype. It lives on this branch only and never merges.

Canvas: https://claude.ai/artifact/WMr2hdFXXQJhJdP456E2fQ

Question: what should the Dashboard card and the Thread detail look like once
Next Move and Up Next become unordered Moves with an optional Focused Move?

Three directions, each an interactive `.dc.html` artboard of the Design canvas:

- `Main.dc.html` — A, Lead line: closest to today; focused row keeps the slot style.
- `FocusRail.dc.html` — B, Focus rail: a radio column for focus.
- `PeerTiles.dc.html` — C, Peer tiles: Moves as a grid, cards stack in depth.

Verdict: **B**, with the owner's adjustments:

- The card never swaps the Thread title and the Move. Row 1 is always the
  title; row 2 is the move slot (the Focused Move, the only Move, or
  "N moves · none focused"). Pips count the Moves; the rail completes only the
  Move row 2 shows.
- Thread detail has no "No focus" row and no card preview. The focused row
  carries a "Focused ×" chip that clears focus in one click; the filled radio
  toggles it too.
