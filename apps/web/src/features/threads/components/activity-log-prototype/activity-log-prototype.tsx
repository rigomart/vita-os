// PROTOTYPE — throwaway code. Three redesigns of the thread activity log,
// switchable via the `?variant=` search param on the existing thread route.
// Plan: "Current" baseline plus variants A (Journal), B (Timeline rail),
// C (Ledger), rendered in place of ActivityLog inside ActivityLogSection.
import {
  PrototypeVariants,
  type PrototypeVariant,
} from "@/components/dev/prototype-variants";

import type { ActivityLogVariantProps } from "./shared";

import { ActivityLog } from "../thread-log";
import { ActivityLogJournal } from "./variant-a-journal";
import { ActivityLogTimelineRail } from "./variant-b-rail";
import { ActivityLogLedger } from "./variant-c-ledger";

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
      key: "A",
      name: "Journal",
      render: () => <ActivityLogJournal logs={logs} onAddNote={onAddNote} />,
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
  ] satisfies readonly [PrototypeVariant, ...PrototypeVariant[]];

  return <PrototypeVariants variants={variants} />;
}
