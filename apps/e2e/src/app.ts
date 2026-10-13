// Vita OS actions a person takes, shared by specs. Each one waits for its own end state before returning.
import type { Locator, Page } from "@playwright/test";

import type { Account, D1 } from "./fixtures.ts";

import { expect, sent, settled } from "./fixtures.ts";

// Threads

/**
 * New thread from the header, labeled with `area` when given (an existing Area, or a new one with `newArea`). Returns
 * the Thread's side pane (from 1280px) or drawer once it has stopped sliding.
 */
export async function createThread(
  page: Page,
  title: string,
  { area, newArea = false }: { area?: string; newArea?: boolean } = {},
): Promise<Locator> {
  await page.getByRole("button", { name: "New thread", exact: true }).click();
  await page.getByLabel("Thread title").fill(title);
  if (area !== undefined) {
    await page.getByRole("button", { name: "Add area", exact: true }).click();
    await page.getByRole("combobox").fill(area);
    await page
      .getByRole("option", {
        name: newArea ? `Create “${area}”` : area,
        exact: true,
      })
      .click();
  }
  await sent(page, /\/threads$/, () =>
    page.getByRole("button", { name: "Create", exact: true }).click(),
  );
  // An earlier Thread's toast may still be up, so the toast alone doesn't prove this one: wait for its own surface too.
  await expect(page.getByText("Thread created").first()).toBeVisible();
  const surface = page
    .getByRole("complementary", { name: title, exact: true })
    .or(page.getByRole("dialog", { name: title, exact: true }));
  await expect(
    surface.getByRole("textbox", { name: "Add a task" }),
  ).toBeVisible();
  await settled(surface);
  return surface;
}

/** Closes the Thread open in `surface` (side pane or drawer) with its Close thread button; waits until it is gone. */
export async function closeThread(surface: Locator) {
  await settled(surface);
  await surface
    .getByRole("button", { name: "Close thread", exact: true })
    .click();
  await expect(surface).toBeHidden();
}

/** Resolves the Thread open in `surface` through Thread actions; resolution closes it. `before` runs at the confirm. */
export async function resolveThread(
  surface: Locator,
  before?: () => Promise<unknown>,
) {
  const page = surface.page();
  await surface
    .getByRole("button", { name: "Thread actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Resolve", exact: true }).click();
  await before?.();
  await sent(page, /\/threads\/[^/]+$/, () =>
    page.getByRole("button", { name: "Resolve thread", exact: true }).click(),
  );
  // An earlier resolution's toast may still be up; `sent` already proved the write.
  await expect(page.getByText("Thread resolved").first()).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(surface).toBeHidden();
}

/** Reopens the resolved Thread open in `surface` through Thread actions; it offers "Add a task" again. */
export async function reopenThread(surface: Locator) {
  const page = surface.page();
  await surface
    .getByRole("button", { name: "Thread actions", exact: true })
    .click();
  await sent(page, /\/threads\/[^/]+$/, () =>
    page.getByRole("menuitem", { name: "Reopen", exact: true }).click(),
  );
  await expect(page.getByText("Thread reopened")).toBeVisible();
  await expect(
    surface.getByRole("textbox", { name: "Add a task" }),
  ).toBeVisible();
}

/** The Dashboard card of the Thread titled `title`, within `scope` (a heading's region, or the page). */
export function threadCard(scope: Page | Locator, title: string): Locator {
  const page = "page" in scope ? scope.page() : scope;
  return scope
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) });
}

// Tasks

/** Captures a Task with Enter in "Add a task" of an open Thread (side pane or drawer) and waits for its row. */
export async function addTask(thread: Locator, text: string) {
  await sent(thread.page(), /\/tasks$/, async () => {
    await thread.getByLabel("Add a task").fill(text);
    await thread.getByLabel("Add a task").press("Enter");
  });
  await expect(taskRow(thread, text)).toBeVisible();
}

/** The row of the Task named `text` in an open Thread's task list. */
export function taskRow(thread: Locator, text: string): Locator {
  return thread
    .getByRole("list", { name: "Tasks" })
    .getByRole("listitem")
    .filter({
      has: thread.page().getByRole("button", { name: text, exact: true }),
    });
}

/** The date token on the row of the Task `task`, named `Change date: <when>`. */
export const dateToken = (thread: Locator, task: string, when: string) =>
  taskRow(thread, task).getByRole("button", {
    name: `Change date: ${when}`,
    exact: true,
  });

// Date picker

/** The open date picker, wherever it was opened from (a Task row, a card, a Note, compose). */
export const datePicker = (page: Page) =>
  page.locator("[data-slot=popover-content]");

/** In an open date picker: the quick pick whose name starts with `label` ("Today", "Tomorrow"). */
export const quickPick = (page: Page, label: string) =>
  datePicker(page)
    .getByRole("button", { name: new RegExp(`^${label}, `) })
    .click();

