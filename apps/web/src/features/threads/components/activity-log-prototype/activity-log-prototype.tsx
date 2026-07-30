// PROTOTYPE — throwaway code. Redesigns of the thread activity log,
// switchable via the `?variant=` search param on the existing thread route.
// Verdict after two rounds: the Timeline rail (B) wins. Round 3 explores
// small variations of it — date placement, grouping granularity, styling
// register — as B1–B4. Losing round-1/2 variants stay on this branch as
// the archived primary source but are out of the switcher.
import {
  PrototypeVariants,
  type PrototypeVariant,
} from "@/components/dev/prototype-variants";

import type { ActivityLogVariantProps } from "./shared";

import { ActivityLog } from "../thread-log";
import { ActivityLogTimelineRail } from "./variant-b-rail";
import { ActivityLogRailLeftDates } from "./variant-b1-left-dates";
import { ActivityLogRailWeekGroups } from "./variant-b2-week-groups";
import { ActivityLogRailSoft } from "./variant-b3-soft";
import { ActivityLogRailStream } from "./variant-b4-stream";

export function ActivityLogPrototype({
  logs,
  onAddNote,
}: ActivityLogVariantProps) {
  const variants = [
    {
      key: "0",
      name: "Current",
      render: () => <ActivityLog logs={logs} onAddNote={onAddNote} />,
    },
    {
      key: "B",
      name: "Timeline rail",
      render: () => (
        <ActivityLogTimelineRail logs={logs} onAddNote={onAddNote} />
      ),
    },
    {
      key: "B1",
      name: "Dates left of rail",
      render: () => (
        <ActivityLogRailLeftDates logs={logs} onAddNote={onAddNote} />
      ),
    },
    {
      key: "B2",
      name: "Week groups",
      render: () => (
        <ActivityLogRailWeekGroups logs={logs} onAddNote={onAddNote} />
      ),
    },
    {
      key: "B3",
      name: "Soft styling",
      render: () => <ActivityLogRailSoft logs={logs} onAddNote={onAddNote} />,
    },
    {
      key: "B4",
      name: "Ungrouped stream",
      render: () => <ActivityLogRailStream logs={logs} onAddNote={onAddNote} />,
    },
  ] satisfies readonly [PrototypeVariant, ...PrototypeVariant[]];

  return <PrototypeVariants variants={variants} defaultVariant="B" />;
}
