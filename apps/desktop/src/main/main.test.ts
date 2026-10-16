import { DamagedDatabaseError, MigrationFailedError } from "@vita-os/local";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

import { contextMenuTemplate } from "./context-menu.ts";
import {
  BACKUPS_KEPT,
  backUp,
  backupName,
  exportFileName,
  isBackupDue,
  listBackups,
} from "./data-files.ts";
import { opensExternally, originOf } from "./links.ts";
import { captureConsole, openLog } from "./log.ts";
import { preferencesStore, readPreferences } from "./preferences.ts";
import {
  compareVersions,
  newerRelease,
  newestDesktopRelease,
} from "./releases.ts";
import { startupFailure } from "./startup-failure.ts";
import { placementOnScreen } from "./window-placement.ts";

describe("links that leave the app", () => {
  it("open web pages and email elsewhere, as the product's Markdown allows, and nothing else", () => {
    for (const url of [
      "https://example.com/a",
      "http://example.com",
      "mailto:a@b.c",
      "MAILTO:a@b.c",
    ]) {
      expect(opensExternally(url), url).toBe(true);
    }
    for (const url of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "app://vita/",
      "vscode://file/x",
      "",
    ]) {
      expect(opensExternally(url), url).toBe(false);
    }
  });

  it("names the app's own origin, which URL reports as null for app:", () => {
    expect(originOf("app://vita/threads/x?y=1")).toBe("app://vita");
    expect(originOf("http://localhost:5175/")).toBe("http://localhost:5175");
    expect(originOf("not a url")).toBeNull();
  });
});

describe("a failed start", () => {
  const backup = "/data/vita.db.before-0009_next";

  it("names the copy taken before a failed migration", () => {
    const error = new MigrationFailedError("0009_next.sql", [], backup, {
      cause: new Error("no such table"),
    });
    expect(startupFailure(error)).toEqual({
      title: "Vita OS couldn't start",
      content: `${error.message}\n\nA copy of your data from before this update is at:\n${backup}`,
    });
  });

  it("names the copy a successful migration took when a later step fails", () => {
    expect(
      startupFailure(new Error("ERR_FAILED loading app://vita/"), {
        migrationBackup: backup,
      }),
    ).toEqual({
      title: "Vita OS couldn't start",
      content: `ERR_FAILED loading app://vita/\n\nA copy of your data from before this update is at:\n${backup}`,
    });
  });

  it("says only what went wrong when no copy was taken", () => {
    expect(startupFailure(new Error("disk full")).content).toBe("disk full");
    expect(startupFailure("disk full", {}).content).toBe("disk full");
  });

  it("names the newest backup, and how to go back to it, when the data file is damaged", () => {
    const damaged = new DamagedDatabaseError("/data/vita.db", [
      "database disk image is malformed",
    ]);
    const newest = "/data/backups/vita-2026-10-15T090000.db";
    expect(startupFailure(damaged, { newestBackup: newest }).content).toBe(
      `${damaged.message}\n\nThe newest backup is at:\n${newest}\n\nTo go back to it, replace vita.db with a copy of that file, named vita.db, and open Vita OS again.`,
    );
    expect(startupFailure(damaged, {}).content).toBe(
      `${damaged.message}\n\nThere is no backup of it yet.`,
    );
  });
});

