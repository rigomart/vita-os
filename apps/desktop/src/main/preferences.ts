import { readFileSync, renameSync, writeFileSync } from "node:fs";

import { isThemeSource, type ThemeSource } from "../bridge.ts";

/**
 * What the app remembers between launches, apart from the person's data:
 * `preferences.json` in the user-data folder.
 */
export interface Preferences {
  theme: ThemeSource;
  window?: WindowPlacement | undefined;
}

/** The window's normal (not maximized) frame, and whether it was maximized. */
export interface WindowPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

export interface PreferencesStore {
  get(): Preferences;
  update(change: Partial<Preferences>): void;
}

/**
 * Reads the file once and writes it whole on each change. A file it can't read
 * is logged and replaced by the defaults on the next change: losing a window
 * position or a theme is cheap, and nothing else is kept here.
 */
export function preferencesStore(path: string): PreferencesStore {
  let current = readPreferences(path);
  return {
    get: () => current,
    update(change) {
      current = { ...current, ...change };
      try {
        const temporary = `${path}.tmp`;
        writeFileSync(temporary, JSON.stringify(current, null, 2));
        renameSync(temporary, path);
      } catch (error) {
        console.error(`Vita OS couldn't save ${path}`, error);
      }
    },
  };
}

export function readPreferences(path: string): Preferences {
  let stored: unknown;
  try {
    stored = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (!isMissingFile(error)) {
      console.warn(`Vita OS ignored ${path}, which it couldn't read`, error);
    }
    stored = {};
  }
  const { theme, window } = (stored ?? {}) as Record<string, unknown>;
  return {
    theme: isThemeSource(theme) ? theme : "system",
    window: isWindowPlacement(window) ? window : undefined,
  };
}

function isWindowPlacement(value: unknown): value is WindowPlacement {
  if (typeof value !== "object" || value === null) return false;
  const { x, y, width, height, maximized } = value as Record<string, unknown>;
  return (
    [x, y, width, height].every(Number.isFinite) &&
    typeof maximized === "boolean"
  );
}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}
