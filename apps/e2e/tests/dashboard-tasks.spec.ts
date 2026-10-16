import { addTask, closeThread, createThread, threadCard } from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

test("a No date card shows its one Task or a count, and completes the one Task in one click", async ({
  page,
  stamp,
  shot,
}) => {
  const one = `Card one ${stamp}`;
  const many = `Card many ${stamp}`;
  const only = `Only task ${stamp}`;

  await page.goto("/");

  const onePane = await createThread(page, one);
  await addTask(onePane, only);
  // An open Thread pane covers the header's actions and the right of the list (ADR 0023, ADR 0037).
  await closeThread(onePane);

  const manyPane = await createThread(page, many);
  for (const n of [1, 2, 3]) await addTask(manyPane, `Many ${n} ${stamp}`);

  await page.goto("/");
  await expect(page.getByText("Ready to move")).toBeVisible();
  await expect(threadCard(page, one)).toContainText(only);
  await expect(threadCard(page, many)).toContainText("3 tasks");
  await expect(threadCard(page, many)).not.toContainText(`Many 1 ${stamp}`);
  await expect(
    threadCard(page, many).getByRole("button", { name: /^Complete/ }),
  ).toHaveCount(0);
  await shot("dash-task-slots");

  await sent(page, /\/complete$/, () =>
    page
      .getByRole("button", { name: `Complete “${only}”`, exact: true })
      .click(),
  );
  await expect(page.getByText(only)).toBeHidden();
  await shot("dash-task-completed");

  await page.reload();
  await expect(
    page.getByRole("link", { name: many, exact: true }),
  ).toBeVisible();
  await expect(threadCard(page, many)).toContainText("3 tasks");
  await expect(page.getByText(only)).toBeHidden();
  await shot("dash-task-after-reload");
});
