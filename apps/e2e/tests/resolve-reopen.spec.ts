// #463. D1 proves the stored content; the Activity tab shows it as sentences.
import {
  addTask,
  createThread,
  openHistory,
  reopenThread,
  resolveThread,
  threadId,
} from "../src/app.ts";
import { expect, test } from "../src/fixtures.ts";

test("resolving discards open Tasks, names them in the log, and Reopen keeps them discarded", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Resolve me ${stamp}`;
  const taskA = `Discard A ${stamp}`;
  const taskB = `Discard B ${stamp}`;

  await page.goto("/");
  const pane = await createThread(page, title);
  await addTask(pane, taskA);
  await addTask(pane, taskB);
  await shot("resolve-before");

  await resolveThread(pane);
  expect(
    await d1(
      `SELECT content, previous_value, new_value FROM activity_log_entries WHERE user_id = '${account.id}' AND type = 'state_change' AND thread_id IN (${threadId(account, title)})`,
    ),
  ).toEqual([
    {
      content: `Resolved thread — discarded tasks: "${taskA}", "${taskB}"`,
      previous_value: "open",
      new_value: "resolved",
    },
  ]);

  await page.reload();
  const palette = await openHistory(page);
  await palette.getByRole("option", { name: title, exact: true }).click();
  await expect(pane.getByText("while resolved")).toBeVisible();
  await expect(
    pane.getByRole("button", { name: taskA, exact: true }),
  ).toHaveCount(0);
  await pane.getByRole("tab", { name: "Activity", exact: true }).click();
  await expect(pane.getByText("Resolved the Thread")).toBeVisible();
  await expect(pane.getByText("Dropped 2 open Tasks")).toBeVisible();
  await expect(pane.getByText(taskA)).toBeVisible();
  await expect(pane.getByText(taskB)).toBeVisible();
  await shot("resolve-history");

  await reopenThread(pane);
  await shot("resolve-reopened");

  await page.reload();
  await expect(pane.getByRole("textbox", { name: "Add a task" })).toBeVisible();
  await expect(
    pane.getByRole("button", { name: taskA, exact: true }),
  ).toHaveCount(0);
  await expect(
    pane.getByRole("button", { name: taskB, exact: true }),
  ).toHaveCount(0);
});
