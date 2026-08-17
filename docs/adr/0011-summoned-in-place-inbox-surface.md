# Summoned in-place Inbox surface

The **Inbox** lived at `/inbox` as a full page, so triaging a handful of **Tasks** navigated the user off whatever they were doing — the same context loss ADR 0007 removed for **Threads** — and the page was more chrome than content. The Inbox screen was already self-contained (it fetches its own data and hosts the full process flow), so it becomes a summoned surface: an `inbox` search param on the authenticated layout opens it over whatever page the user is on, and every opener (top bar, palette, **Plan** Task chips, mobile tab) sets the param instead of navigating. The form is a compact non-modal floating panel under the top bar on wide screens and a bottom Drawer below 768px. Three candidate forms were compared as switchable chrome over the real app on branch `worktree-prototype-inbox-291`, the method ADR 0006 established.

## Considered Options

- **Keep the `/inbox` page**: the status quo. Every triage trip replaced the page under the user and cost them their place.
- **Push rail beside the Thread rail**: strongest precedent fit (ADR 0004/0007 physics), but with both rails open the content column collapses to a sliver at the 1280px breakpoint, and it makes a second permanent layout region out of a surface that is summoned briefly.
- **Right overlay drawer**: no layout shift, but its modal backdrop takes the working surface away and covers the Thread rail mid-processing — exactly when a **Task** is being consumed into a **Thread**.
- **Non-modal floating panel**: chosen. The lightest summon; the page and an open Thread rail stay visible and interactive, and full Inbox capability fits at a compact density with an internal scroll.

## URL model

- `?inbox=true` on any authenticated route opens the surface over the current page. Closing strips only that param; the page underneath was never left.
- `/inbox` remains the supported deep link. Its route renders nothing itself; it lands on the **Dashboard** with the surface open, preserving any other params (including `?thread=`).
- The surface coexists with the Thread rail: both can be open, the rail keeps pushing the page while the panel floats above it.

## Consequences

- The Inbox page is gone; the Inbox screen renders only inside the summoned surface, and **Plan** Task chips stop navigating to `/inbox`.
- The panel is non-modal: outside click and Escape dismiss it, guarded so interactions with nested overlays (process dialog, When picker, discard confirm) never tear the surface down.
- The surface follows the 768px `useIsMobile` breakpoint, not the rail's 1280px one; below it the mobile tab summons a bottom Drawer instead of navigating, leaving the rest of the phone loop untouched.
- This is the first scrollable list hosted in a popover-like surface — prior popovers were compact pickers — so the panel caps its height and scrolls its body under a pinned header.
