import type { AreaId, ThreadId } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import type { DashboardFilterParams } from "../../navigation/use-dashboard-filter-params";

import { anArea, aNote, aThread } from "../../test/fixtures";
import {
  filterDashboard,
  filteredAreaId,
  NO_AREA_PARAM,
  readDashboardFilter,
} from "./dashboard-filter-model";

const health = anArea({
  _id: "area-health" as AreaId,
  name: "Health",
  slug: "health-00000000",
  order: 1,
});
const home = anArea({
  _id: "area-home" as AreaId,
  name: "Home",
  slug: "home-00000000",
  order: 0,
});
const career = anArea({
  _id: "area-career" as AreaId,
  name: "Career",
  slug: "career-00000000",
  order: 2,
});

const checkup = aThread({
  _id: "thread-checkup" as ThreadId,
  areaId: health._id,
});
const dentist = aThread({
  _id: "thread-dentist" as ThreadId,
  areaId: health._id,
});
const gate = aThread({ _id: "thread-gate" as ThreadId, areaId: home._id });
const passport = aThread({ _id: "thread-passport" as ThreadId });
const { areaId: _dropped, ...unlabeledShape } = passport;
const unlabeled = unlabeledShape;
const note = aNote();

const threads = [checkup, dentist, gate, unlabeled];
const areas = [health, home, career];

function view(area: string | undefined, show?: "notes") {
  return filterDashboard({
    threads,
    notes: [note],
    areas,
    params: { area, show },
  });
}

describe("filterDashboard", () => {
  it("shows the whole board, Notes included, under All", () => {
    const result = view(undefined);

    expect(result.filter).toEqual({ kind: "all" });
    expect(result.threads).toEqual(threads);
    expect(result.notes).toEqual([note]);
  });

  it("narrows to one Area's Open Threads and hides Standalone Notes", () => {
    const result = view(health.slug);

    expect(result.filter).toEqual({ kind: "area", area: health });
    expect(result.threads).toEqual([checkup, dentist]);
    expect(result.notes).toEqual([]);
  });

  it("narrows to unlabeled Open Threads under No area, without Notes", () => {
    const result = view(NO_AREA_PARAM);

    expect(result.filter).toEqual({ kind: "none" });
    expect(result.threads).toEqual([unlabeled]);
    expect(result.notes).toEqual([]);
  });

  it("falls back to All for an Area that is not there", () => {
    const result = view("deleted-area-00000000");

    expect(result.filter).toEqual({ kind: "all" });
    expect(result.threads).toEqual(threads);
    expect(result.notes).toEqual([note]);
    expect(result.options.find((option) => option.selected)?.key).toBe("all");
  });

  it("treats a Thread whose Area is gone as unlabeled", () => {
    const orphan = aThread({
      _id: "thread-orphan" as ThreadId,
      areaId: "area-gone" as AreaId,
    });

    const result = filterDashboard({
      threads: [orphan],
      notes: [],
      areas,
      params: { area: NO_AREA_PARAM },
    });

    expect(result.threads).toEqual([orphan]);
    expect(result.options.find((option) => option.key === "none")?.count).toBe(
      1,
    );
  });

  it("offers All, each Area in the user's order, No area, then Notes apart, with counts", () => {
    expect(
      view(undefined).options.map((option) => [
        option.label,
        option.count,
        option.search,
        option.separated,
      ]),
    ).toEqual([
      ["All", 4, {}, false],
      ["Home", 1, { area: home.slug }, false],
      ["Health", 2, { area: health.slug }, false],
      ["Career", 0, { area: career.slug }, false],
      ["No area", 1, { area: NO_AREA_PARAM }, false],
      ["Notes", 1, { show: "notes" }, true],
    ]);
  });

  it("shows only the open Standalone Notes under Notes", () => {
    const result = view(undefined, "notes");

    expect(result.filter).toEqual({ kind: "notes" });
    expect(result.threads).toEqual([]);
    expect(result.notes).toEqual([note]);
    expect(
      result.options.filter((option) => option.selected).map((o) => o.key),
    ).toEqual(["notes"]);
  });

  it("mutes Notes when no Note is open", () => {
    const result = filterDashboard({
      threads,
      notes: [],
      areas,
      params: {},
    });

    expect(result.options.at(-1)).toMatchObject({
      key: "notes",
      count: 0,
      muted: true,
    });
  });

  it("offers All and Notes alone when there are no Areas", () => {
    const result = filterDashboard({
      threads,
      notes: [note],
      areas: [],
      params: {},
    });

    expect(result.options.map((option) => option.key)).toEqual([
      "all",
      "notes",
    ]);
  });

  it("keeps an Area with nothing open in the row, muted", () => {
    const options = view(undefined).options;

    expect(options.find((option) => option.key === career._id)).toMatchObject({
      count: 0,
      muted: true,
    });
    expect(options.find((option) => option.key === health._id)?.muted).toBe(
      false,
    );
    expect(options[0]?.muted).toBe(false);
  });

  it("marks exactly the chosen option as selected", () => {
    expect(
      view(home.slug)
        .options.filter((option) => option.selected)
        .map((option) => option.key),
    ).toEqual([home._id]);
  });
});

describe("readDashboardFilter", () => {
  const read = (params: DashboardFilterParams) =>
    readDashboardFilter(params, areas);

  it("reads the Notes filter from its own parameter", () => {
    expect(read({ show: "notes" })).toEqual({ kind: "notes" });
  });

  it("never mistakes an Area named Notes for the Notes filter", () => {
    const notesArea = anArea({
      _id: "area-notes" as AreaId,
      name: "Notes",
      slug: "notes",
      order: 3,
    });

    expect(readDashboardFilter({ area: "notes" }, [notesArea])).toEqual({
      kind: "area",
      area: notesArea,
    });
    expect(readDashboardFilter({ show: "notes" }, [notesArea])).toEqual({
      kind: "notes",
    });
  });

  it("lets Notes win when a URL carries both parameters", () => {
    expect(read({ area: health.slug, show: "notes" })).toEqual({
      kind: "notes",
    });
  });

  it("starts a new Thread in the filtered Area, and in none under Notes", () => {
    expect(filteredAreaId({ area: health.slug }, areas)).toBe(health._id);
    expect(filteredAreaId({ show: "notes" }, areas)).toBeUndefined();
    expect(filteredAreaId({ area: NO_AREA_PARAM }, areas)).toBeUndefined();
  });
});
