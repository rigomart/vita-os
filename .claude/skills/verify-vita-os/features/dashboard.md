# Dashboard

One list groups dated Threads (one line per dated Task) and dated Standalone Notes under when they come due (Late, Today, Tomorrow, weekdays, then Later), beside No date, which runs `Ready to move`, `Open`, then `Notes`. The filter row counts what is open and narrows the list.

## Entry points and variants

- `/` at 1440×900 (No date beside the list) and below 1024px (No date leads the list, folded)
- Filter row `navigation "Filter the board"`: `All <n>`, each Area, `Notes <n>` (`?show=notes`), `Edit areas`

## Preconditions

- Through the UI: a Thread with one undated Task, a Thread dated tomorrow through a Task, an undated Note, and a Note with tomorrow's Follow-up date.

## Checks

1. Groups and their items, read with
   `eval "JSON.stringify([...document.querySelectorAll('main section[aria-label]')].map(r => ({group: r.getAttribute('aria-label'), items: [...r.querySelectorAll('li')].map(li => li.innerText.replace(/\s*\n+\s*/g, ' | '))})))"`:
   the dated Thread and dated Note are under `Tomorrow`, the undated Thread with a Task under `Ready to move`, a Thread with no Tasks under `Open`, the undated Note under `Notes`. The `No date` entry itself lists no items; its runs do.
2. `All <n>` counts open Threads plus open Standalone Notes, and `Notes <n>` counts open Standalone Notes (exact link text).
3. `?show=notes` keeps only Notes in every group, and the selected filter is `Notes` (`nav[aria-label="Filter the board"] [aria-current]`).
4. With nothing open the board reads `Nothing is asking for you.`

## Traps

- A Thread line's link holds only the title; read the line from its `li`. `Task:` at its start is screen-reader text.
- Below 1024px the header buttons are in the page but hidden; check layout with `is visible "nav[aria-label=Actions]"`.
