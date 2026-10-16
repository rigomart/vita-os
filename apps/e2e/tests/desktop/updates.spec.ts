// The update notice (#485), run with: bun run test:e2e:desktop tests/desktop/updates.spec.ts
// Each launch reads a releases feed the test writes as a data: URL; message boxes go to the dialog
// log (src/desktop-dialog-stub.cjs) and answer Later, unless a test stubs them in main.
import type { ElectronApplication } from "@playwright/test";

import { existsSync, readFileSync } from "node:fs";
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

const feed = (...versions: string[]) => ({
  VITA_DESKTOP_RELEASES_URL: `data:application/json,${encodeURIComponent(
    JSON.stringify(
      versions.map((version) => ({
        tag_name: `desktop-v${version}`,
        html_url: `https://github.com/rigomart/vita-os/releases/tag/desktop-v${version}`,
        draft: false,
        prerelease: false,
      })),
    ),
  )}`,
});

const notice = (version: string) =>
  `Vita OS ${version} is available\nYou have 0.1.0. Download it from its release page, then install it as before: open the .dmg and drag Vita OS into Applications. Your data stays where it is.\n`;

const count = (text: string, part: string) => text.split(part).length - 1;

test("a newer release is announced once, Check for Updates… always answers, and the daily check can be turned off", async ({
  desktop,
}) => {
  const preferences = () =>
    JSON.parse(
      readFileSync(join(desktop.userData, "preferences.json"), "utf8"),
    );

  await desktop.launch({ env: feed("0.1.0", "0.2.0") });
  await expect.poll(() => count(desktop.dialogs(), notice("0.2.0"))).toBe(1);
  expect(preferences().announcedVersion).toBe("0.2.0");
  await desktop.quit();

  // Already announced: the next launch stays quiet.
  await desktop.launch({ env: feed("0.1.0", "0.2.0") });
  const app = desktop.app();
  await expect
    .poll(() => existsSync(join(desktop.userData, "logs", "main.log")))
    .toBe(true);
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(count(desktop.dialogs(), notice("0.2.0"))).toBe(1);

  // Asking says so again, and Download opens the release's page.
  await app.evaluate(({ dialog, shell }) => {
    const recorded = globalThis as { opened?: string[] };
    recorded.opened = [];
    shell.openExternal = async (url) => void recorded.opened?.push(url);
    const record = dialog.showMessageBox;
    dialog.showMessageBox = (async (...args: Parameters<typeof record>) => {
      await record(...args);
      return { response: 0, checkboxChecked: false };
    }) as typeof dialog.showMessageBox;
  });
  await clickMenu(app, ["Vita OS", "Check for Updates…"]);
  await expect.poll(() => count(desktop.dialogs(), notice("0.2.0"))).toBe(2);
  await expect
    .poll(() =>
      app.evaluate(() => (globalThis as { opened?: string[] }).opened),
    )
    .toEqual([
      "https://github.com/rigomart/vita-os/releases/tag/desktop-v0.2.0",
    ]);

  await clickMenu(app, ["Vita OS", "Check for Updates Automatically"]);
  await expect.poll(() => preferences().checkForUpdates).toBe(false);
  await desktop.quit();

  // Off: even a newer release isn't announced.
  await desktop.launch({ env: feed("0.3.0") });
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  expect(desktop.dialogs()).not.toContain("Vita OS 0.3.0 is available");
  expect(
    await desktop
      .app()
      .evaluate(
        ({ Menu }) =>
          Menu.getApplicationMenu()?.items[0]?.submenu?.items.find(
            (item) => item.label === "Check for Updates Automatically",
          )?.checked,
      ),
  ).toBe(false);
});

test("Check for Updates… says when the app is up to date, and when GitHub can't be reached", async ({
  desktop,
}) => {
  await desktop.launch({ env: feed("0.1.0") });
  await clickMenu(desktop.app(), ["Vita OS", "Check for Updates…"]);
  await expect
    .poll(() => desktop.dialogs())
    .toBe("Vita OS is up to date\nYou have 0.1.0, the newest version.\n");
  await desktop.quit();

  // Fetch refuses port 9 outright: the daily check only logs it, asking shows it.
  await desktop.launch({
    env: { VITA_DESKTOP_RELEASES_URL: "http://127.0.0.1:9/" },
  });
  const logPath = join(desktop.userData, "logs", "main.log");
  await expect
    .poll(() => (existsSync(logPath) ? readFileSync(logPath, "utf8") : ""))
    .toContain("Vita OS couldn't check for updates");
  expect(desktop.dialogs()).not.toContain("couldn't check");
  await clickMenu(desktop.app(), ["Vita OS", "Check for Updates…"]);
  await expect
    .poll(() => desktop.dialogs())
    .toContain(
      "Vita OS couldn't check for updates\nGitHub couldn't be reached. Releases are also at https://github.com/rigomart/vita-os/releases.\n",
    );
});
