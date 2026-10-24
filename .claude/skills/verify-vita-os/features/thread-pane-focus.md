# Thread pane focus

Opening a Thread moves keyboard focus into it: onto the side pane's `aside` from 1280px, onto the drawer below. Escape closes the side pane from anywhere except a field that keeps it (`Add a task`, the title and Summary editors), and closes the drawer. Closing, by Escape or `Close thread`, returns focus to whatever opened the Thread: the Dashboard line, `Search, Command K`, or `New thread`.

## Entry points and variants

- A Dashboard line's link, by Enter (`focus @<ref>`, then `press Enter`) and by click
- The palette: `Search, Command K`, type the title, Enter on the selected option
- `New thread` → `Create`: in the header from 1024px, in the bottom `nav[aria-label=Actions]` below
- 1440×900 (side pane), 1024×768 and 390×844 (drawer)

## Preconditions

- Two Threads with a Task each, created through New thread, and no Thread open.

## Checks

Read focus right after each step with
`eval "(a => JSON.stringify({tag: a.tagName, slot: a.getAttribute('data-slot'), label: a.getAttribute('aria-label'), text: a.innerText.split('\n')[0]}))(document.activeElement)"`.

1. At 1440, Enter on a line's focused link opens the Thread (`/?thread=<slug>`), and focus is on the pane: `{"tag":"ASIDE","slot":"thread-detail-pane","label":"<thread title>",…}`. Clicking a line's link does the same.
2. `press Escape` in the pane closes it, and once `[data-slot=thread-detail-pane]` is gone, focus is on the line's link (`{"tag":"A",…,"text":"<thread title>"}`). `Close thread` after a click-opened Thread does the same.
3. Enter on the Thread's option in the palette puts focus on its `aside`; Escape then returns it to `Search, Command K`.
4. `New thread` → `Create` puts focus on the new Thread's `aside`; `Close thread` returns it to `New thread`.
5. In `Add a task` with text typed, `press Escape` empties the box (`""`) and leaves focus there with the pane open; a second Escape still leaves the pane open.
6. With the pane open and focus on a Dashboard line's link, Escape closes the pane and focus stays on that link.
7. At 1024 and at 390, each opener in checks 1, 3 and 4 puts focus on the drawer itself: `{"tag":"DIV","slot":"drawer-content",…}`, `role="dialog"`, labelled by the Thread's title. Escape or `Close thread` closes it, and once `[data-vaul-drawer]` is gone focus is on the opener. At 390 the palette and New thread openers are the bottom bar's (`document.activeElement.closest('nav[aria-label=Actions]')` is not `null`). In the drawer, Escape in `Add a task` with text empties it and leaves the drawer open.

## Traps

- Focus moves back only after the slide out: right after Escape the `aside` is still in the page and still focused for about 0.2 s. Confirm the pane or drawer is there, act, wait for it to be gone, then read focus.
- Opening the Thread that is already open does not move focus; only a different Thread does. Close any open Thread before checking an opener.
- A click inside the pane or drawer during its slide lands behind it, and focus ends on the body; wait for the slide to end (see Gotchas in SKILL.md). On a phone the New thread form slides in too: filling it and clicking `Create` mid-slide created no Thread.
