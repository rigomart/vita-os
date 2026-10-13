// Repeating Tasks (ADR 0032, issue #404): set a daily Repeat with a time from a Task row's picker, complete it and see it
// come back at the next occurrence (one move_completed), skip it (no Activity Log entry), switch to weekly and see the
// date move to the first chosen day, a missed repeating Task as one Late card skipped and completed from the card,
// Every N days in the drawer, and monthly (issue #457): the 31st through a shorter month and back, a missed monthly Task
// as one Late card, a date change.
//
// Dates are relative to today, computed here the way the app labels them, so the spec runs on any day (but not across
// midnight). Every choice in the picker saves as it is made (ADR 0040). A missed Task is dated in the past through the
// picker itself (it accepts past days); nothing is written to D1 by hand.
import type { Page } from "@playwright/test";

import {
  addTask,
  closeDatePicker,
  closeThread,
  createThread,
  datePicker,
  dateToken,
  fromToday,
  logOf,
  monthsOn,
  pickDate,
  quickPick,
  setRepeat,
  taskRow,
  threadCard,
} from "../src/app.ts";
import { expect, sent, settled, test } from "../src/fixtures.ts";

/** A day of month as the app says it: 1st, 2nd, 11th, 31st. */
function ordinal(day: number): string {
  const teen = day % 100 >= 11 && day % 100 <= 13;
  return `${day}${teen ? "th" : (["th", "st", "nd", "rd"][day % 10] ?? "th")}`;
}

/** A Task row's date token as the app names it: Today, Tomorrow, Yesterday, a short weekday up to six days out, else Oct 22. */
function taskWhen(day: Date): string {
  const days = Math.round(
    (day.getTime() - fromToday(0).getTime()) / 86_400_000,
  );
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7)
    return day.toLocaleDateString("en-US", { weekday: "short" });
  return day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Creates a Thread with one Task in the side pane (1440x900) and returns the pane. */
async function threadWithTask(page: Page, title: string, task: string) {
  await page.goto("/");
  const pane = await createThread(page, title);
  await addTask(pane, task);
  return pane;
}

