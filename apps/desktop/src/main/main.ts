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
/** Calls main has started and not answered; quitting waits for them. */
const inFlight = new Set<Promise<unknown>>();

registerAppScheme();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.on("web-contents-created", (_event, contents) => guard(contents));
  app.whenReady().then(start).catch(failStartup);
}

async function start() {
  local = await openLocalDatabase({
    databasePath: join(app.getPath("userData"), "vita.db"),
    migrationsDirectory: join(appPath, "dist/migrations"),
  });
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
    const call = callApplication(client, method, input);
    inFlight.add(call);
    const done = () => inFlight.delete(call);
    call.then(done, done);
    return call;
  });

  if (!devServerUrl) serveRenderer(join(appPath, "dist/renderer"));
  app.on("activate", showWindow);
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("will-quit", (event) => {
    if (inFlight.size > 0) {
      event.preventDefault();
      void Promise.allSettled(inFlight).then(() => app.quit());
      return;
    }
    local?.close();
  });
  await openWindow();
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
  const { title, content } = startupFailure(error);
  dialog.showErrorBox(title, content);
  app.exit(1);
}

/** The app's pages stay on the app; web links open in the browser. */
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
  const protocol = URL.parse(url)?.protocol;
  if (protocol === "https:" || protocol === "http:") {
    void shell.openExternal(url);
  }
}

function isRendererUrl(url: string | undefined): boolean {
  const origin = url === undefined ? null : originOf(url);
  return origin !== null && origin === rendererOrigin;
}

/** `URL.origin` is "null" for a custom scheme like `app:`, so build it. */
function originOf(url: string): string | null {
  const parsed = URL.parse(url);
  return parsed ? `${parsed.protocol}//${parsed.host}` : null;
}