describe("right-click", () => {
  const actions = {
    replaceMisspelling: vi.fn(),
    addToDictionary: vi.fn(),
    openLink: vi.fn(),
    copyLink: vi.fn(),
  };
  const editFlags = {
    canUndo: false,
    canRedo: false,
    canCut: true,
    canCopy: true,
    canPaste: true,
    canDelete: true,
    canSelectAll: true,
    canEditRichly: false,
  };
  const nowhere = {
    misspelledWord: "",
    dictionarySuggestions: [],
    isEditable: false,
    editFlags,
    selectionText: "",
    linkURL: "",
  };
  const labels = (params: Partial<typeof nowhere>) =>
    contextMenuTemplate({ ...nowhere, ...params }, actions).map(
      (item) => item.label ?? item.role ?? item.type,
    );

  it("offers nothing on the page itself, and Copy on selected text", () => {
    expect(labels({})).toEqual([]);
    expect(labels({ selectionText: "  " })).toEqual([]);
    expect(labels({ selectionText: "milk" })).toEqual(["copy"]);
  });

  it("offers spelling, then editing, on a misspelled word in a Note", () => {
    const template = contextMenuTemplate(
      {
        ...nowhere,
        isEditable: true,
        misspelledWord: "mlik",
        dictionarySuggestions: ["milk", "mild"],
      },
      actions,
    );
    expect(
      template.map((item) => item.label ?? item.role ?? item.type),
    ).toEqual([
      "milk",
      "mild",
      "Learn Spelling",
      "separator",
      "cut",
      "copy",
      "paste",
      "selectAll",
    ]);
    template[0]?.click?.(undefined as never, undefined, undefined as never);
    expect(actions.replaceMisspelling).toHaveBeenCalledWith("milk");
    template[2]?.click?.(undefined as never, undefined, undefined as never);
    expect(actions.addToDictionary).toHaveBeenCalledWith("mlik");
    expect(labels({ misspelledWord: "zzxq" })).toEqual([
      "No Guesses Found",
      "Learn Spelling",
    ]);
  });

  it("offers a link's actions only for links that may leave the app", () => {
    expect(labels({ linkURL: "https://example.com" })).toEqual([
      "Open Link",
      "Copy Link",
    ]);
    expect(labels({ linkURL: "app://vita/threads/x" })).toEqual([]);
    expect(labels({ linkURL: "javascript:alert(1)" })).toEqual([]);
  });

  it("follows what the field allows", () => {
    const template = contextMenuTemplate(
      {
        ...nowhere,
        isEditable: true,
        editFlags: { ...editFlags, canCut: false, canPaste: false },
      },
      actions,
    );
    expect(template.map((item) => [item.role, item.enabled])).toEqual([
      ["cut", false],
      ["copy", true],
      ["paste", false],
      ["selectAll", true],
    ]);
  });
});

describe("where the window reopens", () => {
  const laptop = { x: 0, y: 0, width: 1512, height: 944 };
  const external = { x: 1512, y: 0, width: 2560, height: 1415 };
  const saved = { x: 1800, y: 100, width: 1200, height: 800, maximized: false };

  it("where it was, while that display is still there", () => {
    expect(placementOnScreen(saved, [laptop, external])).toBe(saved);
  });

  it("at the default place once its display is gone, or nothing was saved", () => {
    expect(placementOnScreen(saved, [laptop])).toBeUndefined();
    expect(placementOnScreen(undefined, [laptop])).toBeUndefined();
  });

  it("where it was when enough of it is still on screen to drag back", () => {
    expect(placementOnScreen({ ...saved, x: 1412 }, [laptop])).toBeDefined();
    expect(placementOnScreen({ ...saved, x: 1462 }, [laptop])).toBeUndefined();
  });
});

