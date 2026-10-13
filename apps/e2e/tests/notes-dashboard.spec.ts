import type { Page } from "@playwright/test";

import { captureNote, noteCard, openHistory, openNote } from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

async function archiveCard(page: Page, body: string) {
  await sent(page, /\/notes\/[^/]+\/state$/, () =>
    noteCard(page, body)
      .getByRole("button", { name: "Archive note", exact: true })
      .click(),
  );
  await expect(openNote(page, body)).toBeHidden();
}

const onNotesFilter = (url: URL) =>
  url.pathname === "/" && url.search === "?show=notes";

test("the Notes filter counts open Notes; Archive from the card and from the Note view empties it", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const board = `Board note ${stamp} needlealpha`;
  const kept = `History note ${stamp} needlebeta`;

  await page.goto("/");
  await captureNote(page, board);
  await captureNote(page, kept);
  await page.reload();
  await expect(openNote(page, board)).toBeVisible();
  await expect(openNote(page, kept)).toBeVisible();
  await page.getByRole("link", { name: "Notes 2", exact: true }).click();
  await expect(page).toHaveURL(onNotesFilter);
  await shot("notes-dashboard-before");

  await archiveCard(page, board);
  await expect(page.getByText("Note archived")).toBeVisible();
  await page.reload();
  await expect(openNote(page, kept)).toBeVisible();
  await expect(openNote(page, board)).toBeHidden();
  await page.getByRole("link", { name: "Notes 1", exact: true }).click();
  await expect(page).toHaveURL(onNotesFilter);
  await shot("notes-board-archived-after");

  await openNote(page, kept).click();
  const view = page.getByRole("dialog");
  await expect(view.getByRole("textbox", { name: "Note body" })).toBeVisible();
  await expect(page).toHaveURL(onNotesFilter);
  await shot("notes-view-archive-before");
  await sent(page, /\/notes\/[^/]+\/state$/, () =>
    view.getByRole("button", { name: "Archive", exact: true }).click(),
  );
  await expect(page.getByText("Note archived")).toBeVisible();
  await expect(
    view.getByRole("button", { name: "Unarchive", exact: true }),
  ).toBeVisible();
  // D1, since the board can't tell archived from deleted.
  expect(
    await d1(
      `SELECT body, state, completed_at IS NOT NULL AS has_completed_at FROM notes WHERE user_id = '${account.id}' ORDER BY body`,
    ),
  ).toEqual([
    { body: board, state: "done", has_completed_at: 1 },
    { body: kept, state: "done", has_completed_at: 1 },
  ]);
  await shot("notes-view-archived-after");
  await page.keyboard.press("Escape");
  await expect(view).toBeHidden();
  await page.reload();
  await expect(page.getByText("No Note is asking for you.")).toBeVisible();
});

test("History finds an Archived Note by body and Unarchive puts it back on the board", async ({
  page,
  stamp,
  shot,
}) => {
  // The searched word is unique to this test, so Notes another test archived never match.
  const board = `Board note ${stamp} needlealpha${stamp}`;
  const other = `History note ${stamp} needlebeta${stamp}`;

  await page.goto("/?show=notes");
  await captureNote(page, board);
  await captureNote(page, other);
  await archiveCard(page, board);
  await archiveCard(page, other);

  const palette = await openHistory(page);
  await palette.getByRole("combobox").fill(`needlealpha${stamp}`);
  const match = palette.getByRole("option", { name: new RegExp(board) });
  await expect(match).toBeVisible();
  await expect(
    palette.getByRole("option", { name: new RegExp(`needlebeta${stamp}`) }),
  ).toHaveCount(0);
  await shot("notes-history-search-after");

  await match.click();
  const view = page.getByRole("dialog");
  const unarchive = view.getByRole("button", {
    name: "Unarchive",
    exact: true,
  });
  await expect(unarchive).toBeVisible();
  await shot("notes-history-open-before");
  await sent(page, /\/notes\/[^/]+\/state$/, () => unarchive.click());
  await expect(page.getByText("Note unarchived")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(view).toBeHidden();

  await page.reload();
  await expect(openNote(page, board)).toBeVisible();
  await expect(page).toHaveURL(onNotesFilter);
  await expect(openNote(page, other)).toBeHidden();
  await shot("notes-unarchived-after");
});
