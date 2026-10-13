# Dashboard board

A signed-in user with open Threads or Notes sees the Dashboard (ADR 0037): under the sky header, one list of every dated item, grouped by when it comes due (`Late`, `Today`, `Tomorrow`, each weekday, `In 1 week`, …, month names), each group on a file tab, and `No date` with its runs `Ready to move`, `Open`, and `Notes`. From `lg` No date is an aside beside the list; below `lg` it leads the list, folded to one line. Threads and Notes share one card: a title, then the Focused Task or a two-line plain-text Note preview, then a footer with the date token and, on a Thread, its Area tag on the left and the set-date and complete controls on the right, shown on hover or focus. Every card is a sheet with a border on its group's fill, and two cards in a row end together with their footers on one line. A Note has no tag; its sheet's top right corner is folded over (ADR 0038). From `In 1 week` on, items are one-line rows. With nothing open, the list is replaced by `Nothing is asking for you.`

Status: proven in #437 (9bbf928) at 1440×900, 1024×768 and 390×844, dark and light; card placement, slots and counts proven in #462 by `dated-tasks.spec.ts`, `dashboard-tasks.spec.ts`, `dashboard-filter-counts.spec.ts` (incl. 390×844) and `notes-dashboard.spec.ts`. Not driven since #437: dark mode and the filter overflow.

## Sub-features

- `board-empty` shows `Nothing is asking for you.` when no Thread or Note is open, and no No date aside.
- `board-list` is `region "<group>"` per group, in order: `Late`, `Today`, `Tomorrow` (hint the weekday), each weekday (hint `in 3 days`), `In 1 week` (hint `Oct 16–22`), `In 2 weeks`, `In 3 weeks`, then month names. Each heading (level 2) reads label, hint, count. Late's tab is warm and its cards carry no tint of their own.
- `board-cards` puts cards two to a row once the list is 42rem wide (at 1440 and 1024, not at 390).
- `board-lines` turns each item from `In 1 week` on into one line: a Thread is `link "<title> <token>"`, a Note `button "Open note: <preview>"`; either opens like its card.
- `board-no-date` lists undated items in `complementary "No date"` (from `lg`) under `Ready to move`, `Open`, and `Notes` (level 3). With nothing undated it reads `Everything open has a date.`
- `board-no-date-folded`: below `lg`, `region "No date"` leads the list with one `button` (`expanded=false`) reading `<first>, <second> and <n> more`. Clicking it shows the runs in place and reads `Hide`. Not shown when nothing is undated.
- `board-card` renders Threads and Notes with the same three rows. A Thread card shows `link "<title>"`, the Task that leads it (the dated Task that placed it, else the Focused Task, else the only Task, else `N tasks · none focused`), `Set date` / `Change date`, and `Complete “<task>”`. A Note card shows `button "Open note: <plain-text preview>"`, `Set follow-up date`, and `Archive note`.
- `board-card-actions` completes a Task, dates a Note, and archives a Note from the card (`Note archived`).
- `board-filter`: All counts every Open Thread and open Standalone Note. Areas and No area count only their Open Threads; Notes counts only open Standalone Notes. See [Notes on the Dashboard](./notes-on-the-dashboard.md) and [Manage areas](./manage-areas.md). Chips that do not fit fold into `button "<n> more"`.
- `board-time` (ADR 0027): a dated Task or a Note's Follow-up date may carry a time, set from the `group "Time"` chips in every date picker, or `Other time` for a typed one (ADR 0040). Within a day, untimed items come first, then timed ones in time order. A timed card under `Today`, `Tomorrow` or a weekday shows the time alone (`3 PM`); elsewhere it follows the date token (`−2d · 9:30 AM`).
- `board-chrome`: `banner "Vita OS"` holds the logo link `Vita OS home`, the weekday and date, and from `lg` `Search, Command K`, `New note`, `New thread` and the account button. Below `lg`, `navigation "Actions"` at the bottom holds `Search, Command K`, `New thread` and `New note` (shown as `Note`).

## How to get to it (user POV)

- Sign in. The Dashboard at `/` is the landing page.
- Create Threads per [Create a thread](./create-thread.md), give them Tasks per [Tasks](./tasks.md), and capture Notes per [Capture a note](./capture-note.md). Date a Thread by giving one of its Tasks a date and a Note with `Follow-up date` in the `New note` dialog. `dated-tasks.spec.ts` drives this end to end.

## Driving it

Specs: `dashboard-filter-counts.spec.ts` (filter counts), `dashboard-tasks.spec.ts` (the card's Task slot and completing from it), and `dated-tasks.spec.ts` (placement on the list, times, rescheduling from the card), in `apps/e2e/tests/`. For the rest, give the spec's user Threads and Notes spread over Late, Today, the coming days, weeks out and undated, at 1440×900.

- **Filter counts.** `dashboard-filter-counts.spec.ts`: a dated Note alone reads All 1, adding an undated Note reads All 2, and adding a Home Thread reads All 3, Home 1, No area 0, Notes 2. Area and Notes filters keep their own contents; All 3 also stays visible at 390×844.
- **List and No date.** `page.goto("/")`, expect `getByRole("region", { name: "Late" })`, then `shot("board-desktop")`. The page has `region "Late"`, `region "Today"` and the later groups, and `complementary "No date"` with its runs. `page.screenshot({ path, fullPage: true })` shows the one-line weeks and months at the foot.
- **Filter overflow.** With more Areas than fit (seven at 1440), the row ends `… <n> more`, `Notes <n>`, `Edit areas`. Click `getByRole("button", { name: "<n> more" })`, then `getByRole("menuitemradio", { name: "<Area> <count>" })`: the URL gets `?area=<slug>` and the chosen Area takes the last visible chip.
- **Thread from a card.** `getByRole("link", { name: title, exact: true })` opens `complementary "<title>"` at 1440 (`dialog "<title>"` below 1280); `button "Close thread"` closes it.
- **Card actions.** Click `button "Complete “<task>”"` (`exact: true`) inside `sent`, reload, and expect it hidden: the completed one-off Task is gone and the Thread moves to `No date` → `Open`.
- **Phone.** `page.setViewportSize({ width: 390, height: 844 })`, reload: the folded `No date` leads the list; click `button "<first>, <second> and <n> more"` to open it. The bottom `navigation "Actions"` opens the palette and the New note dialog.

## Gotchas

- The open Thread pane covers the header's right-hand actions and the right of the list at 1280px and up (ADR 0023, ADR 0037). Close it (`Close thread`) before clicking `New thread`, `New note`, or a card in the right column, or use the palette.
- Below `lg` the header's actions are hidden and the bottom bar's are shown; both share names (`New note`, `New thread`, `Search, Command K`), and `getByRole` skips hidden elements, so one locator reaches whichever is on screen.
- A time is a chip (`9 AM`, `12 PM`, `3 PM`, `6 PM`) or typed under `Other time` (type `330p`, then Enter); the chip that holds it is `aria-pressed`, and a typed one shows as `Other time: 3:30 PM`.
- Card controls only show on hover or focus. They are still in the accessibility tree, so `getByRole` reaches them without a hover.
- `Archive note` matches every Note card on the board. Scope to one card when several Notes are open: `page.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Open note: <text>/ }) }).getByRole("button", { name: "Archive note" })`.
- The sky follows the browser's clock; there is no override to preview another hour in the product (the lab prototype takes `?hour=`).
