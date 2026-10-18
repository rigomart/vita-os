import {
  exportLocalData,
  importLocalData,
  type LocalDatabase,
} from "@vita-os/local";
import { app, type BrowserWindow, dialog, shell } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  backUp,
  exportFileName,
  isBackupDue,
  listBackups,
} from "./data-files.ts";

const HOUR_MS = 60 * 60 * 1000;

export interface DataActionsOptions {
  /** The open database, once main has opened it. */
  local(): LocalDatabase | undefined;
  window(): BrowserWindow | null;
  /** So quitting waits for a backup, a download or an import being written. */
  track<T>(work: Promise<T>): Promise<T>;
  backupsFolder: string;
  /** After an import, so the window shows what it brought. */
  imported(): void;
}

/** What the person can do with their data file from the menus: back it up, see the backups, download it, import the web's. */
export function dataActions({
  local,
  window,
  track,
  backupsFolder,
  imported,
}: DataActionsOptions) {
  let warnedAboutBackups = false;

  function opened(): LocalDatabase {
    const database = local();
    if (database === undefined)
      throw new Error("Vita OS is still opening your data.");
    return database;
  }

  /** Backs up when the newest backup is a day old. Says once per launch when it can't. */
  async function backUpIfDue() {
    try {
      const now = new Date();
      if (!isBackupDue(listBackups(backupsFolder)[0], now)) return;
      const path = await track(backUp(opened(), backupsFolder, now));
      console.info(`Vita OS backed up your data to ${path}`);
    } catch (error) {
      console.error("Vita OS couldn't back up your data", error);
      if (warnedAboutBackups) return;
      warnedAboutBackups = true;
      void dialog.showMessageBox({
        type: "warning",
        message: "Vita OS couldn't back up your data",
        detail: `${messageOf(error)}\n\nYour data itself is unchanged. Vita OS tries again every hour, and File → Back Up Now tries at once.`,
      });
    }
  }

  return {
    /** At launch, then every hour, back up whenever a day has passed. */
    scheduleBackups() {
      void backUpIfDue();
      setInterval(() => void backUpIfDue(), HOUR_MS);
    },

    async backUpNow() {
      try {
        const path = await track(backUp(opened(), backupsFolder, new Date()));
        const { response } = await dialog.showMessageBox({
          message: "Your data is backed up",
          detail: path,
          buttons: ["OK", "Show in Finder"],
        });
        if (response === 1) shell.showItemInFolder(path);
      } catch (error) {
        dialog.showErrorBox(
          "Vita OS couldn't back up your data",
          messageOf(error),
        );
      }
    },

    async showBackups() {
      mkdirSync(backupsFolder, { recursive: true });
      const failure = await shell.openPath(backupsFolder);
      if (failure)
        dialog.showErrorBox("Vita OS couldn't open its backups", failure);
    },

    /**
     * Saves the same file the web downloads, where the person picks. Resolves
     * when saved or cancelled; rejects when it couldn't be saved.
     */
    async downloadData(): Promise<void> {
      const options = {
        defaultPath: join(app.getPath("downloads"), exportFileName(new Date())),
        filters: [{ name: "Vita OS export", extensions: ["json"] }],
      };
      const parent = window();
      const { canceled, filePath } = await (parent
        ? dialog.showSaveDialog(parent, options)
        : dialog.showSaveDialog(options));
      if (canceled || !filePath) return;
      await track(
        exportLocalData({ db: opened().database }).then((file) =>
          writeFileSync(filePath, JSON.stringify(file)),
        ),
      );
    },

    /**
     * Imports a file the web's Download my data saved, into an empty Vita OS.
     * Says how it went in a message box; resolves when said or cancelled.
     */
    async importData(): Promise<void> {
      const options: Electron.OpenDialogOptions = {
        title: "Import from a Cloud Export",
        defaultPath: app.getPath("downloads"),
        properties: ["openFile"],
        filters: [{ name: "Vita OS export", extensions: ["json"] }],
      };
      const parent = window();
      const { canceled, filePaths } = await (parent
        ? dialog.showOpenDialog(parent, options)
        : dialog.showOpenDialog(options));
      const [filePath] = filePaths;
      if (canceled || !filePath) return;
      try {
        const counts = await track(
          readFile(filePath, "utf8").then((text) =>
            importLocalData({ db: opened().database }, text),
          ),
        );
        console.info(`Vita OS imported ${filePath}`);
        imported();
        await dialog.showMessageBox({
          message: "Your data is imported",
          detail: `${count(counts.threads, "Thread")}, ${count(counts.notes, "Note")} and ${count(counts.areas, "Area")}.`,
        });
      } catch (error) {
        console.error(`Vita OS didn't import ${filePath}`, error);
        await dialog.showMessageBox({
          type: "warning",
          message: "Your data was not imported",
          detail: messageOf(error),
        });
      }
    },
  };
}

function count(amount: number, noun: string): string {
  return `${amount} ${noun}${amount === 1 ? "" : "s"}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
