// Dashboard card task slot: one Task is shown as is, several unfocused read "N tasks · none focused", and a focused one
// is shown among several. The card completes its Task in one click (the focused one, then the only one), and a reload
// keeps the result.
import {
  addTask,
  closeThread,
  createThread,
  taskRow,
  threadCard,
} from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

test("a card shows its one Task, a count, or the focused Task, and completes it in one click", async ({
  page,
  stamp,
  shot,
}) => {
  const one = `Card one ${stamp}`;
  const many = `Card many ${stamp}`;
  const focus = `Card focus ${stamp}`;
  const only = `Only task ${stamp}`;
  const focus2 = `Focus 2 ${stamp}`;

  await page.goto("/");

  // One: a single Task, shown without asking for a focus.
  const onePane = await createThread(page, one);
  await addTask(onePane, only);
  // An open Thread pane covers the header's actions and the right of the list (ADR 0023, ADR 0037), so close it first.
  await closeThread(onePane);

  // Many: three Tasks, none focused.
  const manyPane = await createThread(page, many);
  for (const n of [1, 2, 3]) await addTask(manyPane, `Many ${n} ${stamp}`);
  await closeThread(manyPane);

  // Focus: two Tasks, the second focused.
  const focusPane = await createThread(page, focus);
  await addTask(focusPane, `Focus 1 ${stamp}`);
  await addTask(focusPane, focus2);
  await sent(page, /\/focus$/, () =>
    taskRow(focusPane, focus2)
      .getByRole("button", { name: "Focus this task" })
      .click(),
  );
  await expect(
    focusPane.getByRole("button", { name: "Unfocus this task" }),
  ).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("Ready to move")).toBeVisible();
  await expect(threadCard(page, one)).toContainText(only);
  await expect(threadCard(page, many)).toContainText("3 tasks · none focused");
  await expect(threadCard(page, focus)).toContainText(focus2);
  await shot("dash-task-slots");

  // Complete from the card: the focused Task, then the only Task.
  await sent(page, /\/complete$/, () =>
    page
      .getByRole("button", { name: `Complete “${focus2}”`, exact: true })
      .click(),
  );
  await expect(page.getByText(focus2)).toBeHidden();
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
  await expect(threadCard(page, many)).toContainText("3 tasks · none focused");
  await expect(page.getByText(focus2)).toBeHidden();
  await expect(page.getByText(only)).toBeHidden();
  await shot("dash-task-after-reload");
});
