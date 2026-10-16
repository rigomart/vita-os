import type { LocalDatabase } from "@vita-os/local";

import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/*
 * The files main writes from the person's data: daily backups in `backups/`
 * beside the database, and the Download my data file.
 */

export const BACKUPS_KEPT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
/** `vita-2026-10-16T143005.db`, in local time, so names sort oldest first. */
const BACKUP_NAME = /^vita-(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})\.db$/;

const pad = (value: number) => String(value).padStart(2, "0");

function localDate(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function backupName(now: Date): string {
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `vita-${localDate(now)}T${time}.db`;
}

/** The backups in `folder`, newest first, as full paths. */
export function listBackups(folder: string): string[] {
  let names: string[];
  try {
    names = readdirSync(folder);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return names
    .filter((name) => BACKUP_NAME.test(name))
    .sort()
    .reverse()
    .map((name) => join(folder, name));
}

/**
 * A day after the newest backup, or now when there is none. A newest backup
 * dated after `now` means the clock moved back, and backs up again too.
 */
export function isBackupDue(newest: string | undefined, now: Date): boolean {
  const match = newest?.split("/").at(-1)?.match(BACKUP_NAME);
  if (!match) return true;
  const [, year, month, day, hours, minutes, seconds] = match.map(Number);
  const taken = new Date(year!, month! - 1, day, hours, minutes, seconds);
  const age = now.getTime() - taken.getTime();
  return age < 0 || age >= DAY_MS;
}

/** Writes a new backup, then keeps the newest {@link BACKUPS_KEPT}. */
export async function backUp(
  local: Pick<LocalDatabase, "backUpTo">,
  folder: string,
  now: Date,
): Promise<string> {
  mkdirSync(folder, { recursive: true });
  const path = join(folder, backupName(now));
  await local.backUpTo(path);
  for (const old of listBackups(folder).slice(BACKUPS_KEPT)) {
    rmSync(old, { force: true });
  }
  return path;
}

/** As the web names it. */
export function exportFileName(now: Date): string {
  return `vita-os-export-${localDate(now)}.json`;
}
