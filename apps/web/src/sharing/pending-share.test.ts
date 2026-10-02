import { afterEach, describe, expect, it } from "vitest";

import { pendingShareKey, receiveSharedNote } from "./pending-share";

afterEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("incoming text shares", () => {
  it("keeps title, multiline text and URL through sign-in and removes them from the address", () => {
    window.history.replaceState(
      null,
      "",
      "/share-target?title=Read+later&text=First+line%0ASecond+line&url=https%3A%2F%2Fexample.com",
    );
    receiveSharedNote();
    expect(sessionStorage.getItem(pendingShareKey)).toBe(
      JSON.stringify([
        "Read later\n\nFirst line\nSecond line\n\nhttps://example.com",
      ]),
    );
    expect(window.location.pathname + window.location.search).toBe("/");
  });

  it("does not capture empty shares", () => {
    window.history.replaceState(null, "", "/share-target?text=++");
    receiveSharedNote();
    expect(sessionStorage.getItem(pendingShareKey)).toBeNull();
    expect(window.location.pathname).toBe("/");
  });

  it("does not interpret ordinary URL parameters as shares", () => {
    window.history.replaceState(null, "", "/?text=Keep+this+URL");
    receiveSharedNote();
    expect(sessionStorage.getItem(pendingShareKey)).toBeNull();
    expect(window.location.search).toBe("?text=Keep+this+URL");
  });
});
