# Manage areas

A signed-in user adds, renames, reorders, and deletes areas from the `Manage areas` dialog. A new area shows up in the Dashboard's `Filter the board` row (or its `<n> more` menu when the row is full), followed, set apart, by the `Notes` filter and then the `Edit areas` button that opens the dialog.

Status: proven in #437 (9bbf928) by `areas.flow` at 1440×900, opening the dialog from `Edit areas`: create, rename, Health icon, keyboard reorder, and deletion keeping an unlabeled Thread.

## Sub-features

- `areas-open` opens `Manage areas` from the command palette, or from `Edit areas` at the end of the `Filter the board` row (also in its `<n> more` menu).
- `areas-add` adds an area by name.
- `areas-rename` saves its edited name on blur.
- `areas-icon` chooses an icon and shows it selected when the picker reopens.
- `areas-delete` removes the label from its Threads while keeping the Threads open.
- `areas-reorder` reorders areas by dragging a row's `Reorder <name>` handle with the mouse, or by keyboard (Space, arrows, Space; Escape cancels and keeps the dialog open).
- `areas-filter` shows the new area in `Filter the board`.
- `areas-persist` keeps the area after a reload.

## How to get to it (user POV)

- Open the command palette with `Meta+k`, then choose `Manage areas`.
- Click the `Edit areas` icon button at the end of the Dashboard's filter row, after `Notes`. It is there at every width.

## Driving it

Spec: `apps/e2e/tests/areas.spec.ts` at 1440×900, opening `Manage areas` from the command palette for create, rename, Health icon, and keyboard reorder, and from `Edit areas` in the filter row for deletion keeping an unlabeled Thread. It reloads to prove the rename, order and icon stuck, checks in D1 that the deleted Area's row is gone, and ends with a reload showing the surviving Thread without its Area.

A user with no areas still sees `All`, `Notes`, and `Edit areas` in the filter row, and gains `No area` with the first area. Only a spec file's first test can count on its user having no areas ([Users and test data](../SKILL.md#users-and-test-data)). Use `stamp` in area names.

- **Open.** `ControlOrMeta+k`, then `getByRole("option", { name: "Manage areas" })`; or `getByRole("button", { name: "Edit areas", exact: true })` at the end of the filter row. `dialog "Manage areas"` shows `textbox "New area name"` and `button "Add"`.
- **Add.** `page.getByLabel("New area name").fill(name)`, then click `Add` (`exact: true`). The dialog gains `textbox "Name of <name>"`.
- **Filter row.** After `Escape`, `getByRole("navigation", { name: "Filter the board" })` lists the new area, then the `Notes` link and the `Edit areas` button.
- **Drag to reorder.** Take the handle's `boundingBox()` (`page.getByLabel("Reorder Work")`) and aim at its centre. `page.mouse.move(x, y)`, `page.mouse.down()`, then `page.mouse.move(x, targetY, { steps: 10 })` in two steps past the target row, then `page.mouse.up()`. The dialog lists the rows in the new order.
- **Keyboard reorder.** `page.getByLabel("Reorder Health").focus()`, then press `Space`, `ArrowUp`, `Space`. To cancel, press `Escape` instead of the second `Space`: the row returns and the dialog stays open.
- **Persist.** `page.reload()`, reopen Manage areas from the palette, and expect `getByRole("textbox", { name: `Name of ${name}` })`. `shot("areas-after")`.

## Gotchas

- The user menu no longer has a `Manage areas` item.
- The order lives in `areas.sort_order`: `SELECT name FROM areas WHERE user_id = '${account.id}' ORDER BY sort_order`.
- Base UI's dialog stops arrow keys and Escape from bubbling, so a held row's handle forwards its keys to dnd-kit. If keyboard reordering stops working, check that first.
- On a phone (390×844) the dialog is a Vaul drawer. A downward drag on a handle moves the row, not the drawer. Real touch input was not emulated, only the mouse.
- Match `Edit areas` with `exact: true`: the `<n> more` menu holds a menuitem of the same name.
