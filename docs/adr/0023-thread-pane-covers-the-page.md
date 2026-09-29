# Thread pane covers the page

**Status:** Accepted
**Date:** 2026-09-28

On desktop the **Thread** detail pane now slides over the page instead of pushing it aside. The page keeps its full width while a **Thread** is open; the pane is a fixed, non-modal rail on the right edge with a shadow, and the page behind it stays live. Only the controls pinned to the right edge — the floating chrome's right cluster, the dock, and the **Notes** panel — move left by the rail's width so they stay reachable. Below 1280px the bottom Drawer is unchanged.

ADR 0004 made the rail push so the **Area** page would stay fully visible beside a **Thread**. There is no Area page any more (ADR 0021), and the page the pane opens over is almost always the **Dashboard**, whose lanes (ADR 0017) fill the viewport and pick their layout from the viewport width, not from the space they are given. Pushing kept all four lanes and squeezed them: at 1280px each dated lane fell to about 170px, too narrow for the three-row board card. The push also animated the column's width, so every card on the board re-wrapped on each frame of the open and close.

## Considered Options

- **Keep pushing**: nothing is ever hidden, but the board is cramped whenever a **Thread** is open and reflows as the pane moves.
- **Keep pushing and make the board respond to its own width**: container queries would drop the board to two columns under the pane. Everything stays visible, but opening a **Thread** reshuffles the board the user was reading, and every surface behind the pane would need the same treatment.
- **Cover the page, non-modal**: chosen. The board holds still and keeps its full lane widths; the pane hides the right edge of the page — on the Dashboard, the **No date** tray and a sliver of **Later** — for as long as it is open.

## Consequences

- Amends ADR 0004 and ADR 0007: the rail covers rather than pushes. Everything else in them stands — the rail's width, the Drawer below 1280px, the `?thread=` URL model, and the page underneath never being left.
- The pane stays non-modal: no scrim, no focus trap, and the page behind it takes clicks, so choosing another card switches the pane to that **Thread**. The close button closes it.
- A card opened from the **No date** tray sits under the pane while it is open. The least urgent lane is the one covered; the **Now** and **This week** lanes stay fully visible.
- The pane's open and close animate only its own position, so the page does no layout work while it moves. Closing now completes when the pane's slide ends rather than when a spacer's width does.
- `AppShell` owns the rail offset as a `--rail` custom property, 0px while no **Thread** is open. Anything pinned to the right edge of the viewport clears the pane by it.
