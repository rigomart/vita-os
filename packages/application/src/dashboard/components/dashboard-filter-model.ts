import type { AreaSummary, Note, Thread } from "@vita-os/contracts";

/**
 * The Dashboard's Area filter, decided in one place.
 *
 * The filter lives in the URL as `?area=<slug>`, `?area=none`, or nothing at
 * all. This module turns that value, the Open Threads, the open Standalone
 * Notes and the Areas into what the board should show and what the filter row
 * should offer. The board itself never learns it was filtered: it is handed
 * already-filtered input and lays it out exactly as it always does.
 */

/** The `?area=` value that selects Threads without an Area. */
export const NO_AREA_PARAM = "none";

export type DashboardFilter =
  | { kind: "all" }
  | { kind: "area"; area: AreaSummary }
  | { kind: "none" };

export interface DashboardFilterOption {
  /** Stable React key: `all`, `none`, or the Area's ID. */
  key: string;
  /** The `?area=` value that selects this option; `undefined` is All. */
  param: string | undefined;
  label: string;
  /** Present on an Area's own option. */
  area?: AreaSummary;
  /** How many Open Threads this option shows. */
  count: number;
  /** An Area or No area with nothing open: still listed, drawn quietly. */
  muted: boolean;
  selected: boolean;
}

export interface FilteredDashboard {
  filter: DashboardFilter;
  threads: Thread[];
  notes: Note[];
  /** All, each Area in the user's order, then No area. */
  options: DashboardFilterOption[];
}

/** Which filter a `?area=` value names. An unknown Area falls back to All. */
export function readDashboardFilter(
  param: string | undefined,
  areas: readonly AreaSummary[],
): DashboardFilter {
  if (param === undefined) return { kind: "all" };
  if (param === NO_AREA_PARAM) return { kind: "none" };

  const area = areas.find((candidate) => candidate.slug === param);
  return area === undefined ? { kind: "all" } : { kind: "area", area };
}

export function filterDashboard(input: {
  threads: readonly Thread[];
  notes: readonly Note[];
  areas: readonly AreaSummary[];
  param: string | undefined;
}): FilteredDashboard {
  const areas = [...input.areas].sort((a, b) => a.order - b.order);
  const filter = readDashboardFilter(input.param, areas);
  const known = new Set(areas.map((area) => area._id));
  // A Thread pointing at an Area that is no longer listed reads as unlabeled,
  // the same way it will once the service catches up.
  const areaOf = (thread: Thread) =>
    thread.areaId !== undefined && known.has(thread.areaId)
      ? thread.areaId
      : undefined;

  const counts = new Map<string | undefined, number>();
  for (const thread of input.threads) {
    const areaId = areaOf(thread);
    counts.set(areaId, (counts.get(areaId) ?? 0) + 1);
  }

  const threads =
    filter.kind === "all"
      ? [...input.threads]
      : input.threads.filter((thread) =>
          filter.kind === "none"
            ? areaOf(thread) === undefined
            : areaOf(thread) === filter.area._id,
        );

  const unlabeled = counts.get(undefined) ?? 0;
  const options: DashboardFilterOption[] = [
    {
      key: "all",
      param: undefined,
      label: "All",
      count: input.threads.length,
      muted: false,
      selected: filter.kind === "all",
    },
    ...areas.map((area): DashboardFilterOption => {
      const count = counts.get(area._id) ?? 0;
      return {
        key: area._id,
        param: area.slug,
        label: area.name,
        area,
        count,
        muted: count === 0,
        selected: filter.kind === "area" && filter.area._id === area._id,
      };
    }),
    {
      key: NO_AREA_PARAM,
      param: NO_AREA_PARAM,
      label: "No area",
      count: unlabeled,
      muted: unlabeled === 0,
      selected: filter.kind === "none",
    },
  ];

  return {
    filter,
    threads,
    // Standalone Notes belong to no Area, so any narrowing leaves them out.
    notes: filter.kind === "all" ? [...input.notes] : [],
    options,
  };
}
