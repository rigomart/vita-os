// Backups and Download my data on desktop (#483), run with: bun run test:e2e:desktop tests/desktop/your-data.spec.ts
// Native dialogs are replaced in main for the test: the save dialog answers with a path, message boxes with OK.
import type { ElectronApplication } from "@playwright/test";

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { noteView, openNote } from "../../src/app.ts";
import { expect, test } from "../../src/desktop.ts";

async function clickMenu(app: ElectronApplication, path: string[]) {
  await app.evaluate(({ Menu }, path) => {
    let items = Menu.getApplicationMenu()?.items ?? [];
    let item: Electron.MenuItem | undefined;
    for (const label of path) {
      item = items.find((candidate) => candidate.label === label);
      if (!item) throw new Error(`No menu item ${path.join(" → ")}`);
      items = item.submenu?.items ?? [];
    }
    item?.click();
  }, path);
}

/** Save dialogs answer `savePath`; message boxes are recorded and answer OK. */
async function stubDialogs(app: ElectronApplication, savePath: string) {
  await app.evaluate(({ dialog }, savePath) => {
    const recorded = globalThis as { messages?: string[] };
    recorded.messages = [];
    dialog.showSaveDialog = (async () => ({
      canceled: false,
      filePath: savePath,
    })) as typeof dialog.showSaveDialog;
    dialog.showMessageBox = (async (...args: unknown[]) => {
      const options = args.at(-1) as Electron.MessageBoxOptions;
      recorded.messages?.push(`${options.message}\n${options.detail ?? ""}`);
      return { response: 0, checkboxChecked: false };
    }) as typeof dialog.showMessageBox;
  }, savePath);
}

const backups = (userData: string) => {
  const folder = join(userData, "backups");
  return existsSync(folder)
    ? readdirSync(folder).filter((name) => name.endsWith(".db"))
    : [];
};

const sqlite = (database: string, sql: string) =>
  execFileSync("sqlite3", [database, sql]).toString().trim();

test("the data is backed up at launch and on demand, and Download my data saves the web's file", async ({
  desktop,
  stamp,
  shot,
}) => {
  const body = `Backed up note ${stamp}`;
  const page = await desktop.launch();
  const app = desktop.app();

  // Launch backs up a database that has none yet.
  await expect.poll(() => backups(desktop.userData)).toHaveLength(1);

  await page.getByRole("button", { name: "New note", exact: true }).click();
  await noteView(page).getByRole("textbox", { name: "Note body" }).fill(body);
  await noteView(page)
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(page.getByText("Note added", { exact: true })).toBeVisible();

  const exportPath = join(desktop.userData, "export.json");
  await stubDialogs(app, exportPath);

  // Back Up Now waits a second so its name, to the second, can't clash with launch's.
  await page.waitForTimeout(1_100);
  await clickMenu(app, ["File", "Back Up Now"]);
  await expect.poll(() => backups(desktop.userData)).toHaveLength(2);
  const newest = join(
    desktop.userData,
    "backups",
    backups(desktop.userData).sort().at(-1)!,
  );
  expect(sqlite(newest, "SELECT body FROM notes")).toBe(body);
  expect(
    await app.evaluate(() => (globalThis as { messages?: string[] }).messages),
  ).toEqual([`Your data is backed up\n${newest}`]);

  // From the product's own menu, as on the web.
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await shot("account-menu-download");
  await page.getByRole("menuitem", { name: "Download my data" }).click();
  await expect.poll(() => existsSync(exportPath)).toBe(true);
  const file = JSON.parse(readFileSync(exportPath, "utf8")) as Record<
    string,
    unknown
  >;
  expect(Object.keys(file).sort()).toEqual([
    "activity_log_entries",
    "areas",
    "exportedAt",
    "format",
    "migration",
    "notes",
    "thread_notes",
    "threads",
  ]);
  expect(file.format).toBe("vita-os-export");
  expect((file.notes as { body: string }[]).map((note) => note.body)).toEqual([
    body,
  ]);
  expect(desktop.dialogs()).toBe("");
});

test("a damaged data file opens nothing, and the error names the newest backup", async ({
  desktop,
  stamp,
}) => {
  const body = `Before the damage ${stamp}`;
  const page = await desktop.launch();
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await noteView(page).getByRole("textbox", { name: "Note body" }).fill(body);
  await noteView(page)
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await expect(openNote(page, body)).toBeVisible();
  await expect.poll(() => backups(desktop.userData)).toHaveLength(1);
  await desktop.quit();

  const database = join(desktop.userData, "vita.db");
  writeFileSync(database, "this is not a database ".repeat(500));
  const app = desktop.spawn();
  expect(await app.exited).toBe(1);

  const newest = join(
    desktop.userData,
    "backups",
    backups(desktop.userData)[0]!,
  );
  expect(desktop.dialogs()).toContain(`${database} is damaged:`);
  expect(desktop.dialogs()).toContain(
    `The newest backup is at:\n${newest}\n\nTo go back to it, replace vita.db with a copy of that file, named vita.db, and open Vita OS again.`,
  );
  expect(readFileSync(database, "utf8")).toBe(
    "this is not a database ".repeat(500),
  );
});
