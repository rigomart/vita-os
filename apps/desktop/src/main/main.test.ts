import { MigrationFailedError } from "@vita-os/local";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

import { contextMenuTemplate } from "./context-menu.ts";
import { opensExternally, originOf } from "./links.ts";
import { preferencesStore, readPreferences } from "./preferences.ts";
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
      startupFailure(new Error("ERR_FAILED loading app://vita/"), backup),
    ).toEqual({
      title: "Vita OS couldn't start",
      content: `ERR_FAILED loading app://vita/\n\nA copy of your data from before this update is at:\n${backup}`,
    });
  });

  it("says only what went wrong when no copy was taken", () => {
    expect(startupFailure(new Error("disk full")).content).toBe("disk full");
    expect(startupFailure("disk full", null).content).toBe("disk full");
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

  it("start from the defaults, and keep what was changed across launches", () => {
    const path = join(folder, "kept.json");
    expect(preferencesStore(path).get()).toEqual({
      theme: "system",
      window: undefined,
    });
    const window = { x: 10, y: 20, width: 900, height: 700, maximized: true };
    preferencesStore(path).update({ theme: "dark", window });
    expect(readPreferences(path)).toEqual({ theme: "dark", window });
  });

  it("fall back to the defaults, saying so, for a file they can't read", () => {
    const path = join(folder, "broken.json");
    writeFileSync(path, "{ not json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(readPreferences(path)).toEqual({
      theme: "system",
      window: undefined,
    });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();

    writeFileSync(path, JSON.stringify({ theme: "sepia", window: { x: "1" } }));
    expect(readPreferences(path)).toEqual({
      theme: "system",
      window: undefined,
    });
  });
});
