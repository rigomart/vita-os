import type { AreaId, ThreadId } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { anArea, aNote, aThread } from "../../test/fixtures";
import { filterDashboard, NO_AREA_PARAM } from "./dashboard-filter-model";

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

function view(param: string | undefined) {
  return filterDashboard({ threads, notes: [note], areas, param });
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
      param: NO_AREA_PARAM,
    });

    expect(result.threads).toEqual([orphan]);
    expect(result.options.at(-1)?.count).toBe(1);
  });

  it("offers All, each Area in the user's order, then No area, with counts", () => {
    expect(
      view(undefined).options.map((option) => [
        option.label,
        option.count,
        option.param,
      ]),
    ).toEqual([
      ["All", 4, undefined],
      ["Home", 1, home.slug],
      ["Health", 2, health.slug],
      ["Career", 0, career.slug],
      ["No area", 1, NO_AREA_PARAM],
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
