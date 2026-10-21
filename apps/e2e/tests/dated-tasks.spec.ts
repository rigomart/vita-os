// ADR 0032, ADR 0039, ADR 0040.
import type { Page } from "@playwright/test";

import {
  addTask,
  closeDatePicker,
  closeThread,
  createThread,
  datePicker,
  fromToday,
  logOf,
  openPalette,
  pickDate,
  taskRow,
  threadCard,
  threadId,
} from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

const weekday = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long" });
const heading = (page: Page, label: string) =>
  page.getByRole("region", { name: label, exact: true });
const noDate = (page: Page) =>
  page.getByRole("complementary", { name: "No date", exact: true });

test("a date and time set from a row place the Thread and lead its card; the card's token reschedules it", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Dated A ${stamp}`;
  const task = `A1 ${stamp}`;

  await page.goto("/");
  const pane = await createThread(page, title);
  await addTask(pane, task);
  await shot("dated-a-before");

  await taskRow(pane, task).getByRole("button", { name: "Set date" }).click();
  await sent(page, /\/date$/, () => pickDate(page, fromToday(2)));
  // 3:30 PM has no preset, so it is typed into the Time field.
  const time = datePicker(page).getByLabel("Time", { exact: true });
  await time.fill("15:30");
  await sent(page, /\/date$/, () => time.press("Enter"));
  await expect(time).toHaveValue("15:30");
  await expect(datePicker(page)).toContainText("3:30 PM");
  await closeDatePicker(page);

  const placed = threadCard(heading(page, weekday(fromToday(2))), title);
  await expect(placed).toContainText(task);
  await expect(placed).toContainText("3:30 PM");
  await expect(noDate(page)).toBeVisible();
  await expect(noDate(page).getByRole("link", { name: title })).toHaveCount(0);
  await shot("dated-a-placed");

  await closeThread(pane);
  await threadCard(page, title)
    .getByRole("button", { name: "Change date", exact: true })
    .click();
  await sent(page, /\/date$/, () => pickDate(page, fromToday(3)));
  const moved = threadCard(heading(page, weekday(fromToday(3))), title);
  await expect(moved).toContainText(task);
  await expect(moved).toContainText("3:30 PM");
  await shot("dated-a-rescheduled");

  const at = fromToday(3);
  at.setHours(15, 30);
  expect(
    await d1(
      `SELECT json_extract(moves_json, '$[0].text') AS text, json_extract(moves_json, '$[0].date') AS date FROM threads WHERE user_id = '${account.id}' AND title = '${title}'`,
    ),
  ).toEqual([{ text: task, date: at.getTime() }]);
  expect(await logOf(d1, account, title)).toEqual([]);
});

test("two dated Tasks on the same day are two cards, each led by its Task", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Dated C ${stamp}`;
  const c1 = `C1 ${stamp}`;
  const c2 = `C2 ${stamp}`;

  await page.goto("/");
  const pane = await createThread(page, title);
  await addTask(pane, c1);
  await addTask(pane, c2);
  for (const [i, task] of [c1, c2].entries()) {
    await taskRow(pane, task).getByRole("button", { name: "Set date" }).click();
    await sent(page, /\/date$/, () => pickDate(page, fromToday(0)));
    await closeDatePicker(page);
    await expect(
      pane
        .getByRole("list", { name: "Tasks" })
        .getByRole("button", { name: /^Change date:/ }),
    ).toHaveCount(i + 1);
  }

  // ADR 0044: every dated Task places a copy of its Thread's card.
  const today = threadCard(heading(page, "Today"), title);
  await expect(today).toHaveCount(2);
  await expect(today.nth(0)).toContainText(c1);
  await expect(today.nth(1)).toContainText(c2);
  await expect(today.filter({ hasText: "tasks today" })).toHaveCount(0);
  await shot("dated-c-two-today");
  expect(await logOf(d1, account, title)).toEqual([]);
});

