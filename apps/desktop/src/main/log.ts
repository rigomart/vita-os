import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { format } from "node:util";

/** Past this, `main.log` becomes `main.old.log` and a new one starts: at most twice this on disk. */
const MAX_BYTES = 5 * 1024 * 1024;

type Level = "info" | "warn" | "error";

export interface Log {
  path: string;
  write(level: Level, message: string): void;
}

/**
 * `main.log` in `folder`, for what a packaged app would otherwise print to a
 * console nobody sees. Nothing leaves the computer.
 */
export function openLog(folder: string, maxBytes = MAX_BYTES): Log {
  mkdirSync(folder, { recursive: true });
  const path = join(folder, "main.log");
  let size = sizeOf(path);
  return {
    path,
    write(level, message) {
      const line = `${new Date().toISOString()} ${level.padEnd(5)} ${message}\n`;
      try {
        if (size > 0 && size + Buffer.byteLength(line) > maxBytes) {
          renameSync(path, join(folder, "main.old.log"));
          size = 0;
        }
        appendFileSync(path, line);
        size += Buffer.byteLength(line);
      } catch {
        // Nowhere left to say it: the console still has it.
      }
    },
  };
}

/** Main's `console` keeps printing, and each line also goes to `log`. */
export function captureConsole(log: Log) {
  const levels = [
    ["log", "info"],
    ["info", "info"],
    ["warn", "warn"],
    ["error", "error"],
  ] as const;
  for (const [method, level] of levels) {
    const print = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      print(...args);
      log.write(level, format(...args));
    };
  }
}

function sizeOf(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}
