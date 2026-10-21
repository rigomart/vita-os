// Actions a person takes, shared by specs. Each waits for its own end state before returning.
import type { Locator, Page } from "@playwright/test";

import type { Account, D1 } from "./fixtures.ts";

import { expect, sent, settled } from "./fixtures.ts";

/** Returns the Thread's side pane (from 1280px) or drawer, once it has stopped sliding. */
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
  // An earlier toast may still be up, so wait for this Thread's own surface too.
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

export async function closeThread(surface: Locator) {
  await settled(surface);
  await surface
    .getByRole("button", { name: "Close thread", exact: true })
    .click();
  await expect(surface).toBeHidden();
}

/** `before` runs while the confirm dialog is open. */
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

export function threadCard(scope: Page | Locator, title: string): Locator {
  const page = "page" in scope ? scope.page() : scope;
  return scope
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) });
}

export async function addTask(thread: Locator, text: string) {
  await sent(thread.page(), /\/tasks$/, async () => {
    await thread.getByLabel("Add a task").fill(text);
    await thread.getByLabel("Add a task").press("Enter");
  });
  await expect(taskRow(thread, text)).toBeVisible();
}

export function taskRow(thread: Locator, text: string): Locator {
  return thread
    .getByRole("list", { name: "Tasks" })
    .getByRole("listitem")
    .filter({
      has: thread.page().getByRole("button", { name: text, exact: true }),
    });
}

export const dateToken = (thread: Locator, task: string, when: string) =>
  taskRow(thread, task).getByRole("button", {
    name: `Change date: ${when}`,
    exact: true,
  });

/** The When picker: a popover from 768px, else a drawer. */
export const datePicker = (page: Page) => page.locator("[data-when-picker]");

/** Picks the day on the picker's calendar, paging months until it shows. */
export async function pickDate(page: Page, day: Date) {
  const picker = datePicker(page);
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

/** For a picker that stays open after a choice, like a Task row's. */
export async function closeDatePicker(page: Page) {
  await page.keyboard.press("Escape");
  await expect(datePicker(page)).toHaveCount(0);
}

/** In a dated Task's open picker, which stays open: `choice` is the preset's full name, "Every day". */
export async function setRepeat(page: Page, choice: string) {
  const preset = datePicker(page)
    .getByRole("group", { name: "Repeat", exact: true })
    .getByRole("button", { name: choice, exact: true });
  await sent(page, /\/repeat$/, () => preset.click());
  await expect(preset).toHaveAttribute("aria-pressed", "true");
}

// Local dates, as the browser on this machine sees them: a spec that runs across midnight can fail.

export function fromToday(days: number): Date {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() + days);
  return day;
}

/** Clamped to the target month's last day when that month is shorter. */
export function monthsOn(day: Date, months: number): Date {
  const last = new Date(day.getFullYear(), day.getMonth() + months + 1, 0);
  return new Date(
    last.getFullYear(),
    last.getMonth(),
    Math.min(day.getDate(), last.getDate()),
  );
}

const isoDay = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

/** The open Note view, or the New note dialog. */
export const noteView = (page: Page) => page.getByRole("dialog");

export const openNote = (scope: Page | Locator, text: string) =>
  scope.getByRole("button", { name: `Open note: ${text}`, exact: true });

export const noteCard = (page: Page, text: string) =>
  page.getByRole("listitem").filter({ has: openNote(page, text) });

/** Unlike the header, it shows only once the board has loaded, so it anchors a reload before an absence check. */
export const notesFilter = (page: Page, count?: number) =>
  page
    .getByRole("navigation", { name: "Filter the board" })
    .getByRole(
      "link",
      count === undefined
        ? { name: /^Notes \d+$/ }
        : { name: `Notes ${count}`, exact: true },
    );

export async function notesCount(page: Page): Promise<number> {
  const text = await notesFilter(page).textContent();
  return Number(/\d+$/.exec(text ?? "")?.[0]);
}

/** `fill` waits for the lazily loaded editor and replaces its text; `pick` runs in the Follow-up date picker. */
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

/** Waits for the header's search button first: a ControlOrMeta+k pressed before the shell listens is lost. */
export async function openPalette(page: Page): Promise<Locator> {
  await expect(
    page.getByRole("button", { name: "Search, Command K", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog");
  await expect(palette).toBeVisible();
  return palette;
}

export async function openHistory(page: Page): Promise<Locator> {
  const palette = await openPalette(page);
  await palette.getByRole("button", { name: "History", exact: true }).click();
  return palette;
}

/** SQL selecting the Thread's id, for use as a subquery. */
export const threadId = (account: Account, title: string) =>
  `SELECT id FROM threads WHERE user_id = '${account.id}' AND title = '${title}'`;

export const logOf = (d1: D1, account: Account, title: string) =>
  d1<{ type: string; n: number }>(
    `SELECT type, COUNT(*) AS n FROM activity_log_entries WHERE thread_id IN (${threadId(account, title)}) GROUP BY type`,
  );
