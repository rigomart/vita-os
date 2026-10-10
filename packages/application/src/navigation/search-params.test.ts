import { describe, expect, it } from "vitest";

import type { ProductSearch } from "./search-params";

import {
  readProductSearch,
  toNotesFilter,
  toUnfilteredDashboard,
  withDashboardFilter,
} from "./search-params";

describe("readProductSearch", () => {
  it("reads the Notes filter only from its own value", () => {
    expect(readProductSearch({ show: "notes" }).show).toBe("notes");
    expect(readProductSearch({ show: "threads" }).show).toBeUndefined();
    expect(readProductSearch({ show: "" }).show).toBeUndefined();
    expect(readProductSearch({}).show).toBeUndefined();
  });

  it("keeps an Area slug of `notes` an Area, never the Notes filter", () => {
    expect(readProductSearch({ area: "notes" })).toMatchObject({
      area: "notes",
      show: undefined,
    });
  });

  it("still reads the legacy Notes panel param, to redirect it", () => {
    expect(readProductSearch({ inbox: "true" }).inbox).toBe(true);
    expect(readProductSearch({ inbox: true }).inbox).toBe(true);
    expect(readProductSearch({ inbox: "no" }).inbox).toBeUndefined();
  });
});

describe("choosing a Dashboard filter", () => {
  it("sets one of the two parameters and clears the other", () => {
    expect(
      withDashboardFilter({ show: "notes" })({ area: "home", thread: "roof" }),
    ).toEqual({ area: undefined, show: "notes", thread: "roof" });
    expect(
      withDashboardFilter({ area: "home" })({ show: "notes", thread: "roof" }),
    ).toEqual({ area: "home", show: undefined, thread: "roof" });
    expect(withDashboardFilter({})({ area: "home", show: "notes" })).toEqual({
      area: undefined,
      show: undefined,
    });
  });

  it("opens the Dashboard unfiltered and without a Thread, keeping the rest", () => {
    expect(
      toUnfilteredDashboard({
        area: "home",
        thread: "roof",
        variant: "b",
      } as ProductSearch),
    ).toEqual({
      area: undefined,
      show: undefined,
      thread: undefined,
      inbox: undefined,
      variant: "b",
    });
  });

  it("turns an old Notes panel address into the Notes filter", () => {
    expect(
      toNotesFilter({ inbox: true, area: "home", thread: "roof" }),
    ).toEqual({
      thread: "roof",
      area: undefined,
      show: "notes",
      inbox: undefined,
    });
  });
});
