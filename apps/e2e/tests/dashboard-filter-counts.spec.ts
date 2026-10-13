// #446. One test, since every count builds on the items before it.
import {
  captureNote,
  closeThread,
  createThread,
  datePicker,
  openNote,
} from "../src/app.ts";
import { expect, test } from "../src/fixtures.ts";

test("All counts every open Thread and Standalone Note; Area and Notes filters keep their own", async ({
  page,
  stamp,
  shot,
}) => {
  const datedNote = `Dated count note ${stamp}`;
  const undatedNote = `Undated count note ${stamp}`;
  const title = `Count thread ${stamp}`;
  const filter = page.getByRole("navigation", { name: "Filter the board" });
  const count = (name: string) =>
    filter.getByRole("link", { name, exact: true });
  const threadCard = page.getByRole("link", { name: title, exact: true });

  await page.goto("/");
  await expect(count("All 0")).toBeVisible();
  await shot("dashboard-counts-before");

  await captureNote(page, datedNote, async () => {
    await datePicker(page)
      .getByRole("button", { name: "Pick a date…", exact: true })
      .click();
    await datePicker(page)
      .getByRole("grid")
      .getByRole("button", { name: /^Today, / })
      .click();
  });
  await page.reload();
  await expect(
    openNote(page.getByRole("region", { name: "Today" }), datedNote),
  ).toBeVisible();
  await expect(count("All 1")).toBeVisible();
  await expect(count("Notes 1")).toBeVisible();
  await shot("dashboard-counts-note-after");

  await captureNote(page, undatedNote);
  await page.reload();
  await expect(openNote(page, undatedNote)).toBeVisible();
  await expect(count("All 2")).toBeVisible();
  await expect(count("Notes 2")).toBeVisible();

  await closeThread(
    await createThread(page, title, { area: "Home", newArea: true }),
  );
  await page.reload();
  await expect(threadCard).toBeVisible();
  await expect(count("All 3")).toBeVisible();
  await expect(count("Home 1")).toBeVisible();
  await expect(count("No area 0")).toBeVisible();
  await expect(count("Notes 2")).toBeVisible();
  await shot("dashboard-counts-mixed-after");

  await count("Home 1").click();
  await expect(threadCard).toBeVisible();
  await expect(openNote(page, datedNote)).toBeHidden();
  await expect(openNote(page, undatedNote)).toBeHidden();
  await expect(count("All 3")).toBeVisible();
  await count("Notes 2").click();
  await expect(openNote(page, datedNote)).toBeVisible();
  await expect(openNote(page, undatedNote)).toBeVisible();
  await expect(threadCard).toBeHidden();
  await expect(count("All 3")).toBeVisible();

  await count("All 3").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(count("All 3")).toBeVisible();
  await shot("dashboard-counts-phone-after");
});
