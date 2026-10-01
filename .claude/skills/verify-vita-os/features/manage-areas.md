# Manage areas

A signed-in user adds, renames, reorders, and deletes areas from the `Manage areas` dialog. A new area shows up in the Dashboard's `Filter by area` row, which ends with the button that opens the dialog.

Status: proven on 6ee2543 (with the Manage areas button moved to the filter row).

## Sub-features

- `areas-open` opens `Manage areas` from the command palette, or from the button at the end of the `Filter by area` row once one area exists.
- `areas-add` adds an area by name.
- `areas-filter` shows the new area in `Filter by area`.
- `areas-persist` keeps the area after a reload and in D1 (`areas`).

## How to get to it (user POV)

- Open the command palette with `Meta+k`, then choose `Manage areas`.
- With at least one area, click the `Manage areas` icon button at the end of the Dashboard's area filter row. On a phone it sits beside the `Filter by area: <option>` dropdown.

## Driving it with agent-browser

Preconditions:

- Signed in on the Dashboard. The throwaway user starts with no areas, so the filter row and its button are hidden until the first area exists.
- Pick a unique name, for example `Verify area 1727461234`.

- **Open from the palette.** Run `bun run verify browser -- press Meta+k`, then `bun run verify browser -- find role option click --name "Manage areas"`. A dialog titled `Manage areas` shows an input `New area name` and an `Add` button.
- **Add.** Run `bun run verify browser -- find label "New area name" fill "Verify area 1727461234"`, then `bun run verify browser -- find role button click --name "Add" --exact`. The dialog gains a `Name of Verify area 1727461234` textbox.
- **Filter row.** Close the dialog with `bun run verify browser -- press Escape`. The `Filter by area` navigation lists the new area, followed by a `Manage areas` button.
- **Open from the filter row.** Run `bun run verify browser -- find role button click --name "Manage areas" --exact`. The same dialog opens.
- **Persist.** Run `bun run verify browser -- reload`, then `bun run verify d1 "SELECT name FROM areas"`.
- **Proof.** `bun run verify shot areas-after` after the reload.

## Gotchas

- The user menu no longer has a `Manage areas` item.
- `find role button click --name "Manage areas"` needs `--exact` once the dialog is open, or it can match other buttons.
