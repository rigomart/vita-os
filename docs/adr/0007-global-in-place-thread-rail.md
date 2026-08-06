# Global in-place thread rail

ADR 0006 made the palette the sole jumping surface and the **Dashboard** the sole browsing surface, but jumping or browsing to a **Thread** still navigated to `/$areaSlug/$threadSlug`, yanking the user onto the **Area** page and losing their place. The Thread detail pane (desktop right rail / bottom Drawer per ADR 0004) was already self-contained — it fetches by slug and is positioned fixed — so it becomes a global in-place overlay hosted by `AppShell`: a `thread` search param on the authenticated layout opens the pane over whatever page the user is on, and every opener (command palette, Dashboard attention rows, recent activity, Plan chips, Area inventory rows, create-thread flows) sets the param instead of navigating.

## Considered Options

- **Keep route navigation to `/$areaSlug/$threadSlug`**: the status quo. Every opener already worked, but each jump replaced the page under the user — losing the place the Dashboard and palette had just put them in.
- **Search param only, retiring the path route**: a single URL model, but existing bookmarks and shared links break, and a Thread loses its canonical address.
- **Search param overlay with the path retained as a deep link**: chosen. In-app opens keep the user's place; the path stays canonical and lands identically to before.

## URL model

- `?thread=<threadSlug>` on any authenticated route opens the pane over the current page. Thread slugs are unique per user, so the param needs no Area segment.
- Closing the pane strips the param; the page underneath was never left.
- `/$areaSlug/$threadSlug` remains the supported, canonical deep link. Its route renders nothing; `AppShell` detects the match and shows the pane over the **Area** page, exactly as before. Close from a deep link still navigates to `/$areaSlug`.
- When both a matched thread route and a `thread` search param are present, the search param wins.
- Renaming a **Thread** (slug change) or moving it to another **Area** updates the search param in place when opened via param, and replaces the path route when opened via deep link.

## Consequences

- The desktop rail still pushes rather than covers: the width spacer moved from the Area layout into `AppShell`, so ADR 0004's push behavior now holds on every page.
- The **Dashboard** and **Inbox** show the rail with no **Area** behind it, partially superseding ADR 0004's premise that the rail exists to keep the Area visible as context.
- The palette no longer needs to resolve an **Area** before offering a **Thread**; selecting one sets the param and keeps the current page.
- Opening a **Thread** preserves scroll position and in-progress context on the underlying page; close returns exactly there.
- Below 1280px the bottom Drawer behavior is unchanged; only its host moved from the Area page into `AppShell`.
- `/$areaSlug/$threadSlug` stays valid for bookmarks and sharing, but its route component renders nothing itself.
