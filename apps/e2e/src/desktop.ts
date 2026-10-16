// The desktop app (apps/desktop), built, on a throwaway user-data folder per test. No web stack, no account.
// Launches in one test share the folder, so `quit()` then `launch()` reopens the same data.
import {
  _electron,
  test as base,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { ROOT, VERIFY_DIR } from "./instance.ts";

export { expect };

export const DESKTOP_DIR = join(ROOT, "apps/desktop");
export const DESKTOP_OUT = join(VERIFY_DIR, "desktop");

/** The Electron binary the desktop app depends on (downloaded on first use). */
export const electronPath = createRequire(join(DESKTOP_DIR, "package.json"))(
  "electron",
) as string;

/** What the desktop app is launched with; a host shell may set ELECTRON_RUN_AS_NODE, which turns Electron into Node. */
export function desktopEnv(userData: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") env[key] = value;
  }
  return { ...env, VITA_DESKTOP_USER_DATA: userData };
}

export type Desktop = {
  /** This test's user-data folder; `vita.db` lives in it. */
  userData: string;
  /** Launches the app and returns its window once the Dashboard's chrome is up. */
  launch(): Promise<Page>;
  /** Quits as Command-Q does and waits for the process to end. */
  quit(): Promise<void>;
  /** The running app, for a look into main. */
  app(): ElectronApplication;
  /** Every URL a window requested, across launches. */
  requests: string[];
};

type Fixtures = {
  desktop: Desktop;
  /** Unique per test, so a check never matches another test's rows. */
  stamp: string;
  /** Saves `<label>.png` of the window to the evidence dir and attaches it to the test. */
  shot: (label: string) => Promise<string>;
};

export const test = base.extend<Fixtures>({
  // oxlint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern
  desktop: async ({}, use) => {
    const userData = mkdtempSync(join(tmpdir(), "vita-desktop-"));
    let running: ElectronApplication | undefined;
    const requests: string[] = [];
    const desktop: Desktop = {
      userData,
      requests,
      async launch() {
        if (running) throw new Error("the desktop app is already running");
        const app = await _electron.launch({
          executablePath: electronPath,
          args: [DESKTOP_DIR],
          cwd: DESKTOP_DIR,
          env: desktopEnv(userData),
        });
        running = app;
        app
          .process()
          .stderr?.on("data", (chunk) => process.stderr.write(chunk));
        app.context().on("request", (request) => requests.push(request.url()));
        const window = await app.firstWindow();
        await expect(
          window.getByRole("banner", { name: "Vita OS" }),
        ).toBeVisible();
        return window;
      },
      async quit() {
        if (!running) throw new Error("the desktop app is not running");
        await running.close();
        running = undefined;
      },
      app() {
        if (!running) throw new Error("the desktop app is not running");
        return running;
      },
    };
    try {
      await use(desktop);
    } finally {
      await running?.close();
      rmSync(userData, { recursive: true, force: true });
    }
  },
  // oxlint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern
  stamp: async ({}, use) =>
    use(`${Date.now().toString(36)}${randomBytes(2).toString("hex")}`),
  shot: async ({ desktop }, use, testInfo) => {
    const dir = join(
      DESKTOP_OUT,
      "evidence",
      basename(testInfo.file).replace(/\.spec\.ts$/, ""),
    );
    await use(async (label) => {
      if (!/^[\w.-]+$/.test(label))
        throw new Error(`shot label "${label}": use letters, digits, . _ -`);
      mkdirSync(dir, { recursive: true });
      const path = join(dir, `${label}.png`);
      const window = await desktop.app().firstWindow();
      await window.screenshot({ path, animations: "disabled" });
      await testInfo.attach(label, { path, contentType: "image/png" });
      return path;
    });
  },
});
