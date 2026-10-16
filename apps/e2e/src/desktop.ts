// The desktop app (apps/desktop), built, on a throwaway user-data folder per test. No web stack, no account.
// Launches in one test share the folder, so `quit()` then `launch()` reopens the same data.
// No native error dialog is shown (src/desktop-dialog-stub.cjs), and teardown kills whatever didn't quit.
import {
  _electron,
  test as base,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { ROOT, VERIFY_DIR } from "./instance.ts";

export { expect };

export const DESKTOP_DIR = join(ROOT, "apps/desktop");
export const DESKTOP_OUT = join(VERIFY_DIR, "desktop");

/** The Electron binary the desktop app depends on (downloaded on first use). */
const electronPath = createRequire(join(DESKTOP_DIR, "package.json"))(
  "electron",
) as string;

const DIALOG_STUB = join(ROOT, "apps/e2e/src/desktop-dialog-stub.cjs");

/** Where the stub writes each error dialog's title and content instead of showing it. */
const dialogLog = (userData: string) => join(userData, "dialogs.log");

/**
 * Electron's default app, which runs an unpackaged app from its path, requires `--require`
 * modules inside Electron before the app's main. (NODE_OPTIONS won't do: Playwright drops it,
 * and its preloads run before `electron` can be required.)
 */
const DESKTOP_ARGS = ["--require", DIALOG_STUB, DESKTOP_DIR];

/** A host shell may set ELECTRON_RUN_AS_NODE, which turns Electron into Node, so it is dropped. */
function desktopEnv(
  userData: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") env[key] = value;
  }
  return {
    ...env,
    VITA_DESKTOP_USER_DATA: userData,
    VITA_TEST_DIALOG_LOG: dialogLog(userData),
    ...extra,
  };
}

/** A desktop process started outside Playwright: a second launch, or one that fails to start. */
export type DesktopProcess = {
  process: ChildProcess;
  /** Resolves with the exit code once the process has ended. */
  exited: Promise<number | null>;
  /** Everything it wrote to stderr so far. */
  stderr(): string;
};

const QUIT_TIMEOUT_MS = 5_000;

/**
 * Ends `child`: `graceful` first (SIGTERM by default), then SIGKILL if it is still up after a few
 * seconds, as when main is stuck in a modal. Resolves once the process has exited.
 */
export async function stop(
  child: ChildProcess,
  graceful: () => Promise<unknown> = async () => child.kill("SIGTERM"),
): Promise<"quit" | "killed"> {
  if (child.exitCode !== null || child.signalCode !== null) return "quit";
  const exited = new Promise<"quit">((resolve) =>
    child.once("exit", () => resolve("quit")),
  );
  graceful().catch(() => undefined);
  let timer: NodeJS.Timeout | undefined;
  const outcome = await Promise.race([
    exited,
    new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), QUIT_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timer);
  if (outcome === "quit") return "quit";
  child.kill("SIGKILL");
  await exited;
  return "killed";
}

export type Desktop = {
  /** This test's user-data folder; `vita.db` lives in it. */
  userData: string;
  /** Launches the app and returns its window once the Dashboard's chrome is up. `env` adds to its environment. */
  launch(options?: { env?: Record<string, string> }): Promise<Page>;
  /** Quits as Command-Q does and waits for the process to end; fails if it had to be killed. */
  quit(): Promise<void>;
  /** Starts the app on this folder outside Playwright, e.g. a second launch or a failing start. */
  spawn(options?: { env?: Record<string, string> }): DesktopProcess;
  /** The error dialogs main would have shown, each as `<title>\n<content>\n`. */
  dialogs(): string;
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
    const spawned: ChildProcess[] = [];
    const requests: string[] = [];
    const desktop: Desktop = {
      userData,
      requests,
      async launch(options = {}) {
        if (running) throw new Error("the desktop app is already running");
        const app = await _electron.launch({
          executablePath: electronPath,
          args: DESKTOP_ARGS,
          cwd: DESKTOP_DIR,
          env: desktopEnv(userData, options.env),
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
        const app = running;
        running = undefined;
        if ((await stop(app.process(), () => app.close())) === "killed")
          throw new Error(
            `the desktop app did not quit within ${QUIT_TIMEOUT_MS}ms and was killed`,
          );
      },
      spawn(options = {}) {
        const child = spawn(electronPath, DESKTOP_ARGS, {
          cwd: DESKTOP_DIR,
          env: desktopEnv(userData, options.env),
          stdio: ["ignore", "ignore", "pipe"],
        });
        spawned.push(child);
        let stderr = "";
        child.stderr?.on("data", (chunk) => {
          stderr += String(chunk);
          process.stderr.write(chunk);
        });
        const exited = new Promise<number | null>((resolve) =>
          child.once("exit", (code) => resolve(code)),
        );
        return { process: child, exited, stderr: () => stderr };
      },
      dialogs() {
        const log = dialogLog(userData);
        return existsSync(log) ? readFileSync(log, "utf8") : "";
      },
      app() {
        if (!running) throw new Error("the desktop app is not running");
        return running;
      },
    };
    try {
      await use(desktop);
    } finally {
      const app = running;
      await Promise.all([
        app ? stop(app.process(), () => app.close()) : undefined,
        ...spawned.map((child) => stop(child)),
      ]);
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
