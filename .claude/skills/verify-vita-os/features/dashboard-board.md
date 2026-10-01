# Dashboard board

A signed-in user with open Threads or Notes sees the Dashboard board: three dated lanes (`Now`, `This week`, `Later`) and a wider, recessed `No date` tray that groups undated items under `Ready to move`, `Open`, and `Notes`. Threads and Notes share one card: a title, then the Focused Move or a two-line plain-text Note preview at full width, then a footer with the date token and, on a Thread, its Area tag on the left and the set-date and complete controls on the right, shown on hover or focus. A Note has no tag; a short margin rule at its left edge marks it. A late item gets a tint and a negative day token such as `-3d`. With nothing open, the board is replaced by `Nothing is asking for you.`

Status: proven on ba85712 (lanes, tray groups, card rows and footer, late tint, empty lane placeholder, hover controls, `board-card-actions` at 1440×900; `board-stack` at 1024×768 and 390×844 with the tray folded and unfolded).

## Sub-features

- `board-empty` shows `Nothing is asking for you.` when no Thread or Note is open.
- `board-lanes` sorts dated items into `Now` (late or due today), `This week` (the next six days), and `Later`, each with a count and a hint. An empty lane shows a dashed `Nothing here.` placeholder.
- `board-tray` groups undated items in the `No date` tray under `Ready to move` (Threads with Moves), `Open` (Threads without), and `Notes`.
- `board-card` renders Threads and Notes with the same three rows. A Thread card shows `link "<title>"`, the Focused Move, `Set Follow-up`, and `Complete “<move>”`. A Note card shows `button "Open note: <plain-text preview>"`, `Set attention date`, and `Mark note done`.
- `board-card-actions` completes a Move, dates a Note, and marks a Note done from the card.
- `board-stack` stacks the lanes two per row at `md` and in one column on a phone, where `Later` and `No date` start folded.

## How to get to it (user POV)

- Sign in. The Dashboard at `/` is the landing page.
- Create Threads per [Create a thread](./create-thread.md), give them Moves per [Moves](./moves.md), and capture Notes per [Capture a note](./capture-note.md). Set a date with `Add a follow-up…` in the thread pane or `Attention date` in the `New note` dialog.

## Driving it with agent-browser

Preconditions:

- Signed in at 1440×900 with an empty D1. `bun run verify shot board-empty` shows `Nothing is asking for you.`
- Seed through the UI so every lane and tray group has an item. The date pickers list days as buttons named like `Today, Monday, September 28th, 2026`, and past days are allowed, which gives a late item:
  - A Thread with an Area, a long Focused Move, and a past follow-up lands in `Now` with the tint and `-3d`.
  - A Thread with a follow-up two to six days out lands in `This week`.
  - A Thread with a Move and no date lands in `No date` → `Ready to move`. One with no Moves lands in `Open`.
  - A Note with an `Attention date` lands in its dated lane with a margin rule and no tag. A Note without one lands in `No date` → `Notes`.

- **Lanes and tray.** Run `bun run verify open /`, `bun run verify browser -- wait --text "Ready to move"`, then `bun run verify shot board-desktop`. The snapshot has headings `Now <n> Late or due today`, `This week <n> The next six days`, `Later <n> Dated beyond this week`, `No date <n> Not on the calendar` (level 2), and the tray groups `Ready to move <n>`, `Open <n>`, `Notes <n>` (level 3).
- **Hover controls.** Run `bun run verify browser -- hover 'xpath=//a[normalize-space()="<title>"]'`, then `bun run verify shot board-hover`. The PNG shows the set-date and complete controls at the right of that card's footer.
- **Card actions.** Run `bun run verify browser -- snapshot -i -s 'aside'` to list the tray controls. Run `bun run verify browser -- find role button click --name "Complete “<move>”" --exact`. For a Note, run `find role button click --name "Set attention date" --exact`, click a day button, `press Escape`, then `find role button click --name "Mark note done" --exact`. Run `bun run verify browser -- reload`, then `bun run verify shot board-after-actions`. The Thread moves from `Ready to move` to `Open`, and the done Note leaves the board. Run `bun run verify d1 "SELECT title, moves_json FROM threads"` and `bun run verify d1 "SELECT body, state, attention_date FROM notes"`: the Thread's `moves_json` is null, and the Note has `state` `done` and the chosen `attention_date`.
- **Stacked.** Run `bun run verify browser -- set viewport 1024 768`, `reload`, and `screenshot --full <evidence dir>/board-1024.png`: two lanes per row, with the tray under `This week`. Run `set viewport 390 844`, `reload`, and `screenshot --full <evidence dir>/board-390.png`: one column, with `Later` and `No date` folded. Run `find role button click --name "No date"` and `wait --text "Ready to move"` to unfold the tray. Run `set viewport 1440 900` afterwards.

## Gotchas

- Card controls only show on hover or focus. They still exist in the accessibility snapshot, so `find role button` reaches them without a hover.
- A card whose footer has no date and no Area keeps an empty footer row at rest, which holds space for the hover controls.
- `Mark note done` with `--exact` matches the first note card on the board, not necessarily the one you just dated. Scope with XPath when several Notes are open.
- A full-page screenshot on a phone viewport draws the fixed dock over the middle of the page.
- Seeding Threads in a tight script loop can hang the agent-browser daemon (`Resource temporarily unavailable`). `bun run verify down` then `up` recovers, but `up` signs up a new throwaway user, so seed again.
