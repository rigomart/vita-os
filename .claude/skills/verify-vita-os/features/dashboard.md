# Dashboard

One list groups dated Threads (one line per dated Task) and dated Standalone Notes under when they come due (Late, Today, Tomorrow, weekdays, then Later), beside No date, which runs `Ready to move`, `Open`, then `Notes`. A run with nothing in it is not shown. The filter row counts what is open and narrows the list.

## Entry points and variants

- `/` at 1440×900: No date sits beside the list
- `/` at 390×844: No date leads the list, folded to one button that names its first two items (`<first>, <second> and <n> more`), opens the runs in place and then reads `Hide`
- Filter row `navigation "Filter the board"`: `All <n>`, each Area, `Notes <n>` (`?show=notes`), `Edit areas`

## Preconditions

- Check 4: a new user's empty board.
- Checks 1 to 3, made through the UI: a Thread with one undated Task (New thread, then `Add a task`), a Thread whose only Task is dated tomorrow (its row's `Set date`), a Thread with no Tasks (New thread alone), an undated Note (New note), and a Note with tomorrow's `Follow-up date` (picked in New note).

## Checks

Read the groups on screen and each group's own lines with
`eval "JSON.stringify([...document.querySelectorAll('main section[aria-label]')].filter(s => s.checkVisibility()).map(s => ({group: s.getAttribute('aria-label'), items: [...s.querySelectorAll('li')].filter(li => li.closest('section[aria-label]') === s).map(li => li.innerText.replace(/\s*\n+\s*/g, ' | '))})))"`.

1. Groups and lines, in this order:
   - At 1440: `Tomorrow` holds `Task: | <dated task> · <its thread>`, then the dated Note's text; `Ready to move` holds `<thread> | Task: | <undated task>`; `Open` the taskless Thread's title; `Notes` the undated Note's text.
   - At 390, folded: only `No date` (no lines of its own) and `Tomorrow` (`Task: | <dated task> | <its thread>`, then the dated Note). Opened: `No date` (still no lines of its own), `Ready to move`, `Open` and `Notes` with the lines they have at 1440, then `Tomorrow`.
2. `All <n>` counts open Threads plus open Standalone Notes, and `Notes <n>` counts open Standalone Notes (exact link text: `All 5` and `Notes 2` with the preconditions).
3. `?show=notes` keeps only Notes in every group (`Tomorrow` holds the dated Note, `Notes` the undated one, and no Thread line is left), and the selected filter is `Notes` (`nav[aria-label="Filter the board"] [aria-current]` reads `Notes 2`).
4. With nothing open the board reads `Nothing is asking for you.`

## Traps

- No date is in the page twice, one copy hidden. Below 1024px the side copy (`aside[aria-label='No date']`) stays mounted, so `main section[aria-label='<run>']` also matches its hidden runs, and the runs on screen are inside the folded `section[aria-label='No date']` once it is open. From 1024px the folded copy is the hidden one, an empty `section[aria-label='No date']`. Read only what `checkVisibility()` keeps, and count a group's own `li`s: an opened `No date` section also contains its runs' lines.
- A line wraps with the width: the same Tomorrow line reads `Task: | <task> · <thread>` at 1440 and `Task: | <task> | <thread>` at 390.
- A Thread line's link holds only the title; read the line from its `li`. `Task:` at its start is screen-reader text.
- Below 1024px the header buttons are in the page but hidden; check layout with `is visible "nav[aria-label=Actions]"`.
