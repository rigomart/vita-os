# Palette-first navigation

The sidebar (Dashboard, Inbox, Area → Thread tree, New task, user menu) was the wrong navigation model for a hub-and-spoke app: its thread tree competed with the **Dashboard** — the attention-ordered awareness surface — and lost, and without the tree it was a full-width column justifying itself with roughly eight rows (#247). Navigation chrome is now a minimal top bar where a ⌘K command palette is the primary way to go anywhere, with a Dashboard / Inbox / New task tab bar on mobile. The **Dashboard** is the sole browsing surface; the palette is the sole jumping surface.

## Considered Options

Four directions were compared as interactive variants on the real app (prototype on branch `worktree-prototype-nav-247`, switchable chrome over live routes and data):

- **Keep the sidebar**: the baseline. Its Area → Thread tree duplicates Dashboard data with no attention signals, so navigating from it bypasses the app's core value.
- **Top bar with breadcrumb dropdowns**: no sidebar; Dashboard/Inbox links in a top bar, breadcrumbs with segment dropdowns inside Areas/Threads. Workable, but the persistent links and breadcrumbs still duplicate what Dashboard and palette do better.
- **Slim icon rail**: Areas as icons with condition dot and open-thread count, no thread tree. The rail's at-a-glance signals re-create a second, weaker awareness surface beside the Dashboard.
- **Palette-first**: chosen. Chrome keeps only brand (→ Dashboard), the palette trigger, Inbox awareness (badge), New task, and the user menu. Jumping to any Area, Thread, or action is one ⌘K away; browsing happens where the attention signals live.

## Consequences

- The authenticated layout is `AppShell` (`components/layout/app-shell.tsx`): top bar + mobile tab bar + command palette + the create dialogs. The shadcn sidebar component is no longer mounted.
- The command palette (`components/layout/command-palette.tsx`, shadcn `command` on `cmdk`, adapted to the Base UI dialog) lists actions (New task/thread/area), fixed destinations (Dashboard, Inbox), all **Areas**, and all **Threads** with their Area as context.
- On mobile the phone loop (glance at Dashboard, process Inbox, capture a task) is three always-visible tabs instead of a hamburger drawer.
- From deep inside a **Thread**, reaching a different **Area** is palette-first (⌘K) or two hops via the Dashboard; there are no breadcrumbs.
- The create dialogs, the global `Q` new-task shortcut, and the theme/user menu — previously hosted by the sidebar — live in `AppShell` chrome; area creation moved from the sidebar's "Add area" row into the palette.
- Desktop reclaims the full viewport width for content; pages keep their own max-widths.
