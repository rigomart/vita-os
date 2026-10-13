import type { Page } from "@playwright/test";

import type { Account, D1 } from "../src/fixtures.ts";

import { createThread, noteView, openNote } from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

async function threadWithNote(page: Page, title: string, body: string) {
  await page.goto("/");
  const pane = await createThread(page, title);
  await pane
    .getByRole("button", { name: "Write a note…", exact: true })
    .click();
  await noteView(page).getByRole("textbox", { name: "Note body" }).fill(body);
  return pane;
}

const notesOf = (d1: D1, account: Account, title: string) =>
  d1<{ body: string; state: string }>(
    `SELECT n.body, n.state FROM thread_notes n JOIN threads t ON t.id = n.thread_id WHERE t.user_id = '${account.id}' AND t.title = '${title}'`,
  );

test("a Thread Note is captured and edited in place", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Thread Notes ${stamp}`;
  const original = `Original Thread Note ${stamp}`;
  const edited = `Edited Thread Note ${stamp}`;

  const pane = await threadWithNote(page, title, original);
  await shot("thread-note-create-before");
  await sent(page, /\/notes$/, () =>
    noteView(page).getByRole("button", { name: "Add", exact: true }).click(),
  );
  await expect(page.getByText("Note added")).toBeVisible();
  await page.reload();
  await expect(openNote(pane, original)).toBeVisible();
  expect(await notesOf(d1, account, title)).toEqual([
    { body: original, state: "open" },
  ]);
  await shot("thread-note-created");

  await openNote(pane, original).click();
  const body = noteView(page).getByRole("textbox", { name: "Note body" });
  await body.fill(edited);
  await expect(body).toHaveText(edited);
  await expect(noteView(page).getByText("Unsaved changes")).toBeVisible();
  await shot("thread-note-edit-before");
  await sent(page, /\/body$/, () =>
    noteView(page).getByRole("button", { name: "Save", exact: true }).click(),
  );
  await expect(page.getByText("Note saved")).toBeVisible();
  await noteView(page)
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(noteView(page)).toBeHidden();
  await page.reload();
  await expect(openNote(pane, edited)).toBeVisible();
  expect(await notesOf(d1, account, title)).toEqual([
    { body: edited, state: "open" },
  ]);
  await shot("thread-note-edited");
});

test("Archive moves a Thread Note under Archived notes and Unarchive brings it back", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Thread Notes ${stamp}`;
  const text = `Archived Thread Note ${stamp}`;

  const pane = await threadWithNote(page, title, text);
  await sent(page, /\/notes$/, () =>
    noteView(page).getByRole("button", { name: "Add", exact: true }).click(),
  );
  await expect(page.getByText("Note added")).toBeVisible();
  await page.reload();

  await openNote(pane, text).click();
  await shot("thread-note-archive-before");
  await sent(page, /\/state$/, () =>
    noteView(page)
      .getByRole("button", { name: "Archive", exact: true })
      .click(),
  );
  await expect(page.getByText("Note archived")).toBeVisible();
  await noteView(page)
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.reload();
  const archived = pane.getByRole("button", {
    name: "Archived notes 1",
    exact: true,
  });
  await expect(archived).toBeVisible();
  expect(await notesOf(d1, account, title)).toEqual([
    { body: text, state: "done" },
  ]);
  await archived.click();
  await expect(pane.getByText(text)).toBeVisible();
  await shot("thread-note-archived");

  await shot("thread-note-unarchive-before");
  await sent(page, /\/state$/, () =>
    pane.getByRole("button", { name: "Unarchive note", exact: true }).click(),
  );
  await expect(page.getByText("Note unarchived")).toBeVisible();
  await page.reload();
  await expect(openNote(pane, text)).toBeVisible();
  await expect(pane.getByText("Archived notes")).toHaveCount(0);
  expect(await notesOf(d1, account, title)).toEqual([
    { body: text, state: "open" },
  ]);
  await shot("thread-note-unarchived");
});

test("a deleted Thread Note is gone from D1 once the Undo offer lapses", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Thread Notes ${stamp}`;
  const text = `Deleted Thread Note ${stamp}`;

  const pane = await threadWithNote(page, title, text);
  await sent(page, /\/notes$/, () =>
    noteView(page).getByRole("button", { name: "Add", exact: true }).click(),
  );
  await expect(page.getByText("Note added")).toBeVisible();
  await page.reload();

  await openNote(pane, text).click();
  await noteView(page).getByRole("button", { name: "More actions" }).click();
  await shot("thread-note-delete-before");
  // Sent when the five-second Undo offer closes; reloading earlier would cancel it.
  await sent(page, /\/thread-notes\/[^/]+$/, async () => {
    await page
      .getByRole("menuitem", { name: "Delete note", exact: true })
      .click();
    await expect(page.getByText("Note deleted")).toBeVisible();
  });
  await expect(page.getByRole("button", { name: "Undo" })).toBeHidden();
  await page.reload();
  await expect(
    pane.getByRole("region", { name: "Thread Notes" }),
  ).toBeVisible();
  await expect(pane.getByText(text)).toHaveCount(0);
  expect(await notesOf(d1, account, title)).toEqual([]);
  await shot("thread-note-deleted");
});
