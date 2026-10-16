// The desktop app as a Mac app (#482), run with: bun run test:e2e:desktop tests/desktop/mac-app.spec.ts
// Menus are clicked from main, as the menu bar would; right-click records the menu main would pop up.
import type { ElectronApplication } from "@playwright/test";

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { noteView } from "../../src/app.ts";
import { DESKTOP_DIR, expect, test } from "../../src/desktop.ts";

/** Clicks the menu bar item at `path`, e.g. ["File", "New Note"]. */
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

/** Every label in the menu bar, depth first. */
async function menuLabels(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(({ Menu }) => {
    const walk = (items: Electron.MenuItem[]): string[] =>
      items.flatMap((item) => [item.label, ...walk(item.submenu?.items ?? [])]);
    return walk(Menu.getApplicationMenu()?.items ?? []);
  });
}

const windowState = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow, nativeTheme }) => {
    const [window] = BrowserWindow.getAllWindows();
    return {
      bounds: window?.getBounds(),
      background: window?.getBackgroundColor(),
      themeSource: nativeTheme.themeSource,
    };
  });

test("the menu bar runs the product's actions, the window keeps its place and theme, and right-click edits", async ({
  desktop,
  shot,
}) => {
  let page = await desktop.launch();
  const app = desktop.app();

  await clickMenu(app, ["File", "Search…"]);
  await expect(
    page.getByPlaceholder("Jump to a thread, area, or action…"),
  ).toBeVisible();
  await shot("menu-search");
  await page.keyboard.press("Escape");

  await clickMenu(app, ["File", "New Thread"]);
  await expect(page.getByLabel("Thread title")).toBeVisible();
  await page.keyboard.press("Escape");

  // Right-click records the menu main would pop up: nothing on the page itself, editing in a Note.
  await app.evaluate(({ Menu }) => {
    const recorded = globalThis as { popups?: string[][] };
    recorded.popups = [];
    Menu.prototype.popup = function (this: Electron.Menu) {
      recorded.popups?.push(this.items.map((item) => item.label));
    };
  });
  const popups = () =>
    app.evaluate(() => (globalThis as { popups?: string[][] }).popups);
  await page
    .getByRole("banner", { name: "Vita OS" })
    .click({ button: "right" });

  await clickMenu(app, ["File", "New Note"]);
  const editor = noteView(page).getByRole("textbox", { name: "Note body" });
  await expect(editor).toBeVisible();
  await shot("menu-new-note");
  await editor.click({ button: "right" });
  await expect.poll(popups).toEqual([["Cut", "Copy", "Paste", "Select All"]]);
  await page.keyboard.press("Escape");
  await expect(editor).toBeHidden();

  // The page runs no script it didn't ship with.
  const inlineScriptRan = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        document.addEventListener("securitypolicyviolation", () =>
          resolve(false),
        );
        const script = document.createElement("script");
        script.textContent = "window.__inlineRan = true";
        document.head.append(script);
        setTimeout(
          () =>
            resolve((window as { __inlineRan?: boolean }).__inlineRan ?? false),
          500,
        );
      }),
  );
  expect(inlineScriptRan).toBe(false);

  // Dark in Appearance: the native window turns dark with the page.
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("menuitem", { name: "Appearance" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect
    .poll(async () => (await windowState(app)).themeSource)
    .toBe("dark");
  expect((await windowState(app)).background).toBe("#0E0F11");
  await page.keyboard.press("Escape");

  const bounds = { x: 140, y: 90, width: 1100, height: 760 };
  await app.evaluate(({ BrowserWindow }, bounds) => {
    BrowserWindow.getAllWindows()[0]?.setBounds(bounds);
  }, bounds);

  await desktop.quit();
  page = await desktop.launch();
  expect(await windowState(desktop.app())).toEqual({
    bounds,
    background: "#0E0F11",
    themeSource: "dark",
  });
  await shot("relaunched-dark-in-place");
});

test.describe("packaged", () => {
  test.use({ packaged: true });

  test("the packaged app has its icon, no developer tools, and hardened fuses", async ({
    desktop,
  }) => {
    await desktop.launch();
    const app = desktop.app();
    const labels = await menuLabels(app);
    expect(labels).toEqual(
      expect.arrayContaining(["New Note", "New Thread", "Search…"]),
    );
    expect(labels).not.toContain("Toggle Developer Tools");
    expect(labels).not.toContain("Reload");

    const bundle = join(
      DESKTOP_DIR,
      `out/Vita OS-darwin-${process.arch}/Vita OS.app`,
    );
    const iconFile = execFileSync("defaults", [
      "read",
      join(bundle, "Contents/Info.plist"),
      "CFBundleIconFile",
    ])
      .toString()
      .trim();
    expect(
      readFileSync(join(bundle, "Contents/Resources", iconFile)).equals(
        readFileSync(join(DESKTOP_DIR, "assets/icon.icns")),
      ),
    ).toBe(true);

    const fuses = execFileSync(
      "bunx",
      ["electron-fuses", "read", "--app", bundle],
      {
        cwd: DESKTOP_DIR,
      },
    )
      .toString()
      // oxlint-disable-next-line no-control-regex -- the CLI colours its output
      .replace(/\u001b\[[0-9;]*m/g, "");
    expect(fuses).toMatch(/RunAsNode is Disabled/);
    expect(fuses).toMatch(/EnableNodeOptionsEnvironmentVariable is Disabled/);
    expect(fuses).toMatch(/OnlyLoadAppFromAsar is Enabled/);
    expect(fuses).toMatch(/EnableEmbeddedAsarIntegrityValidation is Enabled/);
  });
});
