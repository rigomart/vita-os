import type { ComponentType } from "react";

import { DayColumnsPlan } from "./day-columns";
import { FinalPlan } from "./final";
import { LaneFlowPlan } from "./lane-flow";
import { ZoomHorizonsPlan } from "./zoom-horizons";

export interface PlanPrototype {
  /** URL-safe identifier; also the `?p=` search value on `/proto`. */
  key: string;
  title: string;
  /** One or two sentences on the idea being tested. */
  blurb: string;
  component: ComponentType;
}

/**
 * Every Plan view exploration, in gallery order.
 *
 * To add one: drop a component under `src/features/plan-prototypes/<your-key>/`
 * (or a single `<your-key>.tsx`), read from `./mock-data`, then append an entry
 * here. Nothing else is wired by hand.
 */
export const prototypes: PlanPrototype[] = [
  {
    key: "final",
    title: "Lane view — base",
    blurb:
      "The Area × time lane view: Areas as rows worst-condition-first, threads as compact chips, the thread sidebar for editing. The base the variations below iterate on.",
    component: FinalPlan,
  },
  {
    key: "day-columns",
    title: "Day columns",
    blurb:
      "Every column is a real day. Overdue, Today, then each of the next days individually — a drop always lands on the exact date you chose.",
    component: DayColumnsPlan,
  },
  {
    key: "lane-flow",
    title: "Lane flow",
    blurb:
      "Each Area lane carries its own compact 14-day axis. Chips sit on their exact day and drag anywhere along the flow.",
    component: LaneFlowPlan,
  },
  {
    key: "zoom-horizons",
    title: "Zoom horizons",
    blurb:
      "Fuzzy columns for glanceability that split into per-day drop slots the moment you drag — precision on demand.",
    component: ZoomHorizonsPlan,
  },
];

export function findPrototype(key: string | undefined): PlanPrototype {
  return prototypes.find((entry) => entry.key === key) ?? prototypes[0];
}
