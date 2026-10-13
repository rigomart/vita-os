// Thread edits beside independent Task commands: complete a Task and rename the Thread right away, then focus another
// Task in the same gesture; then rename and complete a Task in one gesture, while the rename is in flight. Neither order
// may end in "This Thread changed elsewhere" (or any refusal), and everything sticks: two completions logged, the final
// title, B alone and focused after a reload. The title edit is committed by the click that blurs it, never Enter.
import { addTask, createThread, taskRow } from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

test("renaming a Thread while its Tasks are completed and focused is never refused, and all of it sticks", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Edit race ${stamp}`;
  const edited = `Edited race ${stamp}`;
  const final = `Final race ${stamp}`;
  const a = `Task A ${stamp}`;
  const b = `Task B ${stamp}`;
  const c = `Task C ${stamp}`;

  await page.goto("/");
  await createThread(page, title);
  // Not the pane `createThread` returns, which is found by title: renaming the Thread would lose it.
  const pane = page.locator("[data-slot=thread-detail-pane]");
  for (const task of [a, b, c]) await addTask(pane, task);

  // From here on, any refusal toast or failed write fails the test.
  const failedWrites: string[] = [];
  page.on("response", (r) => {
    const method = r.request().method();
    if (!["GET", "OPTIONS"].includes(method) && !r.ok())
      failedWrites.push(`${method} ${new URL(r.url()).pathname} ${r.status()}`);
  });
  await page.evaluate(() => {
    const w = window as unknown as { __refused: boolean };
    w.__refused = false;
    new MutationObserver(() => {
      const text = document.body.textContent ?? "";
      if (text.includes("changed elsewhere") || text.includes("Could not save"))
        w.__refused = true;
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
  await shot("edit-race-before");

  // Order 1: complete A, then rename and focus B in one gesture: clicking Focus blurs the title field, which saves the
  // rename, and the click focuses B, so the rename and the focus are issued together (A may still be in flight).
  await sent(page, /\/complete$/, async () => {
    await taskRow(pane, a)
      .getByRole("button", { name: "Complete task" })
      .click();
    await pane.getByRole("button", { name: title, exact: true }).click();
    await pane
      .getByRole("textbox", { name: "Click to edit...", exact: true })
      .fill(edited);
    await sent(page, /\/threads\/[^/]+$/, () =>
      sent(page, /\/focus$/, () =>
        taskRow(pane, b)
          .getByRole("button", { name: "Focus this task" })
          .click(),
      ),
    );
  });
  // The rename's new slug re-renders the pane.
  await expect(page).toHaveURL(/[?&]thread=edited-race-/);
  await expect(
    taskRow(pane, b).getByRole("button", { name: "Unfocus this task" }),
  ).toBeVisible();
  await expect(pane.getByRole("button", { name: a, exact: true })).toBeHidden();
  await shot("edit-race-order-1");

  // Order 2: rename, and complete C in the same gesture, while the rename is in flight.
  await pane.getByRole("button", { name: edited, exact: true }).click();
  await pane
    .getByRole("textbox", { name: "Click to edit...", exact: true })
    .fill(final);
  await sent(page, /\/threads\/[^/]+$/, () =>
    sent(page, /\/complete$/, () =>
      taskRow(pane, c).getByRole("button", { name: "Complete task" }).click(),
    ),
  );
  await expect(page).toHaveURL(/[?&]thread=final-race-/);
  await expect(pane.getByRole("button", { name: c, exact: true })).toBeHidden();
  await shot("edit-race-order-2");

  // No refusal was shown at any point, and every write succeeded.
  expect(
    await page.evaluate(
      () => (window as unknown as { __refused: boolean }).__refused,
    ),
  ).toBe(false);
  expect(failedWrites).toEqual([]);
  // Each completion is recorded once.
  expect(
    await d1(
      `SELECT l.type, COUNT(*) AS n FROM activity_log_entries l JOIN threads t ON t.id = l.thread_id WHERE t.user_id = '${account.id}' AND t.title = '${final}' GROUP BY l.type`,
    ),
  ).toEqual([{ type: "move_completed", n: 2 }]);

  // After a reload the pane shows the final title, B alone and focused.
  await page.reload();
  await expect(page.getByRole("complementary", { name: final })).toBeVisible();
  await expect(
    taskRow(pane, b).getByRole("button", { name: "Unfocus this task" }),
  ).toBeVisible();
  await expect(pane.getByRole("button", { name: a, exact: true })).toBeHidden();
  await expect(pane.getByRole("button", { name: c, exact: true })).toBeHidden();
  await expect(
    pane.getByRole("list", { name: "Tasks" }).getByRole("listitem"),
  ).toHaveCount(1);
  await shot("edit-race-after-reload");
});
