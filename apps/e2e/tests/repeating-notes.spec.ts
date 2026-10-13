// ADR 0041, #458. Completing a Note shows no toast, so reloads prove each write.
import type { Locator, Page } from "@playwright/test";

import type { Account, D1 } from "../src/fixtures.ts";

import {
  captureNote,
  closeThread,
  createThread,
  datePicker,
  dateToken,
  fromToday,
  monthsOn,
  noteCard,
  notesCount,
  notesFilter,
  noteView,
  openHistory,
  openNote,
  pickDate,
  quickPick,
  taskRow,
} from "../src/app.ts";
import { expect, sent, test } from "../src/fixtures.ts";

/** "Nov 5", as the app labels a date. */
const short = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const today = (page: Page) => page.getByRole("region", { name: "Today" });
const glyph = (scope: Locator) =>
  scope.getByRole("img", { name: /^Repeats monthly on the / });
const completeButton = (scope: Locator) =>
  scope.getByRole("button", { name: /^Complete · back / });

async function setMonthly(page: Page, open: () => Promise<void>) {
  await open();
  await datePicker(page)
    .getByRole("button", { name: "Repeat, Never", exact: true })
    .click();
  await sent(page, /\/repeat$/, () =>
    datePicker(page)
      .getByRole("button", { name: /^Every month on the / })
      .click(),
  );
  await expect(datePicker(page)).toBeHidden();
}

/** The card's date control shows only on hover. */
async function setMonthlyFromCard(page: Page, text: string) {
  await setMonthly(page, async () => {
    await noteCard(page, text).hover();
    await noteCard(page, text)
      .getByRole("button", { name: "Change follow-up date", exact: true })
      .click();
  });
}

const repeatOf = (d1: D1, account: Account, body: string) =>
  d1<{ repeat: string | null; attention_date: number | null }>(
    `SELECT repeat, attention_date FROM notes WHERE user_id = '${account.id}' AND body = '${body}'`,
  );