test("a daily Repeat at 9 PM from a row: complete, skip, then weekly on another day", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Repeat A ${stamp}`;
  const task = `R1 ${stamp}`;
  const pane = await threadWithTask(page, title, task);
  const picker = datePicker(page);
  const repeatNever = picker.getByRole("button", {
    name: "Repeat, Never",
    exact: true,
  });

  // The picker holds the time and the Repeat, disabled until the Task has a day.
  await taskRow(pane, task).getByRole("button", { name: "Set date" }).click();
  await expect(repeatNever).toBeDisabled();
  const timeChips = picker
    .getByRole("group", { name: "Time" })
    .getByRole("button");
  await expect(timeChips).toHaveCount(5);
  for (const chip of await timeChips.all()) await expect(chip).toBeDisabled();
  await shot("repeat-picker-no-date");

  // Today, then 9 PM typed under Other time, then Every day, in the same picker, which stays open on a row.
  await sent(page, /\/date$/, () => quickPick(page, "Today"));
  await expect(repeatNever).toBeEnabled();
  await picker.getByRole("button", { name: "Other time", exact: true }).click();
  await page.keyboard.type("9p");
  await expect(
    picker.getByRole("button", { name: "9 PM", exact: true }),
  ).toBeVisible();
  await sent(page, /\/date$/, () => page.keyboard.press("Enter"));
  await expect(
    picker.getByRole("button", { name: "Other time: 9 PM", exact: true }),
  ).toBeVisible();
  await setRepeat(page, "Every day", "Daily");
  await shot("repeat-picker-daily");
  await closeDatePicker(page);

  // The row wears the repeat glyph on its date, the card before the Task's text; the card sits under Now, Today, at 9 PM.
  await expect(
    taskRow(pane, task).getByRole("img", {
      name: "Repeats daily",
      exact: true,
    }),
  ).toBeVisible();
  const todayCard = threadCard(
    page.getByRole("region", { name: "Today", exact: true }),
    title,
  );
  await expect(todayCard).toContainText(task);
  await expect(todayCard).toContainText("9 PM");
  await expect(todayCard.locator("[data-slot=repeat-glyph]")).toBeVisible();
  await shot("repeat-card-glyph");
  expect(await logOf(d1, account, title)).toEqual([]);

  // Complete from the row: the Task stays and comes back tomorrow at 9 PM; one move_completed is written.
  await sent(page, /\/complete$/, () =>
    taskRow(pane, task).getByRole("button", { name: "Complete task" }).click(),
  );
  await expect(dateToken(pane, task, "Tomorrow · 9 PM")).toBeVisible();
  const tomorrowCard = threadCard(
    page.getByRole("region", { name: "Tomorrow", exact: true }),
    title,
  );
  await expect(tomorrowCard).toContainText(task);
  await shot("repeat-completed");
  expect(await logOf(d1, account, title)).toEqual([
    { type: "move_completed", n: 1 },
  ]);

  // After a reload the server's Task is the one shown: tomorrow at 9 PM.
  await page.reload();
  await expect(dateToken(pane, task, "Tomorrow · 9 PM")).toBeVisible();

  // Skip from the row: the day after, and no Activity Log entry.
  const inTwoDays = `${taskWhen(fromToday(2))} · 9 PM`;
  await sent(page, /\/skip$/, () =>
    taskRow(pane, task).getByRole("button", { name: "Skip task" }).click(),
  );
  await expect(dateToken(pane, task, inTwoDays)).toBeVisible();
  await shot("repeat-skipped");
  await page.reload();
  await expect(dateToken(pane, task, inTwoDays)).toBeVisible();
  expect(await logOf(d1, account, title)).toEqual([
    { type: "move_completed", n: 1 },
  ]);

  // Weekly: it starts on the date's own weekday; choosing two days later instead says the date moves there, and it does.
  const weekday = (day: Date) =>
    day.toLocaleDateString("en-US", { weekday: "long" });
  await dateToken(pane, task, inTwoDays).click();
  await picker
    .getByRole("button", { name: "Repeat, Daily", exact: true })
    .click();
  await picker.getByRole("button", { name: "Custom…", exact: true }).click();
  const custom = picker.getByRole("group", { name: "Custom repeat" });
  await custom.getByRole("button", { name: "Weekly", exact: true }).click();
  const off = custom.getByRole("button", {
    name: weekday(fromToday(2)),
    exact: true,
  });
  const on = custom.getByRole("button", {
    name: weekday(fromToday(4)),
    exact: true,
  });
  await expect(off).toHaveAttribute("aria-pressed", "true");
  await off.click();
  await on.click();
  await expect(off).toHaveAttribute("aria-pressed", "false");
  await expect(on).toHaveAttribute("aria-pressed", "true");
  await expect(custom).toContainText(
    `The date moves to ${fromToday(4).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, the first chosen day.`,
  );
  await shot("repeat-picker-weekly");
  await sent(page, /\/repeat$/, () =>
    custom.getByRole("button", { name: "Save repeat", exact: true }).click(),
  );
  await closeDatePicker(page);
  const inFourDays = `${taskWhen(fromToday(4))} · 9 PM`;
  const weekly = `Repeats weekly on ${fromToday(4).toLocaleDateString("en-US", { weekday: "short" })}`;
  await expect(dateToken(pane, task, inFourDays)).toBeVisible();
  await page.reload();
  await expect(dateToken(pane, task, inFourDays)).toBeVisible();
  await expect(
    taskRow(pane, task).getByRole("img", { name: weekly, exact: true }),
  ).toBeVisible();
  await shot("repeat-weekly-snapped");
  expect(await logOf(d1, account, title)).toEqual([
    { type: "move_completed", n: 1 },
  ]);
});

test("a missed daily Task is one Late card, skipped and completed from the card, then every 3 days in the drawer", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Repeat L ${stamp}`;
  const task = `L1 ${stamp}`;
  const pane = await threadWithTask(page, title, task);
  const picker = datePicker(page);

  // Dated three days ago through the picker, every day.
  await taskRow(pane, task).getByRole("button", { name: "Set date" }).click();
  await sent(page, /\/date$/, () => pickDate(page, fromToday(-3)));
  await setRepeat(page, "Every day", "Daily");
  await closeDatePicker(page);

  // One Late card, never one per missed day. An open Thread pane covers the right of the list (ADR 0023, ADR 0037).
  await closeThread(pane);
  const late = page.getByRole("region", { name: "Late", exact: true });
  await expect(threadCard(late, title)).toHaveCount(1);
  await expect(
    page.getByRole("listitem").filter({ hasText: task }),
  ).toHaveCount(1);
  await expect(threadCard(late, title)).toContainText(task);
  await expect(
    threadCard(late, title).locator("[data-slot=repeat-glyph]"),
  ).toBeVisible();
  await shot("repeat-late-card");

  // Skip from the card: the missed run collapses to today; nothing is logged.
  await sent(page, /\/skip$/, () =>
    threadCard(late, title)
      .getByRole("button", {
        name: `Skip “${task}” to its next date`,
        exact: true,
      })
      .click(),
  );
  const today = page.getByRole("region", { name: "Today", exact: true });
  await expect(threadCard(today, title)).toBeVisible();
  await expect(threadCard(late, title)).toHaveCount(0);
  await shot("repeat-card-skipped");
  expect(await logOf(d1, account, title)).toEqual([]);

  // Complete from the card: the card stays, under Tomorrow; one move_completed.
  await sent(page, /\/complete$/, () =>
    threadCard(today, title)
      .getByRole("button", { name: `Complete “${task}”`, exact: true })
      .click(),
  );
  const tomorrow = page.getByRole("region", { name: "Tomorrow", exact: true });
  await expect(threadCard(tomorrow, title)).toContainText(task);
  await page.reload();
  await expect(threadCard(tomorrow, title)).toContainText(task);
  await expect(
    threadCard(tomorrow, title).locator("[data-slot=repeat-glyph]"),
  ).toBeVisible();
  await shot("repeat-card-completed");
  expect(await logOf(d1, account, title)).toEqual([
    { type: "move_completed", n: 1 },
  ]);

  // Drawer (1024x768): the same picker sets a custom Every N days with its stepper.
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole("link", { name: title, exact: true }).click();
  const drawer = page.getByRole("dialog", { name: title });
  await expect(drawer).toBeVisible();
  // The drawer's content exists before it stops sliding; a click before then lands elsewhere (issue #449).
  await settled(drawer);
  await dateToken(drawer, task, "Tomorrow").click();
  await picker
    .getByRole("button", { name: "Repeat, Daily", exact: true })
    .click();
  await picker.getByRole("button", { name: "Custom…", exact: true }).click();
  const custom = picker.getByRole("group", { name: "Custom repeat" });
  await custom.getByRole("button", { name: "More days", exact: true }).click();
  await custom.getByRole("button", { name: "More days", exact: true }).click();
  await expect(custom).toContainText("Every 3 days, from ");
  await shot("repeat-picker-drawer");
  await sent(page, /\/repeat$/, () =>
    custom.getByRole("button", { name: "Save repeat", exact: true }).click(),
  );
  await expect(
    picker.getByRole("button", { name: "Repeat, Every 3 days", exact: true }),
  ).toBeVisible();

  // Escape closes the picker alone; the drawer stays.
  await closeDatePicker(page);
  await settled(drawer);
  await expect(drawer).toHaveAttribute("data-state", "open");
  const every3 = drawer.getByRole("img", {
    name: "Repeats every 3 days",
    exact: true,
  });
  await expect(every3).toBeVisible();
  await page.reload();
  await expect(drawer).toBeVisible();
  await expect(every3).toBeVisible();
  await closeThread(drawer);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("monthly on the 31st falls on a shorter month's last day, then back on the 31st", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Repeat M ${stamp}`;
  const task = `M1 ${stamp}`;
  // The first 31st, today or later, whose next month is shorter.
  const today = fromToday(0);
  let the31st: Date | undefined;
  for (let i = 0; i < 12 && the31st === undefined; i++) {
    const day = new Date(today.getFullYear(), today.getMonth() + i, 31);
    if (day.getDate() === 31 && day >= today && monthsOn(day, 1).getDate() < 31)
      the31st = day;
  }
  const first = the31st!;
  const pane = await threadWithTask(page, title, task);
  const picker = datePicker(page);
  const glyph = taskRow(pane, task).getByRole("img", {
    name: "Repeats monthly on the 31st",
    exact: true,
  });

  await taskRow(pane, task).getByRole("button", { name: "Set date" }).click();
  await sent(page, /\/date$/, () => pickDate(page, first));
  const repeatNever = picker.getByRole("button", {
    name: "Repeat, Never",
    exact: true,
  });
  await expect(repeatNever).toBeEnabled();
  await repeatNever.click();
  const preset = picker.getByRole("button", {
    name: "Every month on the 31st",
    exact: true,
  });
  await expect(preset).toBeVisible();
  await shot("repeat-picker-monthly");
  await sent(page, /\/repeat$/, () => preset.click());
  await expect(
    picker.getByRole("button", {
      name: "Repeat, Monthly on the 31st",
      exact: true,
    }),
  ).toBeVisible();
  await closeDatePicker(page);
  await expect(glyph).toBeVisible();

  // Complete: the shorter month's last day.
  const shortMonth = taskWhen(monthsOn(first, 1));
  await sent(page, /\/complete$/, () =>
    taskRow(pane, task).getByRole("button", { name: "Complete task" }).click(),
  );
  await expect(dateToken(pane, task, shortMonth)).toBeVisible();
  await page.reload();
  await expect(dateToken(pane, task, shortMonth)).toBeVisible();
  await expect(glyph).toBeVisible();
  await shot("repeat-monthly-short-month");

  // Complete again: back on the 31st.
  const back = taskWhen(
    new Date(first.getFullYear(), first.getMonth() + 2, 31),
  );
  await sent(page, /\/complete$/, () =>
    taskRow(pane, task).getByRole("button", { name: "Complete task" }).click(),
  );
  await expect(dateToken(pane, task, back)).toBeVisible();
  await page.reload();
  await expect(dateToken(pane, task, back)).toBeVisible();
  await expect(glyph).toBeVisible();
  await shot("repeat-monthly-back-on-31st");
  expect(
    await d1(
      `SELECT json_extract(moves_json, '$[0].repeat') AS repeat FROM threads WHERE user_id = '${account.id}' AND title = '${title}'`,
    ),
  ).toEqual([{ repeat: '{"kind":"monthly","day":31}' }]);
  expect(await logOf(d1, account, title)).toEqual([
    { type: "move_completed", n: 2 },
  ]);
});

test("a missed monthly Task is one Late card; Complete moves it a month on, and a date change moves its day", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const title = `Repeat ML ${stamp}`;
  const task = `ML1 ${stamp}`;
  const missed = fromToday(-6);
  const pane = await threadWithTask(page, title, task);
  const picker = datePicker(page);

  // Dated six days ago through the picker, every month on that day.
  await taskRow(pane, task).getByRole("button", { name: "Set date" }).click();
  await sent(page, /\/date$/, () => pickDate(page, missed));
  const day = ordinal(missed.getDate());
  await setRepeat(page, `Every month on the ${day}`, `Monthly on the ${day}`);
  await closeDatePicker(page);
  await closeThread(pane);

  // One Late card, with the glyph.
  await page.reload();
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
  const late = page.getByRole("region", { name: "Late", exact: true });
  await expect(threadCard(late, title)).toHaveCount(1);
  await expect(
    page.getByRole("listitem").filter({ hasText: task }),
  ).toHaveCount(1);
  await expect(threadCard(late, title)).toContainText(task);
  await expect(
    threadCard(late, title).locator("[data-slot=repeat-glyph]"),
  ).toBeVisible();
  await shot("repeat-monthly-late");

  // Complete from the card: a month on from its date.
  await sent(page, /\/complete$/, () =>
    threadCard(late, title)
      .getByRole("button", { name: `Complete “${task}”`, exact: true })
      .click(),
  );
  await expect(threadCard(late, title)).toHaveCount(0);
  await page.reload();
  const link = page.getByRole("link", { name: title });
  await expect(link).toBeVisible();
  await expect(threadCard(late, title)).toHaveCount(0);
  await link.click();
  await expect(pane).toBeVisible();
  const next = monthsOn(missed, 1);
  await expect(dateToken(pane, task, taskWhen(next))).toBeVisible();
  await shot("repeat-monthly-late-completed");

  // Change the date a week later: the monthly day follows it, and the next Complete lands a month after the new date.
  const moved = new Date(next);
  moved.setDate(moved.getDate() + 7);
  await settled(pane);
  await dateToken(pane, task, taskWhen(next)).click();
  await sent(page, /\/date$/, () => pickDate(page, moved));
  await expect(
    picker.getByRole("button", {
      name: `Repeat, Monthly on the ${ordinal(moved.getDate())}`,
      exact: true,
    }),
  ).toBeVisible();
  await shot("repeat-monthly-date-changed");
  await closeDatePicker(page);
  await page.reload();
  await expect(dateToken(pane, task, taskWhen(moved))).toBeVisible();
  await sent(page, /\/complete$/, () =>
    taskRow(pane, task).getByRole("button", { name: "Complete task" }).click(),
  );
  await page.reload();
  await expect(
    dateToken(pane, task, taskWhen(monthsOn(moved, 1))),
  ).toBeVisible();
  await shot("repeat-monthly-changed-completed");
  expect(await logOf(d1, account, title)).toEqual([
    { type: "move_completed", n: 2 },
  ]);
});
