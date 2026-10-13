// Undated Notes only; dated conversion is in dated-tasks.spec.ts.
import type { Page } from "@playwright/test";

import type { Account, D1 } from "../src/fixtures.ts";

import {
  captureNote,
  closeThread,
  createThread,
  noteView,
  openNote,
  threadId,
} from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

async function openNoteActions(page: Page, body: string) {
  await openNote(page, body).click();
  await noteView(page)
    .getByRole("button", { name: "More actions", exact: true })
    .click();
}

async function stored(d1: D1, account: Account, title: string, body: string) {
  return {
    standalone: await d1<{ n: number }>(
      `SELECT COUNT(*) AS n FROM notes WHERE user_id = '${account.id}' AND body = '${body}'`,
    ),
    threadNotes: await d1<{ body: string; state: string }>(
      `SELECT body, state FROM thread_notes WHERE user_id = '${account.id}' AND thread_id IN (${threadId(account, title)})`,
    ),
    log: await d1<{ n: number }>(
      `SELECT COUNT(*) AS n FROM activity_log_entries WHERE user_id = '${account.id}' AND thread_id IN (${threadId(account, title)})`,
    ),
  };
}

test("Add to thread… commits when the Undo offer lapses", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Add target ${stamp}`;
  const body = `Added Note ${stamp}`;

  await page.goto("/");
  const pane = await createThread(page, title);
  await closeThread(pane);

  await captureNote(page, body);
  await page.reload();
  await openNoteActions(page, body);
  await shot("add-commit-before-menu");
  await page
    .getByRole("menuitem", { name: "Add to thread…", exact: true })
    .click();
  const target = page.getByRole("option", { name: title, exact: true });
  await expect(target).toBeVisible();
  await shot("add-commit-before-picker");

  // The add waits out the Undo offer before it reaches the service.
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await sent(page, /\/notes\/[^/]+\/add-to-thread$/, async () => {
    await target.click();
    await expect(page.getByText("Note added to thread")).toBeVisible();
    await expect(undo).toBeVisible();
  });
  await expect(undo).toBeHidden();

  await page.reload();
  const threadLink = page.getByRole("link", { name: title, exact: true });
  await expect(threadLink).toBeVisible();
  await expect(page.getByText(body)).toBeHidden();
  await threadLink.click();
  await expect(pane.getByText(body)).toBeVisible();
  // A Thread Note, not a Task.
  await expect(pane.getByRole("list", { name: "Tasks" })).toBeHidden();
  await expect(
    pane.getByRole("button", { name: "Complete task", exact: true }),
  ).toHaveCount(0);
  expect(await stored(d1, account, title, body)).toEqual({
    standalone: [{ n: 0 }],
    threadNotes: [{ body, state: "open" }],
    log: [{ n: 0 }],
  });
  await shot("add-commit-after");
});

test("New thread from note suggests the first line as the title and keeps the body", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const body = `New from Note ${stamp}`;

  await page.goto("/");
  await captureNote(page, body);
  await page.reload();
  await openNoteActions(page, body);
  await shot("new-thread-from-note-before");
  await page
    .getByRole("menuitem", { name: "New thread from note", exact: true })
    .click();
  await expect(page.getByLabel("Thread title")).toHaveValue(body);
  await sent(page, /\/notes\/[^/]+\/new-thread$/, () =>
    page.getByRole("button", { name: "Create", exact: true }).click(),
  );
  await expect(page.getByText("Thread created")).toBeVisible();

  await page.reload();
  const pane = page.getByRole("complementary", { name: body });
  await expect(pane).toBeVisible();
  await expect(openNote(pane, body)).toBeVisible();
  await expect(pane.getByRole("list", { name: "Tasks" })).toBeHidden();
  await expect(
    pane.getByRole("button", { name: "Complete task", exact: true }),
  ).toHaveCount(0);
  expect(await stored(d1, account, body, body)).toEqual({
    standalone: [{ n: 0 }],
    threadNotes: [{ body, state: "open" }],
    log: [{ n: 0 }],
  });
  await shot("new-thread-from-note-after");
});