/** In an open date picker: "Pick a date…", step the calendar to `day`'s month (either way), and choose `day`. */
export async function pickDate(page: Page, day: Date) {
  const picker = datePicker(page);
  await picker
    .getByRole("button", { name: "Pick a date…", exact: true })
    .click();
  const cell = picker.locator(`td[data-day="${isoDay(day)}"]`);
  const first = picker.locator("td[data-day]").first();
  await expect(first).toBeVisible();
  for (let step = 0; (await cell.count()) === 0; step++) {
    if (step === 12) throw new Error(`${isoDay(day)} is not within a year`);
    const shown = (await first.getAttribute("data-day"))!;
    await picker
      .getByRole("button", {
        name: shown < isoDay(day) ? /Next Month/ : /Previous Month/,
      })
      .click();
    await expect(first).not.toHaveAttribute("data-day", shown);
  }
  await cell.getByRole("button").click();
}

/** Closes a date picker that stays open after a choice (a Task row's) with Escape. */
export async function closeDatePicker(page: Page) {
  await page.keyboard.press("Escape");
  await expect(datePicker(page)).toHaveCount(0);
}

/** In an open, dated Task picker: Repeat, Never, then the preset `choice`; waits until it reads "Repeat, <shown>". */
export async function setRepeat(page: Page, choice: string, shown: string) {
  const picker = datePicker(page);
  await picker
    .getByRole("button", { name: "Repeat, Never", exact: true })
    .click();
  await sent(page, /\/repeat$/, () =>
    picker.getByRole("button", { name: choice, exact: true }).click(),
  );
  await expect(
    picker.getByRole("button", { name: `Repeat, ${shown}`, exact: true }),
  ).toBeVisible();
}

// Dates, the way the browser on this machine sees them (same clock, same time zone)

/** Local midnight `days` from today. */
export function fromToday(days: number): Date {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() + days);
  return day;
}

/** `day` moved `months` on, on its own day of month or the target month's last day when that is shorter. */
export function monthsOn(day: Date, months: number): Date {
  const last = new Date(day.getFullYear(), day.getMonth() + months + 1, 0);
  return new Date(
    last.getFullYear(),
    last.getMonth(),
    Math.min(day.getDate(), last.getDate()),
  );
}

/** "2026-11-05", the calendar's `td[data-day]` key. */
const isoDay = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

// Notes

/** The open Note view, or the New note dialog. */
export const noteView = (page: Page) => page.getByRole("dialog");

/** The button that opens the Note `text` (a board card's or a Thread Note's), within `scope`. */
export const openNote = (scope: Page | Locator, text: string) =>
  scope.getByRole("button", { name: `Open note: ${text}`, exact: true });

/** The Dashboard card of the Standalone Note `text`. */
export const noteCard = (page: Page, text: string) =>
  page.getByRole("listitem").filter({ has: openNote(page, text) });

/**
 * The filter row's Notes link, named `Notes <count of open Standalone Notes>` (`count` when given). Unlike the header,
 * it shows only once the board's data has loaded, so it anchors a reload before an absence check.
 */
export const notesFilter = (page: Page, count?: number) =>
  page
    .getByRole("navigation", { name: "Filter the board" })
    .getByRole(
      "link",
      count === undefined
        ? { name: /^Notes \d+$/ }
        : { name: `Notes ${count}`, exact: true },
    );

/** The count on the filter row's Notes link, once the board has loaded. */
export async function notesCount(page: Page): Promise<number> {
  const text = await notesFilter(page).textContent();
  return Number(/\d+$/.exec(text ?? "")?.[0]);
}

/**
 * New note from the header: types `body` (the CodeMirror editor loads lazily; `fill` waits for it and replaces its
 * text), runs `pick` in the Follow-up date picker when given, adds the Note, and waits until the server has it.
 */
export async function captureNote(
  page: Page,
  body: string,
  pick?: () => Promise<unknown>,
) {
  await page.getByRole("button", { name: "New note", exact: true }).click();
  const view = noteView(page);
  const editor = view.getByRole("textbox", { name: "Note body" });
  await editor.fill(body);
  await expect(editor).toHaveText(body);
  if (pick) {
    await view
      .getByRole("button", { name: "Follow-up date", exact: true })
      .click();
    await pick();
    await expect(datePicker(page)).toBeHidden();
  }
  await sent(page, /\/notes$/, () =>
    view.getByRole("button", { name: "Add", exact: true }).click(),
  );
  await expect(view).toBeHidden();
  // An earlier Note's toast may still be up; `sent` already proved the write.
  await expect(
    page.getByText("Note added", { exact: true }).first(),
  ).toBeVisible();
}

// Palette

/** Opens the command palette with Command K, once the shell listens for it (its header button shows when it does). */
export async function openPalette(page: Page): Promise<Locator> {
  await expect(
    page.getByRole("button", { name: "Search, Command K", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog");
  await expect(palette).toBeVisible();
  return palette;
}

/** Opens the palette on History (resolved Threads and Archived Notes). */
export async function openHistory(page: Page): Promise<Locator> {
  const palette = await openPalette(page);
  await palette.getByRole("button", { name: "History", exact: true }).click();
  return palette;
}

// D1

/** SQL selecting the id of `account`'s Thread titled `title`, for use as a subquery. */
export const threadId = (account: Account, title: string) =>
  `SELECT id FROM threads WHERE user_id = '${account.id}' AND title = '${title}'`;

/** The Activity Log of `account`'s Thread `title`, counted by entry type. */
export const logOf = (d1: D1, account: Account, title: string) =>
  d1<{ type: string; n: number }>(
    `SELECT type, COUNT(*) AS n FROM activity_log_entries WHERE thread_id IN (${threadId(account, title)}) GROUP BY type`,
  );
