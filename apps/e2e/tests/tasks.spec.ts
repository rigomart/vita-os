// Tasks in the Thread pane: add three with Enter (exactly three persist), focus one, unfocus it, focus another, edit
// its text (committed with Tab), remove one (no Activity Log entry), complete one (unfocused; the focus stays put). After
// a reload the edit and the focus stuck, the removed and completed Tasks are gone, and the Activity tab shows the
// completion.
import { addTask, createThread, logOf, taskRow } from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

test("add, focus, unfocus, edit, remove, and complete Tasks in the Thread pane", async ({
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

  // Add three Tasks: type, Enter (the capture path under test).
  await addTask(pane, a);
  await addTask(pane, b);
  await addTask(pane, c);
  await expect(
    pane.getByRole("list", { name: "Tasks" }).getByRole("listitem"),
  ).toHaveCount(3);
  await shot("tasks-added");
  // No flood: exactly three Tasks persisted (a runaway Enter would add more).
  expect(
    await d1(
      `SELECT json_array_length(moves_json) AS n FROM threads WHERE user_id = '${account.id}' AND title = '${title}'`,
    ),
  ).toEqual([{ n: 3 }]);

  // Focus B, unfocus it, focus C instead.
  const unfocus = pane.getByRole("button", { name: "Unfocus this task" });
  await sent(page, /\/focus$/, () =>
    taskRow(pane, b).getByRole("button", { name: "Focus this task" }).click(),
  );
  await expect(
    taskRow(pane, b).getByRole("button", { name: "Unfocus this task" }),
  ).toBeVisible();
  await expect(unfocus).toHaveCount(1);
  await shot("tasks-focused");
  await sent(page, /\/focus$/, () =>
    taskRow(pane, b).getByRole("button", { name: "Unfocus this task" }).click(),
  );
  await expect(unfocus).toHaveCount(0);
  await shot("tasks-unfocused");
  await sent(page, /\/focus$/, () =>
    taskRow(pane, c).getByRole("button", { name: "Focus this task" }).click(),
  );
  await expect(
    taskRow(pane, c).getByRole("button", { name: "Unfocus this task" }),
  ).toBeVisible();

  // Edit C: click its text, replace it, commit with Tab.
  await taskRow(pane, c).getByRole("button", { name: c, exact: true }).click();
  const editor = pane
    .getByRole("list", { name: "Tasks" })
    .getByRole("textbox", { name: "Task" });
  await editor.fill(edited);
  await sent(page, /\/tasks\/[^/]+$/, () => editor.press("Tab"));
  await expect(taskRow(pane, edited)).toBeVisible();
  await shot("tasks-edited");

  // Remove A (no Activity Log entry), complete B (unfocused; C keeps the focus).
  await sent(page, /\/tasks\/[^/]+$/, () =>
    taskRow(pane, a).getByRole("button", { name: "Remove task" }).click(),
  );
  await expect(pane.getByRole("button", { name: a, exact: true })).toBeHidden();
  await sent(page, /\/complete$/, () =>
    taskRow(pane, b).getByRole("button", { name: "Complete task" }).click(),
  );
  await expect(pane.getByRole("button", { name: b, exact: true })).toBeHidden();
  await expect(
    taskRow(pane, edited).getByRole("button", { name: "Unfocus this task" }),
  ).toBeVisible();
  await shot("tasks-completed");

  // After a reload (the server's state): the edit and C's focus stuck, A and B are gone, and the Activity Log shows the
  // completion, and only it.
  await page.reload();
  await expect(
    taskRow(pane, edited).getByRole("button", { name: "Unfocus this task" }),
  ).toBeVisible();
  await expect(unfocus).toHaveCount(1);
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
