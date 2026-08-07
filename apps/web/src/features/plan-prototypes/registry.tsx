import type { ComponentType } from "react";

import { AreaGridPlan } from "./area-grid";
import { FinalPlan } from "./final";
import { FlowTimelinePlan } from "./flow-timeline";
import { HorizonBoardPlan } from "./horizon-board";
import { StatusQuoPlan } from "./status-quo";
import { WeeklyRitualPlan } from "./weekly-ritual";

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
    title: "Final — recommended",
    blurb:
      "The converged design: the Area × time grid as the canvas, a persistent editing rail, and a guided card-by-card Review mode. Built from the strongest parts of the four directions below.",
    component: FinalPlan,
  },
  {
    key: "status-quo",
    title: "Status quo",
    blurb:
      "The Plan tab as it ships today: six fixed schedule columns of Thread chips, with undated Threads folded away underneath. The baseline everything else is measured against.",
    component: StatusQuoPlan,
  },
  {
    key: "horizon-board",
    title: "Horizon board",
    blurb:
      "A kanban across fuzzy time horizons: drag Threads between Today, Tomorrow, This week, Next week, and Later to reschedule their Follow-ups; edit in place from each card.",
    component: HorizonBoardPlan,
  },
  {
    key: "area-grid",
    title: "Area × time grid",
    blurb:
      "A matrix of Life Areas against time horizons that shows where attention is going — and which Areas are neglected. Drag chips across cells to reschedule.",
    component: AreaGridPlan,
  },
  {
    key: "weekly-ritual",
    title: "Weekly ritual",
    blurb:
      "A two-pane weekly review: a Needs-planning tray on the left, the week on the right, and a guided card-by-card review mode for triaging everything unplanned.",
    component: WeeklyRitualPlan,
  },
  {
    key: "flow-timeline",
    title: "Flow timeline",
    blurb:
      "A continuous agenda of the next two weeks with a sticky editing rail: select any Thread to reschedule, rewrite its Next Move, or resolve it without leaving the flow.",
    component: FlowTimelinePlan,
  },
];

export function findPrototype(key: string | undefined): PlanPrototype {
  return prototypes.find((entry) => entry.key === key) ?? prototypes[0];
}
