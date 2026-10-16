import { addTask, createThread, taskRow } from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

test("renaming a Thread while its Tasks are completed and removed is never refused, and all of it sticks", async ({
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
  const d = `Task D ${stamp}`;

  await page.goto("/");
  await createThread(page, title);
  // Not `createThread`'s pane: it is found by title, which the rename changes.
  const pane = page.locator("[data-slot=thread-detail-pane]");
  for (const task of [a, b, c, d]) await addTask(pane, task);

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

  // Clicking Remove blurs the title, so the rename and the removal go out together, A's completion maybe still in flight.
  await sent(page, /\/complete$/, async () => {
    await taskRow(pane, a)
      .getByRole("button", { name: "Complete task" })
      .click();
    await pane.getByRole("button", { name: title, exact: true }).click();
    await pane
      .getByRole("textbox", { name: "Click to edit...", exact: true })
      .fill(edited);
    await sent(page, /\/threads\/[^/]+$/, () =>
      sent(page, /\/tasks\/[^/]+$/, () =>
        taskRow(pane, b).getByRole("button", { name: "Remove task" }).click(),
      ),
    );
  });
  // The rename's new slug re-renders the pane.
  await expect(page).toHaveURL(/[?&]thread=edited-race-/);
  await expect(pane.getByRole("button", { name: b, exact: true })).toBeHidden();
  await expect(pane.getByRole("button", { name: a, exact: true })).toBeHidden();
  await shot("edit-race-order-1");

  // Completing C blurs the title, so it goes out while the rename is in flight.
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

  expect(
    await page.evaluate(
      () => (window as unknown as { __refused: boolean }).__refused,
    ),
  ).toBe(false);
  expect(failedWrites).toEqual([]);
  expect(
    await d1(
      `SELECT l.type, COUNT(*) AS n FROM activity_log_entries l JOIN threads t ON t.id = l.thread_id WHERE t.user_id = '${account.id}' AND t.title = '${final}' GROUP BY l.type`,
    ),
  ).toEqual([{ type: "move_completed", n: 2 }]);

  await page.reload();
  await expect(page.getByRole("complementary", { name: final })).toBeVisible();
  await expect(taskRow(pane, d)).toBeVisible();
  await expect(pane.getByRole("button", { name: a, exact: true })).toBeHidden();
  await expect(pane.getByRole("button", { name: b, exact: true })).toBeHidden();
  await expect(pane.getByRole("button", { name: c, exact: true })).toBeHidden();
  await expect(
    pane.getByRole("list", { name: "Tasks" }).getByRole("listitem"),
  ).toHaveCount(1);
  await shot("edit-race-after-reload");
});
