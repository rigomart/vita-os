# Top-bar Area strip

Switching to a sibling **Area** from inside one was palette-only (⌘K) or two hops via the Dashboard — the trade-off accepted in ADR 0006. With Areas being a small, stable, user-ordered set, that put a modal between the user and a one-of-eight choice, and hid the app's primary containers from the chrome entirely. The top bar's left wing now carries a persistent **Area strip**: one hexagon per Area in the user's own order, each a one-click jump, with a visible `1..9` digit under each hexagon and a condition dot on Areas asking for attention. ⌘K stays the jumping surface for **Threads** and everything else; this amends ADR 0006's "the palette is the sole jumping surface" for Areas only.

## Considered Options

Four directions were compared as interactive variants on the real app (prototype on branch `worktree-prototype-area-switcher`, switchable chrome over live routes and data):

- **Palette-only** (ADR 0006 status quo): fine for Threads, whose set is large and dynamic, but for a handful of fixed Areas it charges a modal round-trip for a spatial-memory jump, and hidden navigation measurably hurts discoverability on desktop.
- **Left icon rail** (Discord-style): a full-height rail of Area hexagons. Rejected for the same reason ADR 0006 rejected its sibling: permanent vertical chrome on every screen re-creates a second awareness surface beside the Dashboard, and costs width the thread rail already competes for.
- **Area title switcher** (GitHub-repo-switcher style): a disclosure chevron on the Area title opening a jump popover. Contextual and cheap, but it only exists inside an Area, and is still open-then-pick — two interactions where the strip needs one.
- **Top-bar Area strip** (chosen): uses the top bar's empty left wing, so switching costs no new chrome. The strip doubles as ambient condition awareness in every view, and the always-visible digits make the `1..9` shortcuts learnable — the number being rendered in the UI is what makes Slack's workspace switching work.

## Consequences

- `components/layout/top-bar-area-strip.tsx` renders inside `AppTopBar`'s left grid cell after the brand mark, from its own `areas.list` subscription — the first always-on reader of that query on every authenticated page (the shell's and the palette's are mount- or `skip`-gated). The list is small and shares the cache with those surfaces when they open. Active Area gets the brand-ink/gold hexagon treatment; non-healthy Areas carry their condition dot; hover shows name, condition, and shortcut in a tooltip.
- Bare `1..9` (`features/navigation/use-area-jump-shortcuts.ts`) navigates to the Nth Area in the user's order — stable, user-controlled ordering, so positions build muscle memory (MRU/recency ordering was deliberately avoided). The chord is deliberately modifier-free, matching the global `Q` capture shortcut: `⌘/Ctrl+digit` is the browser's own tab switcher and is left untouched. Matching is by physical key (`e.code`), so layouts that type digits shifted still work. Areas past 9 render without a digit and remain clickable. The shortcuts stay active on mobile widths and inside Threads; they are ignored while focus is in an editable control.
- The strip is `hidden` below `md`: the mobile loop keeps its three tabs and the palette.
- ADR 0006 otherwise stands — no sidebar returns, the Dashboard remains the sole browsing surface, and the palette remains the jumping surface for Threads, actions, and search.
- The losing variants (icon rail, title switcher) and the variant-switching scaffold live on the `worktree-prototype-area-switcher` branch as the primary source; none of it ships.
