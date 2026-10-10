# Manage areas

A signed-in user adds, renames, reorders, and deletes areas from the `Manage areas` dialog. A new area shows up in the Dashboard's `Filter the board` row (or its `<n> more` menu when the row is full), followed, set apart, by the `Notes` filter and then the `Edit areas` button that opens the dialog.

Status: `areas.flow` re-driven on the ADR 0037 working tree (base c5dc437), opening the dialog from `Edit areas`. Earlier: proven on 6ee2543 (with the Manage areas button moved to the filter row). Re-driven on b2bd91a with `areas.flow`: create, rename, Health icon, keyboard reorder, and deletion preserving an unlabeled Thread at 1440×900. Evidence: `.verify/evidence/areas426/2026-10-07T06-04-43-000Z/`.

## Sub-features

- `areas-open` opens `Manage areas` from the command palette, or from `Edit areas` at the end of the `Filter the board` row (also in its `<n> more` menu).
- `areas-add` adds an area by name.
- `areas-rename` saves its edited name on blur.
- `areas-icon` chooses an icon and shows it selected when the picker reopens.
- `areas-delete` removes the label from its Threads while keeping the Threads open.
- `areas-reorder` reorders areas by dragging a row's `Reorder <name>` handle with the mouse, or by keyboard (Space, arrows, Space; Escape cancels and keeps the dialog open).
- `areas-filter` shows the new area in `Filter the board`.
- `areas-persist` keeps the area after a reload and in D1 (`areas`).

## How to get to it (user POV)

- Open the command palette with `Meta+k`, then choose `Manage areas`.
- Click the `Edit areas` icon button at the end of the Dashboard's filter row, after `Notes`. It is there at every width.

## Driving it with agent-browser

Repeatable flow: `bun run verify run .claude/skills/verify-vita-os/flows/areas.flow`. Start with a fresh signed-in instance. It checks each write in D1 and ends with a reload showing the surviving Thread without its deleted Area.

Preconditions:

- Signed in on the Dashboard. The throwaway user starts with no areas; the filter row still shows `All`, `Notes`, and `Edit areas`, and gains `No area` with the first area.
- Pick a unique name, for example `Verify area 1727461234`.

- **Open from the palette.** Run `bun run verify browser -- press Meta+k`, then `bun run verify browser -- find role option click --name "Manage areas"`. A dialog titled `Manage areas` shows an input `New area name` and an `Add` button.
- **Add.** Run `bun run verify browser -- find label "New area name" fill "Verify area 1727461234"`, then `bun run verify browser -- find role button click --name "Add" --exact`. The dialog gains a `Name of Verify area 1727461234` textbox.
- **Filter row.** Close the dialog with `bun run verify browser -- press Escape`. The `Filter the board` navigation lists the new area, followed by the `Notes` link and the `Edit areas` button.
- **Open from the filter row.** Run `bun run verify browser -- find role button click --name "Edit areas" --exact`. The same dialog opens.
- **Drag to reorder.** Find a handle with `bun run verify browser -- get box '[aria-label="Reorder Work"]'` and aim at its centre (x + 16, y + 16). Run `mouse move <x> <y>`, `mouse down`, then `mouse move <x> <target y> --steps 10` in two steps past the target row, then `mouse up`. The dialog lists the rows in the new order.
- **Keyboard reorder.** Run `bun run verify browser -- focus '[aria-label="Reorder Health"]'`, then `press Space`, `press ArrowUp`, `press Space`. To cancel, press `Escape` instead of the second `Space`: the row returns and the dialog stays open.
- **Persist.** Run `bun run verify browser -- reload`, then `bun run verify d1 "SELECT name FROM areas"`.
- **Proof.** `bun run verify shot areas-after` after the reload.

## Gotchas

- The user menu no longer has a `Manage areas` item.
- The order lives in `areas.sort_order`: `bun run verify d1 "SELECT name FROM areas ORDER BY sort_order"`.
- Base UI's dialog stops arrow keys and Escape from bubbling, so a held row's handle forwards its keys to dnd-kit. If keyboard reordering stops working, check that first.
- On a phone (390×844) the dialog is a Vaul drawer. A downward drag on a handle moves the row, not the drawer. Real touch input was not emulated, only the mouse.
- `find role button click --name "Edit areas"` needs `--exact`: the `<n> more` menu holds a menuitem of the same name.