test("a Today Note takes a monthly Repeat from its card and Complete moves it to next month", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const body = `Pay N ${stamp}`;

  // Compose offers the date but no Repeat.
  await page.goto("/");
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await noteView(page).getByRole("textbox", { name: "Note body" }).fill(body);
  await noteView(page)
    .getByRole("button", { name: "Follow-up date", exact: true })
    .click();
  await expect(
    datePicker(page).getByRole("button", { name: "Pick a date…" }),
  ).toBeVisible();
  await expect(
    datePicker(page).getByRole("button", { name: /Repeat/ }),
  ).toHaveCount(0);
  await shot("repeat-note-compose");
  await quickPick(page, "Today");
  await expect(datePicker(page)).toBeHidden();
  await sent(page, /\/notes$/, () =>
    noteView(page).getByRole("button", { name: "Add", exact: true }).click(),
  );
  await expect(page.getByText("Note added")).toBeVisible();
  await page.reload();

  await expect(openNote(today(page), body)).toBeVisible();
  await expect(
    noteCard(page, body).getByRole("button", { name: "Archive note" }),
  ).toBeVisible();
  await expect(completeButton(today(page))).toHaveCount(0);

  await noteCard(page, body).hover();
  await noteCard(page, body)
    .getByRole("button", { name: "Change follow-up date", exact: true })
    .click();
  await datePicker(page)
    .getByRole("button", { name: "Repeat, Never", exact: true })
    .click();
  await expect(
    datePicker(page).getByRole("button", { name: /^Every month on the / }),
  ).toBeVisible();
  await shot("repeat-note-presets");
  await sent(page, /\/repeat$/, () =>
    datePicker(page)
      .getByRole("button", { name: /^Every month on the / })
      .click(),
  );
  await expect(datePicker(page)).toBeHidden();
  await page.reload();
  await expect(openNote(today(page), body)).toBeVisible();
  await expect(glyph(noteCard(page, body))).toBeVisible();
  const next = monthsOn(fromToday(0), 1);
  await expect(
    noteCard(page, body).getByRole("button", {
      name: `Complete · back ${short(next)}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    today(page).getByRole("button", { name: "Archive note" }),
  ).toHaveCount(0);
  await noteCard(page, body).hover();
  await shot("repeat-note-card");
  expect(await repeatOf(d1, account, body)).toEqual([
    {
      repeat: JSON.stringify({ kind: "monthly", day: new Date().getDate() }),
      attention_date: expect.any(Number),
    },
  ]);

  await sent(page, /\/complete$/, () =>
    completeButton(noteCard(page, body)).click(),
  );
  await expect(openNote(today(page), body)).toHaveCount(0);
  await page.reload();
  await expect(openNote(page, body)).toBeVisible();
  await expect(openNote(today(page), body)).toHaveCount(0);
  await expect(noteCard(page, body)).toContainText(short(next));
  await shot("repeat-note-completed");
  expect(
    await d1(
      `SELECT COUNT(*) AS n FROM activity_log_entries WHERE user_id = '${account.id}' AND content LIKE '%${body}%'`,
    ),
  ).toEqual([{ n: 0 }]);
});

test("a missed repeating Note shows once under Late and Complete moves it to its next date", async ({
  page,
  stamp,
  shot,
}) => {
  const body = `Late N ${stamp}`;
  const late = fromToday(-6);
  const late1 = monthsOn(late, 1);
  const lateSection = page.getByRole("region", { name: "Late" });

  await page.goto("/");
  await captureNote(page, body, () => pickDate(page, late));
  await page.reload();
  await expect(openNote(lateSection, body)).toBeVisible();
  await setMonthlyFromCard(page, body);
  await page.reload();
  await expect(glyph(noteCard(page, body))).toBeVisible();
  await expect(openNote(page, body)).toHaveCount(1);
  await expect(openNote(lateSection, body)).toBeVisible();
  await noteCard(page, body).hover();
  await shot("repeat-note-late");

  await sent(page, /\/complete$/, () =>
    completeButton(noteCard(page, body)).click(),
  );
  await expect(openNote(lateSection, body)).toHaveCount(0);
  await page.reload();
  await expect(openNote(page, body)).toBeVisible();
  await expect(openNote(lateSection, body)).toHaveCount(0);

  await openNote(page, body).click();
  const view = noteView(page);
  await expect(view.getByText(body)).toBeVisible();
  await expect(glyph(view)).toBeVisible();
  await expect(view).toContainText(short(late1));
  await expect(
    view.getByRole("button", {
      name: `Complete · back ${short(monthsOn(late, 2))}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    view.getByRole("button", { name: "Archive", exact: true }),
  ).toBeVisible();
  await shot("repeat-note-view");
});

test("Archive takes a repeating Note into History and Unarchive brings it back with its date and Repeat", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const body = `Arch N ${stamp}`;
  const repeat = JSON.stringify({ kind: "monthly", day: new Date().getDate() });

  await page.goto("/");
  await captureNote(page, body, () => quickPick(page, "Today"));
  await page.reload();
  await setMonthlyFromCard(page, body);
  await page.reload();
  const before = await repeatOf(d1, account, body);
  expect(before).toEqual([{ repeat, attention_date: expect.any(Number) }]);

  const notes = await notesCount(page);
  await openNote(page, body).click();
  const view = noteView(page);
  await expect(completeButton(view)).toBeVisible();
  await sent(page, /\/state$/, () =>
    view.getByRole("button", { name: "Archive", exact: true }).click(),
  );
  await expect(page.getByText("Note archived")).toBeVisible();
  await expect(
    view.getByRole("button", { name: "Unarchive", exact: true }),
  ).toBeVisible();
  await expect(completeButton(view)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(view).toBeHidden();
  await page.reload();
  await expect(notesFilter(page, notes - 1)).toBeVisible();
  await expect(openNote(page, body)).toHaveCount(0);
  expect(await repeatOf(d1, account, body)).toEqual(before);

  const palette = await openHistory(page);
  await palette.getByRole("combobox").fill(body);
  const option = palette.getByRole("option").filter({ hasText: body });
  await expect(option).toBeVisible();
  await shot("repeat-note-history");
  await option.click();
  await sent(page, /\/state$/, () =>
    view.getByRole("button", { name: "Unarchive", exact: true }).click(),
  );
  await expect(page.getByText("Note unarchived")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(view).toBeHidden();

  await page.reload();
  await expect(openNote(today(page), body)).toBeVisible();
  await openNote(page, body).click();
  await expect(view.getByText(body)).toBeVisible();
  await expect(glyph(view)).toBeVisible();
  await expect(completeButton(view)).toBeVisible();
  expect(await repeatOf(d1, account, body)).toEqual(before);
});

test("clearing a repeating Note's date clears its Repeat and brings Archive back", async ({
  page,
  account,
  stamp,
  d1,
  shot,
}) => {
  const body = `Clear N ${stamp}`;

  await page.goto("/");
  await captureNote(page, body, () => quickPick(page, "Today"));
  await page.reload();
  await setMonthlyFromCard(page, body);
  await page.reload();

  await openNote(page, body).click();
  const view = noteView(page);
  await expect(glyph(view)).toBeVisible();
  await view
    .getByRole("button", { name: "Change follow-up date", exact: true })
    .click();
  await sent(page, /\/follow-up$/, () =>
    datePicker(page)
      .getByRole("button", { name: "Clear follow-up date", exact: true })
      .click(),
  );
  await expect(glyph(view)).toHaveCount(0);
  await expect(completeButton(view)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(view).toBeHidden();

  await page.reload();
  const noDate = page.getByRole("complementary", { name: "No date" });
  await expect(openNote(noDate, body)).toBeVisible();
  await noteCard(page, body).hover();
  await expect(
    noteCard(page, body).getByRole("button", { name: "Archive note" }),
  ).toBeVisible();
  await expect(glyph(noDate)).toHaveCount(0);
  await shot("repeat-note-cleared");
  expect(await repeatOf(d1, account, body)).toEqual([
    { repeat: null, attention_date: null },
  ]);
});

test("a repeating Note added to a Thread becomes a dated Task carrying the Repeat", async ({
  page,
  stamp,
  shot,
}) => {
  const title = `Repeat target ${stamp}`;
  const body = `Move N ${stamp}`;

  await page.goto("/");
  const pane = await createThread(page, title);
  await closeThread(pane);

  await captureNote(page, body, () => quickPick(page, "Tomorrow"));
  await page.reload();
  await openNote(page, body).click();
  const view = noteView(page);
  await expect(view.getByText(body)).toBeVisible();
  await setMonthly(page, () =>
    view
      .getByRole("button", { name: "Change follow-up date", exact: true })
      .click(),
  );
  await expect(completeButton(view)).toBeVisible();

  await view.getByRole("button", { name: "More actions", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Add to thread…", exact: true })
    .click();
  // The move is sent once the five-second Undo offer closes.
  await sent(page, /\/add-to-thread$/, async () => {
    await page.getByRole("option").filter({ hasText: title }).click();
    await expect(page.getByText("Note added to thread")).toBeVisible();
  });

  await page.reload();
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
  await expect(openNote(page, body)).toHaveCount(0);
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(pane).toBeVisible();
  await expect(dateToken(pane, body, "Tomorrow")).toBeVisible();
  await expect(glyph(taskRow(pane, body))).toBeVisible();
  await shot("repeat-note-added-task");
});

test("at 1024x768 the card's picker sets the Repeat and its Complete moves the Note on", async ({
  page,
  shot,
  stamp,
}) => {
  const body = `Narrow N ${stamp}`;

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await captureNote(page, body, () => quickPick(page, "Today"));
  await page.reload();
  await expect(openNote(today(page), body)).toBeVisible();
  await setMonthlyFromCard(page, body);
  await page.reload();
  await expect(glyph(noteCard(page, body))).toBeVisible();
  await expect(openNote(today(page), body)).toBeVisible();
  await noteCard(page, body).hover();
  await shot("repeat-note-card-1024");

  await sent(page, /\/complete$/, () =>
    completeButton(noteCard(page, body)).click(),
  );
  await expect(openNote(today(page), body)).toHaveCount(0);
  await page.reload();
  await expect(openNote(page, body)).toBeVisible();
  await expect(openNote(today(page), body)).toHaveCount(0);
});