describe("preferences", () => {
  const folder = mkdtempSync(join(tmpdir(), "vita-preferences-"));
  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  const defaults = {
    theme: "system",
    window: undefined,
    checkForUpdates: true,
    announcedVersion: undefined,
  };

  it("start from the defaults, and keep what was changed across launches", () => {
    const path = join(folder, "kept.json");
    expect(preferencesStore(path).get()).toEqual(defaults);
    const window = { x: 10, y: 20, width: 900, height: 700, maximized: true };
    preferencesStore(path).update({ theme: "dark", window });
    preferencesStore(path).update({
      checkForUpdates: false,
      announcedVersion: "0.2.0",
    });
    expect(readPreferences(path)).toEqual({
      theme: "dark",
      window,
      checkForUpdates: false,
      announcedVersion: "0.2.0",
    });
  });

  it("fall back to the defaults, saying so, for a file they can't read", () => {
    const path = join(folder, "broken.json");
    writeFileSync(path, "{ not json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(readPreferences(path)).toEqual(defaults);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();

    writeFileSync(path, JSON.stringify({ theme: "sepia", window: { x: "1" } }));
    expect(readPreferences(path)).toEqual(defaults);
  });
});

describe("backups", () => {
  const folder = mkdtempSync(join(tmpdir(), "vita-backups-"));
  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  it("are named for the local time they were taken, so the newest sorts first", () => {
    expect(backupName(new Date(2026, 9, 6, 9, 5, 3))).toBe(
      "vita-2026-10-06T090503.db",
    );
    expect(exportFileName(new Date(2026, 0, 2, 23, 59))).toBe(
      "vita-os-export-2026-01-02.json",
    );
  });

  it("are due a day after the newest, or when there is none or the clock went back", () => {
    const newest = join(folder, "vita-2026-10-15T090000.db");
    expect(isBackupDue(undefined, new Date(2026, 9, 15))).toBe(true);
    expect(isBackupDue(newest, new Date(2026, 9, 16, 8, 59))).toBe(false);
    expect(isBackupDue(newest, new Date(2026, 9, 16, 9, 0))).toBe(true);
    expect(isBackupDue(newest, new Date(2026, 9, 14))).toBe(true);
  });

  it("keep the newest ten, and nothing else in the folder is touched", async () => {
    writeFileSync(join(folder, "notes.txt"), "mine");
    const local = {
      backUpTo: async (path: string) => writeFileSync(path, "copy"),
    };
    for (let day = 1; day <= 12; day += 1) {
      await backUp(local, folder, new Date(2026, 9, day, 12));
    }
    const kept = listBackups(folder).map((path) => path.split("/").at(-1));
    expect(kept).toHaveLength(BACKUPS_KEPT);
    expect(kept[0]).toBe("vita-2026-10-12T120000.db");
    expect(kept.at(-1)).toBe("vita-2026-10-03T120000.db");
    expect(readdirSync(folder)).toContain("notes.txt");
    expect(listBackups(join(folder, "missing"))).toEqual([]);
  });
});

describe("the log", () => {
  const folder = mkdtempSync(join(tmpdir(), "vita-log-"));
  afterAll(() => rmSync(folder, { recursive: true, force: true }));

  it("rolls over once past its size, so at most two files' worth is kept", () => {
    const log = openLog(folder, 200);
    for (let line = 1; line <= 12; line += 1) {
      log.write(
        "info",
        `line ${String(line).padStart(2, "0")} ${"x".repeat(30)}`,
      );
    }
    const current = readFileSync(join(folder, "main.log"), "utf8");
    const old = readFileSync(join(folder, "main.old.log"), "utf8");
    expect(current.length).toBeLessThanOrEqual(200);
    expect(old.length).toBeLessThanOrEqual(200);
    expect(current).toMatch(/ info  line 12 x+\n$/);
    expect(readdirSync(folder).sort()).toEqual(["main.log", "main.old.log"]);
  });

  it("keeps what main's console says, and the console still prints it", () => {
    const log = { path: "", write: vi.fn() };
    const original = { ...console };
    const print = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    captureConsole(log);
    console.error("Backup failed", new Error("disk full"));
    expect(print).toHaveBeenCalledOnce();
    expect(log.write).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("Backup failed Error: disk full"),
    );
    Object.assign(console, original);
  });
});

describe("releases", () => {
  const release = (tag: string, extra: Record<string, unknown> = {}) => ({
    tag_name: tag,
    html_url: `https://github.com/rigomart/vita-os/releases/tag/${tag}`,
    draft: false,
    prerelease: false,
    ...extra,
  });

  it("compare versions part by part, as numbers", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("0.1.2", "0.2.0")).toBeLessThan(0);
  });

  it("pick the newest published desktop release, whatever order GitHub lists them in", () => {
    expect(
      newestDesktopRelease([
        release("desktop-v0.2.0"),
        release("desktop-v0.10.0"),
        release("desktop-v0.11.0", { draft: true }),
        release("desktop-v0.12.0", { prerelease: true }),
        release("web-v9.0.0"),
        release("desktop-v1.0.0-beta.1"),
        null,
      ]),
    ).toEqual({
      version: "0.10.0",
      url: "https://github.com/rigomart/vita-os/releases/tag/desktop-v0.10.0",
    });
    expect(newestDesktopRelease([])).toBeUndefined();
    expect(() => newestDesktopRelease({ message: "rate limited" })).toThrow();
  });

  it("are newer only when ahead of the running version, and a refused answer fails", async () => {
    const answering =
      (status: number, body: unknown): typeof fetch =>
      async () =>
        new Response(JSON.stringify(body), { status });
    const list = [release("desktop-v0.2.0")];
    expect(await newerRelease("0.1.0", "feed", answering(200, list))).toEqual({
      version: "0.2.0",
      url: list[0]!.html_url,
    });
    expect(
      await newerRelease("0.2.0", "feed", answering(200, list)),
    ).toBeUndefined();
    await expect(
      newerRelease(
        "0.1.0",
        "feed",
        answering(403, { message: "rate limited" }),
      ),
    ).rejects.toThrow("GitHub answered 403");
    await expect(
      newerRelease("0.1.0", "feed", async () => {
        throw new TypeError("fetch failed");
      }),
    ).rejects.toThrow("GitHub couldn't be reached.");
  });
});
