# Create a thread

The New thread dialog takes a title, and Create stores an Open Thread and opens it in place: a side pane from 1280px, a drawer below. The Thread stands in No date under `Open` until it has Tasks.

## Entry points and variants

- Header `New thread` (1024px and wider); bottom `nav[aria-label=Actions]` below 1024px
- Side pane (`[data-slot=thread-detail-pane]`, 1280px and wider) and drawer (`[data-vaul-drawer]`, narrower)

## Preconditions

- A signed-in throwaway user.

## Checks

1. `Create` is disabled until the title has text, and enabled right after it gets one (`is enabled`).
2. `Create` sends `POST /v1/threads` and gets `201`.
3. Right after it, the URL is `/?thread=<slug of the title>-<8 hex>` and the pane or drawer for the width is open, titled with the exact title (the drawer's `aria-labelledby` text; the pane's title button).
4. After a reload the Thread is the one line under `Open` in No date (below 1024px, inside the folded No date once it is opened; read the groups on screen as in [Dashboard](dashboard.md)), and `All` counts it.
5. It is stored once, open, with no Area and no Tasks:
   `SELECT title, state, area_id, moves_json FROM threads WHERE user_id = (SELECT id FROM user WHERE email = '<email>')` → `[{"title":"<title>","state":"open","area_id":null,"moves_json":null}]`

## Traps

- The dialog stays on screen with its controls disabled for a moment after Create; take a new snapshot before acting on the pane.
- The drawer slides in: wait for `getAnimations().length === 0` on `[data-vaul-drawer]` before clicking inside it.
- Below 1024px the hidden side copy of No date also holds an `Open` run, so `main section[aria-label=Open]` finds the Thread there while the folded No date hides it.
