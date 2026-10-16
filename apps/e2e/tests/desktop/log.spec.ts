// The desktop app's log (#484), run with: bun run test:e2e:desktop tests/desktop/log.spec.ts
// The fixture's user-data folder holds the log too (logs/main.log), never ~/Library/Logs.
import type { ElectronApplication } from "@playwright/test";

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

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

test("main and the window's errors go to the log, Help shows it, and a crashed window offers to reload", async ({
  desktop,
  stamp,
}) => {
  const page = await desktop.launch();
  const app = desktop.app();
  const logPath = join(desktop.userData, "logs", "main.log");
  const logged = () =>
    existsSync(logPath) ? readFileSync(logPath, "utf8") : "";

  // Main's own output: the launch backup.
  await expect.poll(logged).toContain("Vita OS backed up your data to");

  await page.evaluate((stamp) => {
    console.error(`Something broke ${stamp}`);
    console.info(`Just chatter ${stamp}`);
  }, stamp);
  await expect
    .poll(logged)
    .toMatch(new RegExp(`error Window: Something broke ${stamp}`));
  expect(logged()).not.toContain(`Just chatter ${stamp}`);

  await app.evaluate(({ dialog, shell }) => {
    const recorded = globalThis as { shown?: string[]; messages?: string[] };
    recorded.shown = [];
    recorded.messages = [];
    shell.showItemInFolder = (path) => void recorded.shown?.push(path);
    dialog.showMessageBox = (async (...args: unknown[]) => {
      const options = args.at(-1) as Electron.MessageBoxOptions;
      recorded.messages?.push(options.message);
      return { response: 0, checkboxChecked: false };
    }) as typeof dialog.showMessageBox;
  });
  await clickMenu(app, ["Help", "Show Logs"]);
  expect(
    await app.evaluate(() => (globalThis as { shown?: string[] }).shown),
  ).toEqual([realpathSync(logPath)]);

  // The renderer dies; the dialog's Reload (stubbed above) brings the Dashboard back.
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.webContents.forcefullyCrashRenderer(),
  );
  await expect
    .poll(() =>
      app.evaluate(() => (globalThis as { messages?: string[] }).messages),
    )
    .toEqual(["Vita OS's window stopped working"]);
  await expect
    .poll(logged)
    .toMatch(/Vita OS's window stopped: (crashed|killed) /);
  await expect
    .poll(() =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.webContents.executeJavaScript(
          `document.querySelector("header")?.getAttribute("aria-label") ?? null`,
        ),
      ),
    )
    .toBe("Vita OS");
});
