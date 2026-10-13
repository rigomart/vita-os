import type { Page } from "@playwright/test";

import {
  closeThread,
  createThread,
  openHistory,
  reopenThread,
  resolveThread,
} from "../src/app.ts";
import { expect, settled, test } from "../src/fixtures.ts";

async function createResolved(
  page: Page,
  title: string,
  before?: () => Promise<unknown>,
) {
  await resolveThread(await createThread(page, title), before);
}

async function goneFromHistory(page: Page, title: string) {
  const palette = await openHistory(page);
  await palette.getByRole("combobox").fill(title);
  await expect(palette.getByText("No results found.")).toBeVisible();
  await expect(palette.getByRole("option", { name: title })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
}

test("History starts empty, then lists resolved Threads newest first and searches them by title", async ({
  page,
  stamp,
  shot,
}) => {
  const older = `History older ${stamp}`;
  const newer = `History newer ${stamp}`;

  await page.goto("/");
  let palette = await openHistory(page);
  await expect(
    palette.getByText("No resolved threads or archived notes yet."),
  ).toBeVisible();
  await shot("history-empty");
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();

  await createResolved(page, older, () => shot("history-resolve-before"));
  await createResolved(page, newer);

  await page.reload();
  await expect(page.getByRole("banner", { name: "Vita OS" })).toBeVisible();
  palette = await openHistory(page);
  const resolved = palette
    .getByRole("group", { name: "Resolved threads" })
    .getByRole("option");
  await expect(resolved).toHaveText([newer, older]);
  await shot("history-list");

  const search = palette.getByRole("combobox");
  await search.fill(`older ${stamp}`);
  await expect(resolved).toHaveText([older]);
  await shot("history-search");
  await search.fill(`unmatched ${stamp}`);
  await expect(palette.getByText("No results found.")).toBeVisible();
  await expect(resolved).toHaveCount(0);

  const chip = palette.getByRole("button", { name: "History", exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await expect(search).toHaveValue("");
  await expect(
    palette.getByRole("group", { name: "Resolved threads" }),
  ).toHaveCount(0);
  await shot("history-open-work");
});

test("a Thread chosen from History reopens in the side pane", async ({
  page,
  stamp,
  shot,
}) => {
  const title = `History pane ${stamp}`;

  await page.goto("/");
  await createResolved(page, title);
  await page.reload();
  const palette = await openHistory(page);
  await palette.getByRole("option", { name: title, exact: true }).click();
  const pane = page.getByRole("complementary", { name: title });
  await expect(pane.getByText("while resolved")).toBeVisible();
  await expect(pane.getByRole("textbox", { name: "Add a task" })).toHaveCount(
    0,
  );
  await shot("history-pane");

  await reopenThread(pane);
  // Only an open Thread offers "Add a task".
  await page.reload();
  await expect(pane.getByRole("textbox", { name: "Add a task" })).toBeVisible();
  await shot("history-reopened-pane");
  await closeThread(pane);
  await goneFromHistory(page, title);
});

test("a Thread chosen from History reopens in the drawer", async ({
  page,
  stamp,
  shot,
}) => {
  const title = `History drawer ${stamp}`;

  await page.goto("/");
  await createResolved(page, title);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  const palette = await openHistory(page);
  await palette.getByRole("combobox").fill(title);
  await palette.getByRole("option", { name: title, exact: true }).click();
  const drawer = page.getByRole("dialog", { name: title });
  await expect(drawer.getByText("while resolved")).toBeVisible();
  await expect(drawer.getByRole("textbox", { name: "Add a task" })).toHaveCount(
    0,
  );
  await settled(drawer);
  await shot("history-drawer");

  await reopenThread(drawer);
  // Only an open Thread offers "Add a task".
  await page.reload();
  await expect(
    drawer.getByRole("textbox", { name: "Add a task" }),
  ).toBeVisible();
  await shot("history-reopened-drawer");
  await closeThread(drawer);
  await goneFromHistory(page, title);
});
