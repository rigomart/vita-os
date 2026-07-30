// PROTOTYPE — throwaway code. Redesigns of the thread activity log,
// switchable via the `?variant=` search param on the existing thread route.
// Round 1 verdict: Journal cut; Timeline rail most intuitive; Ledger's
// structure + filter chips liked. Round 2 (D/E/F) explores combinations
// of the rail's continuity with the ledger's discipline and filtering.
import {
  PrototypeVariants,
  type PrototypeVariant,
} from "@/components/dev/prototype-variants";

import type { ActivityLogVariantProps } from "./shared";

import { ActivityLog } from "../thread-log";
import { ActivityLogTimelineRail } from "./variant-b-rail";
import { ActivityLogLedger } from "./variant-c-ledger";
import { ActivityLogFilteredRail } from "./variant-d-filtered-rail";
import { ActivityLogRailLedger } from "./variant-e-rail-ledger";
import { ActivityLogDayDigest } from "./variant-f-day-digest";

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
      key: "C",
      name: "Ledger",
      render: () => <ActivityLogLedger logs={logs} onAddNote={onAddNote} />,
    },
    {
      key: "D",
      name: "Filtered rail",
      render: () => (
        <ActivityLogFilteredRail logs={logs} onAddNote={onAddNote} />
      ),
    },
    {
      key: "E",
      name: "Rail ledger",
      render: () => <ActivityLogRailLedger logs={logs} onAddNote={onAddNote} />,
    },
    {
      key: "F",
      name: "Day digest",
      render: () => <ActivityLogDayDigest logs={logs} onAddNote={onAddNote} />,
    },
  ] satisfies readonly [PrototypeVariant, ...PrototypeVariant[]];

  return <PrototypeVariants variants={variants} />;
}
