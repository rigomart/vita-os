import {
  createLocalApplicationClient,
  openLocalDatabase,
  type LocalDatabase,
} from "@vita-os/local";
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  screen,
  shell,
  type WebContents,
} from "electron";
import { join } from "node:path";

import {
  CALL_CHANNEL,
  COMMAND_CHANNEL,
  DOWNLOAD_DATA_CHANNEL,
  isThemeSource,
  type MenuCommand,
  THEME_CHANNEL,
} from "../bridge.ts";
import {
  APP_ORIGIN,
  registerAppScheme,
  serveRenderer,
} from "./app-protocol.ts";
import { callApplication } from "./application-calls.ts";
import { applicationMenuTemplate } from "./application-menu.ts";
import { contextMenuTemplate } from "./context-menu.ts";
import { dataActions } from "./data-actions.ts";
import { listBackups } from "./data-files.ts";
import { opensExternally, originOf } from "./links.ts";
import { preferencesStore } from "./preferences.ts";
import { startupFailure } from "./startup-failure.ts";
import { placementOnScreen } from "./window-placement.ts";

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
const preferences = preferencesStore(
  join(app.getPath("userData"), "preferences.json"),
);
/** `--surface-1` in packages/ui's globals.css, light and dark, so a resize never flashes another colour. */
const BACKGROUND = { light: "#f6f6f8", dark: "#0e0f11" };
let local: LocalDatabase | undefined;
let window: BrowserWindow | null = null;
/** Work main has started and not finished: opening the data, answering calls. Quitting waits for it. */
const inFlight = new Set<Promise<unknown>>();
let quitting = false;
const backupsFolder = join(app.getPath("userData"), "backups");
const data = dataActions({
  local: () => local,
  window: () => window,
  track,
  backupsFolder,
});

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
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      applicationMenuTemplate({
        isPackaged: app.isPackaged,
        send: sendCommand,
        backUpNow: () => void data.backUpNow(),
        showBackups: () => void data.showBackups(),
        downloadData: () =>
          void data
            .downloadData()
            .catch((error: unknown) =>
              dialog.showErrorBox(
                "Your data was not downloaded",
                error instanceof Error ? error.message : String(error),
              ),
            ),
      }),
    ),
  );
  app.setAboutPanelOptions({ applicationVersion: app.getVersion() });
  // A packaged app takes its icon from the bundle.
  if (!app.isPackaged) app.dock?.setIcon(join(appPath, "assets/icon.png"));
  nativeTheme.themeSource = preferences.get().theme;
  nativeTheme.on("updated", () => window?.setBackgroundColor(background()));

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

  data.scheduleBackups();

  const client = createLocalApplicationClient({ db: local.database });
  ipcMain.handle(CALL_CHANNEL, (event, method: unknown, input: unknown) => {
    if (!isRendererUrl(event.senderFrame?.url)) {
      throw new Error("Vita OS refused a call from outside the app.");
    }
    return track(callApplication(client, method, input));
  });
  ipcMain.handle(DOWNLOAD_DATA_CHANNEL, (event) => {
    if (!isRendererUrl(event.senderFrame?.url)) {
      throw new Error("Vita OS refused a call from outside the app.");
    }
    return data.downloadData();
  });
  ipcMain.on(THEME_CHANNEL, (event, theme: unknown) => {
    if (!isRendererUrl(event.senderFrame?.url) || !isThemeSource(theme)) return;
    nativeTheme.themeSource = theme;
    if (preferences.get().theme !== theme) preferences.update({ theme });
  });

  if (!devServerUrl) serveRenderer(join(appPath, "dist/renderer"));
  app.on("activate", showWindow);
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  if (!quitting) await openWindow();
}

async function openWindow() {
  const placement = placementOnScreen(
    preferences.get().window,
    screen.getAllDisplays().map((display) => display.workArea),
  );
  const created = new BrowserWindow({
    ...(placement
      ? {
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
        }
      : { width: 1280, height: 892 }),
    minWidth: 360,
    minHeight: 480,
    show: false,
    backgroundColor: background(),
    title: "Vita OS",
    webPreferences: {
      preload: join(appPath, "dist/preload/preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  window = created;
  if (placement?.maximized) created.maximize();
  created.on("close", () =>
    preferences.update({
      window: {
        ...created.getNormalBounds(),
        maximized: created.isMaximized(),
      },
    }),
  );
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

/**
 * The menu bar's commands go to the window's page. With the window closed
 * (macOS keeps the app running), the command reopens it and goes no further:
 * the page isn't listening yet.
 */
function sendCommand(command: MenuCommand) {
  if (window === null) {
    showWindow();
    return;
  }
  window.webContents.send(COMMAND_CHANNEL, command);
}

function background(): string {
  return nativeTheme.shouldUseDarkColors ? BACKGROUND.dark : BACKGROUND.light;
}

/** Never swallowed: the person sees why, then the app quits. */
function failStartup(error: unknown) {
  console.error("Vita OS couldn't start", error);
  const { title, content } = startupFailure(error, {
    migrationBackup: local?.migration.backupPath ?? null,
    newestBackup: newestBackup(),
  });
  dialog.showErrorBox(title, content);
  local?.close();
  app.exit(1);
}

function newestBackup(): string | undefined {
  try {
    return listBackups(backupsFolder)[0];
  } catch (error) {
    console.error("Vita OS couldn't list its backups", error);
    return undefined;
  }
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
  contents.on("context-menu", (_event, params) => {
    const template = contextMenuTemplate(params, {
      replaceMisspelling: (word) => contents.replaceMisspelling(word),
      addToDictionary: (word) =>
        contents.session.addWordToSpellCheckerDictionary(word),
      openLink: openExternally,
      copyLink: (url) => clipboard.writeText(url),
    });
    if (template.length > 0) Menu.buildFromTemplate(template).popup();
  });
}

function openExternally(url: string) {
  if (opensExternally(url)) void shell.openExternal(url);
}

function isRendererUrl(url: string | undefined): boolean {
  const origin = url === undefined ? null : originOf(url);
  return origin !== null && origin === rendererOrigin;
}
