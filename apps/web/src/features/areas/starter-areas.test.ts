import { describe, expect, it } from "vitest";
import { STARTER_AREA_NAMES } from "./starter-areas";

describe("Starter Areas", () => {
  it("offers a minimal set of suggested life domains", () => {
    expect(STARTER_AREA_NAMES).toHaveLength(6);
  });

  it("uses unique names for each suggestion", () => {
    expect(new Set(STARTER_AREA_NAMES).size).toBe(STARTER_AREA_NAMES.length);
  });

  it("includes common starter domains from the product glossary", () => {
    expect(STARTER_AREA_NAMES).toEqual(
      expect.arrayContaining(["Family Health", "Career", "Finances", "Home"]),
    );
  });
});
