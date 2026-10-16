import { exportLocalData, type LocalDatabase } from "@vita-os/local";
import { app, type BrowserWindow, dialog, shell } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
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
  /** So quitting waits for a backup or a download being written. */
  track<T>(work: Promise<T>): Promise<T>;
  backupsFolder: string;
}

/** What the person can do with their data file from the menus: back it up, see the backups, download it. */
export function dataActions({
  local,
  window,
  track,
  backupsFolder,
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
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