test("a date set on a card with no single Task adds a Follow up, last in Thread detail", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Dated B ${stamp}`;
  const b1 = `B1 ${stamp}`;
  const b2 = `B2 ${stamp}`;

  await page.goto("/");
  const pane = await createThread(page, title);
  await addTask(pane, b1);
  await addTask(pane, b2);
  await page.goto("/");
  await expect(threadCard(noDate(page), title)).toContainText("2 tasks");
  await shot("dated-b-before");

  await threadCard(page, title)
    .getByRole("button", { name: "Set date", exact: true })
    .click();
  await sent(page, /\/tasks$/, () => pickDate(page, fromToday(4)));
  await expect(threadCard(page, title)).toContainText("Follow up");
  await expect(noDate(page)).toBeVisible();
  await expect(noDate(page).getByRole("link", { name: title })).toHaveCount(0);
  await shot("dated-b-after");

  // ADR 0039: one list in capture order, so the dated Follow up stays last, with no No date divider.
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(
    pane.getByRole("list", { name: "Tasks" }).getByRole("listitem"),
  ).toHaveText([new RegExp(b1), new RegExp(b2), /Follow up/]);
  await expect(
    pane.getByRole("region", { name: "Thread attention" }),
  ).not.toContainText(/no date/i);
  await shot("dated-b-detail");

  expect(
    await d1(
      `SELECT json_extract(moves_json, '$[2].text') AS text, json_extract(moves_json, '$[2].date') AS date FROM threads WHERE user_id = '${account.id}' AND title = '${title}'`,
    ),
  ).toEqual([{ text: "Follow up", date: fromToday(4).getTime() }]);
  expect(await logOf(d1, account, title)).toEqual([]);
});

test("a dated Note added to a Thread becomes a dated Task named by its first line, completed once", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Dated D ${stamp}`;
  const body = `## Note task ${stamp}`;
  const task = `Note task ${stamp}`;
  const during = `During conversion ${stamp}`;

  await page.goto("/");
  const pane = await createThread(page, title);
  // The open pane covers the header's New note (ADR 0037), so capture through the palette.
  const palette = await openPalette(page);
  await palette.getByRole("option", { name: "New note" }).click();
  const compose = page.getByRole("dialog");
  await compose.getByRole("textbox", { name: "Note body" }).fill(body);
  await compose
    .getByRole("button", { name: "Follow-up date", exact: true })
    .click();
  await pickDate(page, fromToday(5));
  await sent(page, /\/notes$/, () =>
    compose.getByRole("button", { name: "Add", exact: true }).click(),
  );
  await expect(page.getByText("Note added", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Open note: ${task}` }).click();
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Add to thread…", exact: true })
    .click();
  // The write lands after the five-second Undo window.
  const added = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname.endsWith("/add-to-thread"),
    { timeout: 15_000 },
  );
  await page.getByRole("option", { name: title }).click();
  await expect(page.getByText("Note added to thread")).toBeVisible();

  // While Undo is up the Task isn't in the Thread yet, and capture still works.
  await expect(pane).toBeVisible();
  const tasks = pane.getByRole("list", { name: "Tasks" });
  await expect(tasks.getByRole("button", { name: task })).toHaveCount(0);
  await expect(pane.getByRole("textbox", { name: "Add a task" })).toBeEnabled();
  await addTask(pane, during);
  await shot("dated-d-pending");

  expect((await added).ok()).toBe(true);
  const converted = taskRow(pane, task);
  await expect(converted).toBeVisible();
  await expect(converted).not.toHaveAttribute("aria-busy");
  await expect(
    converted.getByRole("button", { name: "Complete task" }),
  ).toBeEnabled();
  await expect(pane.getByRole("textbox", { name: "Add a task" })).toBeEnabled();
  await shot("dated-d-usable");
  await expect(threadCard(page, title)).toContainText(task);
  await expect(noDate(page)).toBeVisible();
  await expect(noDate(page).getByRole("link", { name: title })).toHaveCount(0);
  await shot("dated-d-added");

  expect(
    await d1(
      `SELECT body FROM thread_notes WHERE thread_id IN (${threadId(account, title)})`,
    ),
  ).toEqual([{ body }]);
  expect(await logOf(d1, account, title)).toEqual([]);

  await sent(page, /\/complete$/, () =>
    converted.getByRole("button", { name: "Complete task" }).click(),
  );
  await expect(
    pane.getByRole("button", { name: task, exact: true }),
  ).toBeHidden();
  await shot("dated-d-completed");
  await page.reload();
  await expect(
    pane.getByRole("button", { name: during, exact: true }),
  ).toBeVisible();
  await expect(
    pane.getByRole("button", { name: task, exact: true }),
  ).toBeHidden();
  expect(await logOf(d1, account, title)).toEqual([
    { type: "move_completed", n: 1 },
  ]);
});
