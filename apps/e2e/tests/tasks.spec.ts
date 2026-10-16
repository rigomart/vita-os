import { addTask, createThread, logOf, taskRow } from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

test("add, edit, remove, and complete Tasks in the Thread pane", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Flow tasks ${stamp}`;
  const a = `Task A ${stamp}`;
  const b = `Task B ${stamp}`;
  const c = `Task C ${stamp}`;
  const edited = `Task C edited ${stamp}`;

  await page.goto("/");
  const pane = await createThread(page, title);
  await expect(pane.getByRole("list", { name: "Tasks" })).toBeHidden();
  await shot("tasks-before");

  await addTask(pane, a);
  await addTask(pane, b);
  await addTask(pane, c);
  await expect(
    pane.getByRole("list", { name: "Tasks" }).getByRole("listitem"),
  ).toHaveCount(3);
  await shot("tasks-added");
  // A runaway Enter would persist more than three.
  expect(
    await d1(
      `SELECT json_array_length(moves_json) AS n FROM threads WHERE user_id = '${account.id}' AND title = '${title}'`,
    ),
  ).toEqual([{ n: 3 }]);

  await taskRow(pane, c).getByRole("button", { name: c, exact: true }).click();
  const editor = pane
    .getByRole("list", { name: "Tasks" })
    .getByRole("textbox", { name: "Task" });
  await editor.fill(edited);
  await sent(page, /\/tasks\/[^/]+$/, () => editor.press("Tab"));
  await expect(taskRow(pane, edited)).toBeVisible();
  await shot("tasks-edited");

  await sent(page, /\/tasks\/[^/]+$/, () =>
    taskRow(pane, a).getByRole("button", { name: "Remove task" }).click(),
  );
  await expect(pane.getByRole("button", { name: a, exact: true })).toBeHidden();
  await sent(page, /\/complete$/, () =>
    taskRow(pane, b).getByRole("button", { name: "Complete task" }).click(),
  );
  await expect(pane.getByRole("button", { name: b, exact: true })).toBeHidden();
  await expect(taskRow(pane, edited)).toBeVisible();
  await shot("tasks-completed");

  await page.reload();
  await expect(taskRow(pane, edited)).toBeVisible();
  await expect(
    pane.getByRole("list", { name: "Tasks" }).getByRole("listitem"),
  ).toHaveCount(1);
  await expect(pane.getByRole("button", { name: a, exact: true })).toBeHidden();
  await expect(pane.getByRole("button", { name: b, exact: true })).toBeHidden();
  await pane.getByRole("tab", { name: "Activity", exact: true }).click();
  await expect(pane.getByText(`Completed ${b}`)).toBeVisible();
  await expect(pane.getByText(`Completed ${a}`)).toBeHidden();
  await shot("tasks-activity");
  expect(await logOf(d1, account, title)).toEqual([
    { type: "move_completed", n: 1 },
  ]);
});
