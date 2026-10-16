import { addTask, closeThread, createThread, taskRow } from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

test.use({ viewport: { width: 1024, height: 768 } });

test("a Thread in the drawer adds and completes Tasks, logs the completion, and stays open on reload", async ({
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
  await expect(taskRow(drawer, b)).toBeVisible();
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

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("the drawer scrolls the whole Thread as one, so many Tasks never crowd out Notes", async ({
    page,
    stamp,
    shot,
  }) => {
    await page.goto("/");
    const drawer = await createThread(page, `Phone drawer ${stamp}`);
    const tasks = Array.from(
      { length: 8 },
      (_, index) => `Phone task ${index + 1} ${stamp}`,
    );
    for (const task of tasks) await addTask(drawer, task);
    await shot("phone-drawer-top");

    const writeNote = drawer.getByRole("button", { name: "Write a note…" });
    await expect(writeNote).not.toBeInViewport();

    // Swiping over the Tasks scrolls the drawer: they are not a fixed block.
    await taskRow(drawer, tasks[0]!).hover();
    await page.mouse.wheel(0, 2000);
    await expect(writeNote).toBeInViewport();
    await expect(
      drawer.getByRole("banner", { name: "Thread header" }),
    ).not.toBeInViewport();
    await expect(drawer).toBeVisible();
    await shot("phone-drawer-scrolled");

    await closeThread(drawer);
  });
});
