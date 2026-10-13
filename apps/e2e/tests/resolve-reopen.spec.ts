// Resolve a Thread that has open Tasks (one of them focused): its resolution entry in the Activity Log names the
// discarded Tasks, it shows in History, opens there with no Tasks while resolved, and Reopen returns it to open work
// with the Tasks and the focus still discarded. The Activity tab shows only "open → resolved", so the entry's content is
// read from D1.
import {
  addTask,
  createThread,
  openHistory,
  reopenThread,
  resolveThread,
  taskRow,
  threadId,
} from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

test("resolving discards open Tasks and focus, names them in the log, and Reopen keeps them discarded", async ({
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
  await sent(page, /\/focus$/, () =>
    taskRow(pane, taskB)
      .getByRole("button", { name: "Focus this task", exact: true })
      .click(),
  );
  const unfocus = pane.getByRole("button", {
    name: "Unfocus this task",
    exact: true,
  });
  await expect(unfocus).toBeVisible();
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

  // After a reload (the server's state), find it in History and open it: no Tasks while resolved, the log is the
  // record.
  await page.reload();
  const palette = await openHistory(page);
  await palette.getByRole("option", { name: title, exact: true }).click();
  await expect(pane.getByText("while resolved")).toBeVisible();
  await expect(
    pane.getByRole("button", { name: taskA, exact: true }),
  ).toHaveCount(0);
  await pane.getByRole("tab", { name: "Activity", exact: true }).click();
  await expect(pane.getByText("open → resolved")).toBeVisible();
  await shot("resolve-history");

  // Reopen from Thread actions: open again, with the Tasks and the focus still discarded.
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
  await expect(unfocus).toHaveCount(0);
});
