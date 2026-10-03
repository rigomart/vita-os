import { describe, expect, it } from "vitest";

import { suggestThreadTitle } from "./thread-title";

describe("suggestThreadTitle", () => {
  it.each([
    ["# Dentist follow-up\nCall Monday", "Dentist follow-up"],
    ["\n\n   \n## Taxes", "Taxes"],
    ["- Renew passport", "Renew passport"],
    ["* Renew passport", "Renew passport"],
    ["> Quote from the doctor", "Quote from the doctor"],
    ["> - quoted item", "quoted item"],
    ["1. First step", "First step"],
    ["12) Twelfth", "Twelfth"],
    ["- [ ] Book the car service", "Book the car service"],
    ["- [x] Done thing", "Done thing"],
    ["Plain line", "Plain line"],
    ["#hashtag stays", "#hashtag stays"],
    ["", ""],
  ])("suggests %j as %j", (body, title) => {
    expect(suggestThreadTitle(body)).toBe(title);
  });

  it("cuts a long line at a word", () => {
    const title = suggestThreadTitle(
      "Look into whether the insurance covers the second opinion, and ask about the referral",
    );
    expect(title).toBe(
      "Look into whether the insurance covers the second opinion",
    );
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it("cuts a long word-less line at the limit", () => {
    expect(suggestThreadTitle("x".repeat(100))).toBe("x".repeat(60));
  });
});
