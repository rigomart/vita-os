# Manage areas

A signed-in user adds, renames, reorders, and deletes areas from the `Manage areas` dialog. A new area shows up in the Dashboard's `Filter by area` row.

Status: mapped from source, not yet driven.

## Sub-features

- `areas-open` opens `Manage areas` from the user menu or the command palette.
- `areas-add` adds an area by name.
- `areas-filter` shows the new area in `Filter by area`.
- `areas-persist` keeps the area after a reload and in D1 (`areas`).

## How to get to it (user POV)

- Open the user menu (the button labelled with the user's name, `Verify Bot` for the throwaway user) and choose `Manage areas`.
- Open the command palette with `Meta+k`, then choose `Manage areas` under `Create`.

## Driving it with agent-browser

Preconditions:

- Signed in on the Dashboard.
- Pick a unique name, for example `Verify area 1727461234`.

- **Open dialog.** Run `bun run verify browser -- find role button click --name "Verify Bot" --exact`, then `bun run verify browser -- find role menuitem click --name "Manage areas"`. A dialog titled `Manage areas` shows an input `New area name` and an `Add` button.
- **Add.** Run `bun run verify browser -- find label "New area name" fill "Verify area 1727461234"`, then `bun run verify browser -- find role button click --name "Add" --exact`. The list `ul[aria-label="Areas"]` gains a row for the new area.
- **Filter row.** Close the dialog with `bun run verify browser -- press Escape`. The `Filter by area` navigation lists the new area.
- **Persist.** Run `bun run verify browser -- reload`, then `bun run verify d1 "SELECT name FROM areas"`.
- **Proof.** `bun run verify shot areas-after` after the reload.

## Gotchas

- Not yet driven. Verify each handle against a fresh `snapshot -i` and update this file and its `Status` line when it is proven.
- The user-menu item role (`menuitem`) and the `name` column come from source and may differ.
