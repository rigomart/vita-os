import { describe, expect, it } from "vitest";

import { newRecordId } from "./record-id";

describe("newRecordId", () => {
  it("mints distinct IDs", () => {
    const ids = new Set(Array.from({ length: 1_000 }, () => newRecordId()));

    expect(ids.size).toBe(1_000);
  });

  it("sorts in the order records were written, even within one millisecond", () => {
    const sameMillisecond = Array.from({ length: 50 }, () =>
      newRecordId(1_700_000_000_000),
    );

    expect([...sameMillisecond].sort()).toEqual(sameMillisecond);
  });

  it("sorts a later record after an earlier one", () => {
    const earlier = newRecordId(1_700_000_000_000);
    const later = newRecordId(1_700_000_000_001);

    expect(later > earlier).toBe(true);
  });

  it("is fixed-width Crockford base32, so lexicographic order is time order", () => {
    const id = newRecordId(1_700_000_000_000);

    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});
