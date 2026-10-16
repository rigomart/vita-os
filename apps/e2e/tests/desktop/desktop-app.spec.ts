// The desktop app (#471), run with: bun run test:e2e:desktop tests/desktop/desktop-app.spec.ts
// Each test gets its own user-data folder; quit() then launch() reopens the same data.
import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { noteView, openNote } from "../../src/app.ts";
import { expect, test } from "../../src/desktop.ts";

test("offline, a Note written on desktop survives quit and relaunch, with no sign-in and no Sign out", async ({
  desktop,
  stamp,
  shot,
}) => {
  const body = `Desktop note ${stamp}`;

  let page = await desktop.launch();
  await desktop.app().context().setOffline(true);
  await expect(page).toHaveURL("app://vita/");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "Appearance" }),
  ).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // There is no HTTP to wait on: the success toast is the write's answer.
  await page.getByRole("button", { name: "New note", exact: true }).click();
  const editor = noteView(page).getByRole("textbox", { name: "Note body" });
  await editor.fill(body);
  await noteView(page)
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(page.getByText("Note added", { exact: true })).toBeVisible();
  await shot("desktop-note-before-quit");

  await desktop.quit();
  page = await desktop.launch();
  await expect(openNote(page, body)).toBeVisible();
  await shot("desktop-note-after-relaunch");

  // Everything the window loaded came from the app's own files.
  expect(
    desktop.requests.filter((url) => !url.startsWith("app://vita/")),
  ).toEqual([]);
});

test("a database from a newer app is refused with the error dialog, and left unchanged", async ({
  desktop,
}) => {
  const database = join(desktop.userData, "vita.db");
  const sqlite = (sql: string) =>
    execFileSync("sqlite3", [database, sql]).toString().trim();
  sqlite(
    "CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL); INSERT INTO d1_migrations (name) VALUES ('9999_from_the_future.sql');",
  );

  // The fixture writes the dialog out instead of showing it; main then quits as after a dismissal.
  const app = desktop.spawn();
  expect(await app.exited).toBe(1);
  expect(desktop.dialogs()).toBe(
    `Vita OS couldn't start\n${database} has migrations this app doesn't know: 9999_from_the_future.sql. It was written by a newer version. Nothing was changed.\n`,
  );
  expect(
    sqlite(
      "SELECT group_concat(name) FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'",
    ),
  ).toBe("d1_migrations");
});
