// #437.
import type { Page } from "@playwright/test";

import { closeThread, createThread, openPalette } from "../src/app.ts";
import { expect, sent, settled, test } from "../src/fixtures.ts";

async function openManageAreas(page: Page) {
  const palette = await openPalette(page);
  await palette
    .getByRole("option", { name: "Manage areas", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Manage areas" });
  await expect(dialog.getByLabel("New area name")).toBeVisible();
  await settled(dialog);
  return dialog;
}

test("create, rename, change the icon of and reorder Areas; all of it survives a reload", async ({
  page,
  stamp,
  shot,
}) => {
  const first = `Area first ${stamp}`;
  const second = `Area second ${stamp}`;
  const renamed = `Area renamed ${stamp}`;

  await page.goto("/");
  let dialog = await openManageAreas(page);
  await shot("areas-before");

  for (const name of [first, second]) {
    await dialog.getByLabel("New area name").fill(name);
    await sent(page, /\/v1\/areas$/, () =>
      dialog.getByRole("button", { name: "Add", exact: true }).click(),
    );
    await expect(dialog.getByLabel(`Name of ${name}`)).toBeVisible();
  }

  await dialog.getByLabel(`Name of ${first}`).fill(renamed);
  await sent(page, /\/v1\/areas\/[^/]+$/, () => page.keyboard.press("Tab"));
  await expect(dialog.getByLabel(`Name of ${renamed}`)).toBeVisible();

  const changeIcon = dialog.getByRole("button", {
    name: `Change icon for ${renamed}`,
    exact: true,
  });
  const health = page.getByRole("button", { name: "Health", exact: true });
  await changeIcon.click();
  await sent(page, /\/v1\/areas\/[^/]+$/, () => health.click());
  await expect(health).toBeHidden();
  await changeIcon.click();
  await expect(health).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(health).toBeHidden();
  await expect(dialog).toBeVisible();

  const order = `
    - list "Areas":
      - listitem:
        - textbox "Name of ${second}"
      - listitem:
        - textbox "Name of ${renamed}"
  `;
  const handle = dialog.getByRole("button", {
    name: `Reorder ${second}`,
    exact: true,
  });
  await handle.focus();
  // dnd-kit drops an ArrowUp pressed before it has measured the rows, so retry until the move is announced
  // (another ArrowUp at the top is a no-op).
  await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await expect(async () => {
    await page.keyboard.press("ArrowUp");
    await expect(page.getByText(`${second} moved to position 1.`)).toBeAttached(
      { timeout: 500 },
    );
  }).toPass({ timeout: 10_000 });
  await sent(page, /\/v1\/areas\/order$/, () => page.keyboard.press("Space"));
  await expect(
    page.getByText(`${second} dropped at position 1.`),
  ).toBeAttached();
  await expect(dialog).toMatchAriaSnapshot(order);
  await shot("areas-reordered");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.reload();
  const filter = page.getByRole("navigation", { name: "Filter the board" });
  await expect(filter).toBeVisible();
  await expect(
    filter.getByRole("link", { name: `${renamed} 0`, exact: true }),
  ).toBeVisible();
  dialog = await openManageAreas(page);
  await expect(dialog.getByLabel(`Name of ${renamed}`)).toBeVisible();
  await expect(dialog).toMatchAriaSnapshot(order);
  await changeIcon.click();
  await expect(health).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(health).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(filter).toBeVisible();
});

test("deleting an Area keeps its Thread open without the label", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const area = `Area doomed ${stamp}`;
  const title = `Area survives ${stamp}`;

  await page.goto("/");
  const dialog = await openManageAreas(page);
  await dialog.getByLabel("New area name").fill(area);
  await sent(page, /\/v1\/areas$/, () =>
    dialog.getByRole("button", { name: "Add", exact: true }).click(),
  );
  await expect(dialog.getByLabel(`Name of ${area}`)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  const pane = await createThread(page, title, { area });
  const label = pane.getByRole("button", {
    name: `Area: ${area}`,
    exact: true,
  });
  await expect(label).toBeVisible();
  await page.reload();
  await expect(label).toBeVisible();
  await closeThread(pane);

  await page.getByRole("button", { name: "Edit areas", exact: true }).click();
  await settled(dialog);
  await dialog
    .getByRole("button", { name: `Delete ${area}`, exact: true })
    .click();
  const confirm = page.getByRole("alertdialog", { name: `Delete “${area}”?` });
  await expect(
    confirm.getByText("1 open Thread will lose this label."),
  ).toBeVisible();
  await shot("areas-delete-before");
  const areaCount = `SELECT COUNT(*) AS n FROM areas WHERE user_id = '${account.id}' AND name = '${area}'`;
  expect(await d1(areaCount)).toEqual([{ n: 1 }]);
  await sent(page, /\/v1\/areas\/[^/]+$/, () =>
    confirm.getByRole("button", { name: "Delete area", exact: true }).click(),
  );
  await expect(page.getByText("Area deleted")).toBeVisible();
  await expect(confirm).toBeHidden();
  expect(await d1(areaCount)).toEqual([{ n: 0 }]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.reload();
  const thread = page.getByRole("link", { name: title, exact: true });
  await expect(thread).toBeVisible();
  await expect(page.getByText(area)).toBeHidden();
  await thread.click();
  await expect(
    pane.getByRole("button", { name: "Add area", exact: true }),
  ).toBeVisible();
  await expect(label).toBeHidden();
  await shot("areas-after");
});
