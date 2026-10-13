import { addTask, closeThread, createThread, taskRow } from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

test.use({ viewport: { width: 1024, height: 768 } });

test("a Thread in the drawer adds, focuses and completes Tasks, logs the completion, and stays open on reload", async ({
  page,
  stamp,
  shot,
}) => {
  const title = `Drawer ${stamp}`;
  const a = `Drawer A ${stamp}`;
  const b = `Drawer B ${stamp}`;

  await page.goto("/");
  const drawer = await createThread(page, title);
  await shot("drawer-before");

  await addTask(drawer, a);
  await addTask(drawer, b);
  await sent(page, /\/focus$/, () =>
    taskRow(drawer, b).getByRole("button", { name: "Focus this task" }).click(),
  );
  await expect(
    taskRow(drawer, b).getByRole("button", { name: "Unfocus this task" }),
  ).toBeVisible();
  await shot("drawer-tasks");

  await sent(page, /\/complete$/, () =>
    taskRow(drawer, b).getByRole("button", { name: "Complete task" }).click(),
  );
  await expect(
    drawer.getByRole("button", { name: b, exact: true }),
  ).toBeHidden();
  await drawer.getByRole("tab", { name: "Activity", exact: true }).click();
  await expect(drawer.getByText(`Completed ${b}`)).toBeVisible();
  await shot("drawer-activity");

  await page.reload();
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: a, exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: b, exact: true }),
  ).toBeHidden();
  await shot("drawer-reloaded");

  await closeThread(drawer);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
