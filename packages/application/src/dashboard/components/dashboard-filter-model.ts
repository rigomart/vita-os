import type { AreaSummary, Note, Thread } from "@vita-os/contracts";

import type { DashboardFilterParams } from "../../navigation/use-dashboard-filter-params";

import { NOTES_FILTER } from "../../navigation/search-params";

/**
 * The Dashboard's filter, decided in one place.
 *
 * The filter lives in the URL as `?area=<slug>`, `?area=none`, `?show=notes`,
 * or nothing at all. This module turns those values, the Open Threads, the
 * open Standalone Notes and the Areas into what the board should show and what
 * the filter row should offer. The board itself never learns it was filtered:
 * it is handed already-filtered input and lays it out exactly as it always
 * does.
 */

/** The `?area=` value that selects Threads without an Area. */
export const NO_AREA_PARAM = "none";

export type DashboardFilter =
  | { kind: "all" }
  | { kind: "area"; area: AreaSummary }
  | { kind: "none" }
  | { kind: "notes" };

export interface DashboardFilterOption {
  /** Stable React key: `all`, `none`, `notes`, or the Area's ID. */
  key: string;
  /** The URL this option selects; both empty is All. */
  search: DashboardFilterParams;
  label: string;
  /** Present on an Area's own option. */
  area?: AreaSummary;
  /**
   * How many items this option shows: Open Threads for All and the Areas,
   * open Standalone Notes for Notes.
   */
  count: number;
  /** An option with nothing open: still listed, drawn quietly. */
  muted: boolean;
  selected: boolean;
  /** Notes is not an Area, so the row sets it apart from them. */
  separated: boolean;
}

export interface FilteredDashboard {
  filter: DashboardFilter;
  threads: Thread[];
  notes: Note[];
  /** All, each Area in the user's order, No area, then Notes. */
  options: DashboardFilterOption[];
}

/**
 * Which filter the URL names. `?show=notes` wins over `?area=` should both be
 * present, since choosing either clears the other; an unknown Area falls back
 * to All.
 */
export function readDashboardFilter(
  params: DashboardFilterParams,
  areas: readonly AreaSummary[],
): DashboardFilter {
  if (params.show === NOTES_FILTER) return { kind: "notes" };
  if (params.area === undefined) return { kind: "all" };
  if (params.area === NO_AREA_PARAM) return { kind: "none" };

  const area = areas.find((candidate) => candidate.slug === params.area);
  return area === undefined ? { kind: "all" } : { kind: "area", area };
}

/** The Area a Thread captured under this filter starts in, if any. */
export function filteredAreaId(
  params: DashboardFilterParams,
  areas: readonly AreaSummary[],
): AreaSummary["_id"] | undefined {
  const filter = readDashboardFilter(params, areas);
  return filter.kind === "area" ? filter.area._id : undefined;
}

export function filterDashboard(input: {
  threads: readonly Thread[];
  notes: readonly Note[];
  areas: readonly AreaSummary[];
  params: DashboardFilterParams;
}): FilteredDashboard {
  const areas = [...input.areas].sort((a, b) => a.order - b.order);
  const filter = readDashboardFilter(input.params, areas);
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
      : filter.kind === "notes"
        ? []
        : input.threads.filter((thread) =>
            filter.kind === "none"
              ? areaOf(thread) === undefined
              : areaOf(thread) === filter.area._id,
          );

  const unlabeled = counts.get(undefined) ?? 0;
  const options: DashboardFilterOption[] = [
    {
      key: "all",
      search: {},
      label: "All",
      count: input.threads.length,
      muted: false,
      selected: filter.kind === "all",
      separated: false,
    },
    ...areas.map((area): DashboardFilterOption => {
      const count = counts.get(area._id) ?? 0;
      return {
        key: area._id,
        search: { area: area.slug },
        label: area.name,
        area,
        count,
        muted: count === 0,
        selected: filter.kind === "area" && filter.area._id === area._id,
        separated: false,
      };
    }),
    // With no Areas every Thread is unlabeled, so No area would only repeat
    // All without the Notes.
    ...(areas.length === 0
      ? []
      : [
          {
            key: NO_AREA_PARAM,
            search: { area: NO_AREA_PARAM },
            label: "No area",
            count: unlabeled,
            muted: unlabeled === 0,
            selected: filter.kind === "none",
            separated: false,
          },
        ]),
    {
      key: NOTES_FILTER,
      search: { show: NOTES_FILTER },
      label: "Notes",
      count: input.notes.length,
      muted: input.notes.length === 0,
      selected: filter.kind === "notes",
      separated: true,
    },
  ];

  return {
    filter,
    threads,
    // Standalone Notes belong to no Area, so any Area narrowing leaves them
    // out; the Notes filter shows nothing else.
    notes:
      filter.kind === "all" || filter.kind === "notes" ? [...input.notes] : [],
    options,
  };
}
