import { describe, expect, it } from "vitest";
import { validateDateRange, validateEffectiveDates } from "./dates";

describe("validateDateRange", () => {
  it("accepts both undefined", () => {
    expect(() => validateDateRange()).not.toThrow();
  });

  it("accepts startDate only", () => {
    expect(() => validateDateRange(100)).not.toThrow();
  });

  it("accepts valid range", () => {
    expect(() => validateDateRange(100, 200)).not.toThrow();
  });

  it("accepts equal dates", () => {
    expect(() => validateDateRange(100, 100)).not.toThrow();
  });

  it("rejects endDate without startDate", () => {
    expect(() => validateDateRange(undefined, 200)).toThrow(
      "End date requires a start date",
    );
  });

  it("rejects endDate before startDate", () => {
    expect(() => validateDateRange(200, 100)).toThrow(
      "End date must not be before start date",
    );
  });
});

describe("validateEffectiveDates", () => {
  it("passes when no changes", () => {
    expect(() => validateEffectiveDates({ startDate: 100 }, {})).not.toThrow();
  });

  it("passes when setting a valid startDate", () => {
    expect(() => validateEffectiveDates({}, { startDate: 100 })).not.toThrow();
  });

  it("passes when setting endDate with existing startDate", () => {
    expect(() =>
      validateEffectiveDates({ startDate: 100 }, { endDate: 200 }),
    ).not.toThrow();
  });

  it("passes when clearing startDate (null also clears endDate)", () => {
    expect(() =>
      validateEffectiveDates(
        { startDate: 100, endDate: 200 },
        { startDate: null },
      ),
    ).not.toThrow();
  });

  it("passes when clearing endDate only", () => {
    expect(() =>
      validateEffectiveDates(
        { startDate: 100, endDate: 200 },
        { endDate: null },
      ),
    ).not.toThrow();
  });

  it("passes when startDate=null overrides a new endDate", () => {
    expect(() =>
      validateEffectiveDates(
        { startDate: 100, endDate: 200 },
        { startDate: null, endDate: 300 },
      ),
    ).not.toThrow();
  });

  it("passes when setting both dates at once", () => {
    expect(() =>
      validateEffectiveDates({}, { startDate: 100, endDate: 200 }),
    ).not.toThrow();
  });

  it("throws when setting endDate on a project with no startDate", () => {
    expect(() => validateEffectiveDates({}, { endDate: 300 })).toThrow(
      "End date requires a start date",
    );
  });

  it("throws when new endDate is before existing startDate", () => {
    expect(() =>
      validateEffectiveDates({ startDate: 200 }, { endDate: 100 }),
    ).toThrow("End date must not be before start date");
  });

  it("throws when new startDate is after existing endDate", () => {
    expect(() =>
      validateEffectiveDates({ endDate: 100 }, { startDate: 200 }),
    ).toThrow("End date must not be before start date");
  });
});
