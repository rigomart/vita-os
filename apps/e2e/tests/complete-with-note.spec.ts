// ADR 0032, #405.
import type { Account, D1 } from "../src/fixtures.ts";

import {
  addTask,
  closeDatePicker,
  closeThread,
  createThread,
  datePicker,
  dateToken,
  logOf,
  quickPick,
  setRepeat,
  taskRow,
  threadId,
} from "../src/app.ts";
import { expect, sent, settled, test } from "../src/fixtures.ts";

const notesOf = (d1: D1, account: Account, title: string) =>
  d1<{ n: number }>(
    `SELECT COUNT(*) AS n FROM thread_notes WHERE thread_id IN (${threadId(account, title)})`,
  );

test("a plain Task completed with a note in the side pane is removed", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Note P ${stamp}`;
  const task = `P1 ${stamp}`;
  const note = `Picked up at the counter ${stamp}`;

  await page.goto("/");
  const pane = await createThread(page, title);
  await addTask(pane, task);

  await taskRow(pane, task)
    .getByRole("button", { name: "Complete with a note" })
    .click();
  const noteLine = pane.getByRole("group", {
    name: `Complete “${task}” with a note`,
  });
  const field = noteLine.getByRole("textbox", { name: "Note" });
  await expect(field).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await field.fill(note);
  await shot("note-line-pane");
  await sent(page, /\/complete$/, () => field.press("Enter"));
  await expect(noteLine).toBeHidden();
  await expect(pane.getByRole("list", { name: "Tasks" })).toBeHidden();
  await expect(pane.getByText(note)).toBeVisible();
  await shot("note-completed-pane");

  await page.reload();
  await expect(pane.getByRole("textbox", { name: "Add a task" })).toBeVisible();
  await expect(pane.getByText(note)).toBeVisible();
  await expect(pane.getByRole("list", { name: "Tasks" })).toBeHidden();
  expect(await notesOf(d1, account, title)).toEqual([{ n: 1 }]);
  expect(await logOf(d1, account, title)).toEqual([
    { type: "move_completed", n: 1 },
  ]);
  expect(
    await d1(
      `SELECT last_activity_content IS NULL AS note_is_last FROM threads WHERE user_id = '${account.id}' AND title = '${title}'`,
    ),
  ).toEqual([{ note_is_last: 1 }]);
});

test("a repeating Task completed with a note in the drawer moves to its next occurrence", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Note R ${stamp}`;
  const task = `R1 ${stamp}`;
  const note = `Slept well ${stamp}`;

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  const drawer = await createThread(page, title);
  await addTask(drawer, task);

  // At 1024 wide the "Thread created" toast covers the bottom of the picker until it leaves.
  const row = taskRow(drawer, task);
  await expect(page.getByText("Thread created")).toBeHidden();
  await row.getByRole("button", { name: "Set date" }).click();
  await expect(
    datePicker(page).getByRole("button", { name: "Pick a date…" }),
  ).toBeVisible();
  await sent(page, /\/date$/, () => quickPick(page, "Today"));
  await setRepeat(page, "Every day", "Daily");

  await closeDatePicker(page);
  await settled(drawer);
  await expect(drawer).toHaveAttribute("data-state", "open");
  await expect(
    drawer.getByRole("img", { name: "Repeats daily" }),
  ).toBeVisible();

  // Escape closes the note line and drops its draft, never the drawer.
  const completeWithNote = row.getByRole("button", {
    name: "Complete with a note",
  });
  const noteLine = drawer.getByRole("group", {
    name: `Complete “${task}” with a note`,
  });
  const field = noteLine.getByRole("textbox", { name: "Note" });
  await completeWithNote.click();
  await field.fill(`Draft to drop ${stamp}`);
  await field.press("Escape");
  await expect(noteLine).toBeHidden();
  await settled(drawer);
  await expect(drawer).toHaveAttribute("data-state", "open");
  await expect(drawer.getByRole("list", { name: "Tasks" })).toBeVisible();

  await completeWithNote.click();
  await expect(field).toHaveValue("");
  await field.fill(note);
  await shot("note-line-drawer");
  await sent(page, /\/complete$/, () => field.press("Enter"));
  await expect(noteLine).toBeHidden();
  const tomorrow = dateToken(drawer, task, "Tomorrow");
  await expect(tomorrow).toBeVisible();
  await expect(drawer.getByText(note)).toBeVisible();
  await shot("note-completed-drawer");

  await page.reload();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(note)).toBeVisible();
  await expect(tomorrow).toBeVisible();
  await expect(
    drawer.getByRole("img", { name: "Repeats daily" }),
  ).toBeVisible();
  expect(await notesOf(d1, account, title)).toEqual([{ n: 1 }]);
  expect(await logOf(d1, account, title)).toEqual([
    { type: "move_completed", n: 1 },
  ]);
});

test("a Dashboard card completes in one click and never asks for a note", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Note C ${stamp}`;
  const task = `C1 ${stamp}`;

  await page.goto("/");
  const pane = await createThread(page, title);
  await addTask(pane, task);
  await closeThread(pane);

  const complete = page.getByRole("button", {
    name: `Complete “${task}”`,
    exact: true,
  });
  await expect(complete).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Complete with a note" }),
  ).toHaveCount(0);
  await sent(page, /\/complete$/, () => complete.click());
  await expect(page.getByText(task)).toBeHidden();
  await expect(page.getByRole("group", { name: /with a note/ })).toHaveCount(0);
  await shot("card-completed");

  await page.reload();
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(task)).toBeHidden();
  expect(await logOf(d1, account, title)).toEqual([
    { type: "move_completed", n: 1 },
  ]);
  expect(await notesOf(d1, account, title)).toEqual([{ n: 0 }]);
});
