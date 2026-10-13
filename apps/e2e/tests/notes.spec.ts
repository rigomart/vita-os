import type { Page } from "@playwright/test";

import type { Account, D1 } from "../src/fixtures.ts";

import {
  captureNote,
  notesCount,
  notesFilter,
  noteView,
  openNote,
} from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

async function replaceBody(page: Page, text: string) {
  const body = noteView(page).getByRole("textbox", { name: "Note body" });
  await body.fill(text);
  await expect(body).toHaveText(text);
}

const notesWith = (d1: D1, account: Account, stamp: string) =>
  d1<{ body: string; state: string }>(
    `SELECT body, state FROM notes WHERE user_id = '${account.id}' AND body LIKE '%${stamp}%'`,
  );

test("a captured Note keeps its Markdown source and edits in place", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const typed = `**Verify Note ${stamp}**`;
  const edited = `Verify Edited ${stamp}`;

  await page.goto("/");
  await page.getByRole("button", { name: "New note", exact: true }).click();
  const body = noteView(page).getByRole("textbox", { name: "Note body" });
  await expect(body).toBeVisible();
  await replaceBody(page, typed);
  // Live preview: the bold renders in the editor itself.
  await expect(
    body
      .locator(".cm-atomic-strong")
      .filter({ hasText: `Verify Note ${stamp}` }),
  ).toBeVisible();
  await shot("notes-compose-before");
  await sent(page, /\/notes$/, () =>
    noteView(page).getByRole("button", { name: "Add", exact: true }).click(),
  );
  await expect(page.getByText("Note added")).toBeVisible();
  expect(await notesWith(d1, account, stamp)).toEqual([
    { body: typed, state: "open" },
  ]);
  await page.reload();
  await expect(openNote(page, `Verify Note ${stamp}`)).toBeVisible();
  await shot("notes-captured-after");

  // A saved Note opens rendered: no Read/Write tabs, no caret.
  await openNote(page, `Verify Note ${stamp}`).click();
  await expect(body).toBeVisible();
  await expect(noteView(page).getByRole("tab")).toHaveCount(0);
  await expect(body).not.toBeFocused();
  await shot("notes-saved-open");
  await replaceBody(page, `**${edited}**`);
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Discard unsaved changes?")).toBeVisible();
  await shot("notes-discard-before");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(noteView(page).getByText(edited)).toBeVisible();
  await shot("notes-unsaved");
  await sent(page, /\/body$/, () =>
    noteView(page).getByRole("button", { name: "Save", exact: true }).click(),
  );
  await expect(page.getByText("Note saved")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(noteView(page)).toBeHidden();

  await page.reload();
  await expect(openNote(page, edited)).toBeVisible();
  expect(await notesWith(d1, account, stamp)).toEqual([
    { body: `**${edited}**`, state: "open" },
  ]);
  await shot("notes-edited-after");
});

test("Delete hides the card, Undo keeps the Note, and a lapsed offer deletes the row", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const text = `Verify Delete ${stamp}`;
  const deletes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "DELETE") deletes.push(new URL(r.url()).pathname);
  });

  // Lets the five-second Undo offer lapse without a sleep.
  await page.clock.install();
  await page.goto("/");
  await captureNote(page, `**${text}**`);
  await page.reload();

  await openNote(page, text).click();
  await noteView(page).getByRole("button", { name: "More actions" }).click();
  await shot("notes-delete-before");
  await page
    .getByRole("menuitem", { name: "Delete note", exact: true })
    .click();
  const toast = page.getByRole("listitem").filter({ hasText: "Note deleted" });
  await expect(toast).toBeVisible();
  await expect(noteView(page)).toBeHidden();
  await expect(openNote(page, text)).toBeHidden();
  await toast.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(openNote(page, text)).toBeVisible();
  await expect(page.getByText("Note deleted")).toBeHidden();
  await page.clock.fastForward(6_000);
  expect(deletes).toEqual([]);
  await page.reload();
  await expect(openNote(page, text)).toBeVisible();
  expect(await notesWith(d1, account, stamp)).toEqual([
    { body: `**${text}**`, state: "open" },
  ]);
  await shot("notes-delete-undone-after");

  const notes = await notesCount(page);
  await openNote(page, text).click();
  await noteView(page).getByRole("button", { name: "More actions" }).click();
  await sent(page, /\/notes\/[^/]+$/, async () => {
    await page
      .getByRole("menuitem", { name: "Delete note", exact: true })
      .click();
    await expect(page.getByText("Note deleted")).toBeVisible();
    await page.clock.fastForward(6_000);
  });
  expect(await notesWith(d1, account, stamp)).toEqual([]);
  await page.reload();
  await expect(notesFilter(page, notes - 1)).toBeVisible();
  await expect(openNote(page, text)).toHaveCount(0);
  await shot("notes-deleted-after");
});
