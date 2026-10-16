import { MigrationFailedError } from "@vita-os/local";
import { describe, expect, it } from "vitest";

import { opensExternally, originOf } from "./links.ts";
import { startupFailure } from "./startup-failure.ts";

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
