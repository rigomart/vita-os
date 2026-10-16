import {
  createLocalApplicationClient,
  openLocalDatabase,
  type LocalDatabase,
} from "@vita-os/local";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type WebContents,
} from "electron";
import { join } from "node:path";

import { CALL_CHANNEL } from "../bridge.ts";
import {
  APP_ORIGIN,
  registerAppScheme,
  serveRenderer,
} from "./app-protocol.ts";
import { callApplication } from "./application-calls.ts";
import { opensExternally, originOf } from "./links.ts";
import { startupFailure } from "./startup-failure.ts";

/*
 * The desktop host: one window on the product, its data in a SQLite file in the
 * user-data folder, reached through the local client over one IPC channel.
 */

// Tests and dev keep their data out of the person's real folder.
const userDataOverride = process.env.VITA_DESKTOP_USER_DATA;
if (userDataOverride) app.setPath("userData", userDataOverride);

// Only an unpackaged app loads a dev server; a packaged one loads its own files.
const devServerUrl = app.isPackaged
  ? undefined
  : process.env.VITA_DESKTOP_RENDERER_URL;
const rendererOrigin = devServerUrl ? originOf(devServerUrl) : APP_ORIGIN;

const appPath = app.getAppPath();
let local: LocalDatabase | undefined;
let window: BrowserWindow | null = null;
/** Work main has started and not finished: opening the data, answering calls. Quitting waits for it. */
const inFlight = new Set<Promise<unknown>>();
let quitting = false;

registerAppScheme();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.on("web-contents-created", (_event, contents) => guard(contents));
  // Registered before the data opens, so a quit during the open still waits and closes it.
  app.on("before-quit", () => {
    quitting = true;
  });
  app.on("will-quit", (event) => {
    if (inFlight.size > 0) {
      event.preventDefault();
      void Promise.allSettled(inFlight).then(() => app.quit());
      return;
    }
    local?.close();
  });
  app.whenReady().then(start).catch(failStartup);
}

function track<T>(work: Promise<T>): Promise<T> {
  inFlight.add(work);
  const done = () => inFlight.delete(work);
  work.then(done, done);
  return work;
}

async function start() {
  local = await track(
    openLocalDatabase({
      databasePath: join(app.getPath("userData"), "vita.db"),
      migrationsDirectory: join(appPath, "dist/migrations"),
    }),
  );
  const { applied, backupPath } = local.migration;
  if (applied.length > 0) {
    console.info(
      `Vita OS applied ${applied.join(", ")}${backupPath ? `; the data before is at ${backupPath}` : ""}`,
    );
  }

  const client = createLocalApplicationClient({ db: local.database });
  ipcMain.handle(CALL_CHANNEL, (event, method: unknown, input: unknown) => {
    if (!isRendererUrl(event.senderFrame?.url)) {
      throw new Error("Vita OS refused a call from outside the app.");
    }
    return track(callApplication(client, method, input));
  });

  if (!devServerUrl) serveRenderer(join(appPath, "dist/renderer"));
  app.on("activate", showWindow);
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  if (!quitting) await openWindow();
}

async function openWindow() {
  const created = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 360,
    minHeight: 480,
    useContentSize: true,
    show: false,
    title: "Vita OS",
    webPreferences: {
      preload: join(appPath, "dist/preload/preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  window = created;
  created.on("closed", () => {
    if (window === created) window = null;
  });
  created.once("ready-to-show", () => created.show());
  await created.loadURL(devServerUrl ?? `${APP_ORIGIN}/`);
}

function showWindow() {
  // Still starting: the window opens when the data is ready.
  if (local === undefined) return;
  if (window === null) {
    openWindow().catch(failStartup);
    return;
  }
  if (window.isMinimized()) window.restore();
  window.focus();
}

/** Never swallowed: the person sees why, then the app quits. */
function failStartup(error: unknown) {
  console.error("Vita OS couldn't start", error);
  const { title, content } = startupFailure(
    error,
    local?.migration.backupPath ?? null,
  );
  dialog.showErrorBox(title, content);
  local?.close();
  app.exit(1);
}

/** The app's pages stay on the app; web and email links open in their own apps. */
function guard(contents: WebContents) {
  contents.on("will-navigate", (event, url) => {
    if (isRendererUrl(url)) return;
    event.preventDefault();
    openExternally(url);
  });
  contents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: "deny" };
  });
  contents.on("will-attach-webview", (event) => event.preventDefault());
}

function openExternally(url: string) {
  if (opensExternally(url)) void shell.openExternal(url);
}

function isRendererUrl(url: string | undefined): boolean {
  const origin = url === undefined ? null : originOf(url);
  return origin !== null && origin === rendererOrigin;
}
