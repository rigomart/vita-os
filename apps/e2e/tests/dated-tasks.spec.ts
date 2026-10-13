// Dated Tasks (ADR 0032): set a date with a time from a Task row, placement and the card's lead, reschedule from the
// card token, two Tasks on one day, a card with no single Task, Thread detail order (ADR 0039), and a dated Note added to
// a Thread. Setting a date never writes an Activity Log entry.
//
// Days are picked relative to today in the picker's calendar, behind "Pick a date…", by their `td[data-day]` cell; when
// the day is not in the month shown, the calendar steps to the next month first, so this runs on any day of the month.
// Today is a quick pick. A time no chip offers is typed under "Other time", once the Task has its day (ADR 0040).
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
  quickPick,
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
  // Back on the menu, which stays open on a row: 3:30 PM is no chip, so it is typed under Other time.
  await datePicker(page)
    .getByRole("button", { name: "Other time", exact: true })
    .click();
  await page.keyboard.type("330p");
  await expect(
    datePicker(page).getByRole("button", { name: "3:30 PM", exact: true }),
  ).toBeVisible();
  await sent(page, /\/date$/, () => page.keyboard.press("Enter"));
  await expect(
    datePicker(page).getByRole("button", {
      name: "Other time: 3:30 PM",
      exact: true,
    }),
  ).toBeVisible();
  // A row's picker stays open after a day is picked (its Repeat can follow); Escape closes it.
  await closeDatePicker(page);

  // The Thread leaves No date for the list, under that day's heading, and its card leads with A1 and its time.
  const placed = threadCard(heading(page, weekday(fromToday(2))), title);
  await expect(placed).toContainText(task);
  await expect(placed).toContainText("3:30 PM");
  await expect(noDate(page)).toBeVisible();
  await expect(noDate(page).getByRole("link", { name: title })).toHaveCount(0);
  await shot("dated-a-placed");

  // Reschedule from the card's own token: one day later, the time kept.
  await closeThread(pane);
  await threadCard(page, title)
    .getByRole("button", { name: "Change date", exact: true })
    .click();
  await sent(page, /\/date$/, () => pickDate(page, fromToday(3)));
  const moved = threadCard(heading(page, weekday(fromToday(3))), title);
  await expect(moved).toContainText(task);
  await expect(moved).toContainText("3:30 PM");
  await shot("dated-a-rescheduled");

  // The date sits inside the Task JSON with its time; setting dates writes no Activity Log entry.
  const at = fromToday(3);
  at.setHours(15, 30);
  expect(
    await d1(
      `SELECT json_extract(moves_json, '$[0].text') AS text, json_extract(moves_json, '$[0].date') AS date FROM threads WHERE user_id = '${account.id}' AND title = '${title}'`,
    ),
  ).toEqual([{ text: task, date: at.getTime() }]);
  expect(await logOf(d1, account, title)).toEqual([]);
});

test("two dated Tasks on the same day read as a count and never pick one", async ({
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
    await sent(page, /\/date$/, () => quickPick(page, "Today"));
    await closeDatePicker(page);
    await expect(
      pane
        .getByRole("list", { name: "Tasks" })
        .getByRole("button", { name: /^Change date:/ }),
    ).toHaveCount(i + 1);
  }

  const today = threadCard(heading(page, "Today"), title);
  await expect(today).toContainText("2 tasks today");
  await expect(today).not.toContainText(c1);
  await expect(today).not.toContainText(c2);
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
  await expect(threadCard(noDate(page), title)).toContainText(
    "2 tasks · none focused",
  );
  await shot("dated-b-before");

  await threadCard(page, title)
    .getByRole("button", { name: "Set date", exact: true })
    .click();
  await sent(page, /\/tasks$/, () => pickDate(page, fromToday(4)));
  await expect(threadCard(page, title)).toContainText("Follow up");
  await expect(noDate(page)).toBeVisible();
  await expect(noDate(page).getByRole("link", { name: title })).toHaveCount(0);
  await shot("dated-b-after");

  // Thread detail (ADR 0039): one list in capture order, so the dated Follow up stays last, and no No date divider.
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
  // D stays open in its pane, which covers the header's New note (ADR 0037): capture through the palette.
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

  // During Undo the destination is not published, and ordinary Task capture remains usable.
  await expect(pane).toBeVisible();
  const tasks = pane.getByRole("list", { name: "Tasks" });
  await expect(tasks.getByRole("button", { name: task })).toHaveCount(0);
  await expect(pane.getByRole("textbox", { name: "Add a task" })).toBeEnabled();
  await addTask(pane, during);
  await shot("dated-d-pending");

  // The confirmed dated Task appears after Undo and save finish.
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

  // One Thread Note and no Activity Log entry: counts the screen can't show.
  expect(
    await d1(
      `SELECT body FROM thread_notes WHERE thread_id IN (${threadId(account, title)})`,
    ),
  ).toEqual([{ body }]);
  expect(await logOf(d1, account, title)).toEqual([]);

  // Completing the confirmed converted Task goes out once: it is gone and logged once; the unrelated Task remains.
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
