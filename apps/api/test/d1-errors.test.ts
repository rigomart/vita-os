import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { isUniqueViolation } from "../src/platform/d1/statements";

describe("D1 unique violations", () => {
  it("recognizes a slug collision wrapped by Drizzle", () => {
    const cause = new Error(
      "D1_ERROR: UNIQUE constraint failed: areas.user_id, areas.slug",
    );
    const error = new DrizzleQueryError("insert into areas", [], cause);
    expect(isUniqueViolation(error, "areas.user_id, areas.slug")).toBe(true);
    expect(isUniqueViolation(error, "threads.user_id, threads.slug")).toBe(
      false,
    );
  });

  it("does not classify query text or a database outage as a collision", () => {
    const error = new DrizzleQueryError(
      "UNIQUE constraint failed: areas.user_id, areas.slug",
      [],
      new Error("D1_ERROR: database is locked"),
    );
    expect(isUniqueViolation(error, "areas.user_id, areas.slug")).toBe(false);
  });
});
