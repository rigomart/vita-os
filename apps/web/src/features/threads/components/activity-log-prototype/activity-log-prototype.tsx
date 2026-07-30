// PROTOTYPE — throwaway code. Redesigns of the thread activity log,
// switchable via the `?variant=` search param on the existing thread route.
// Verdict after two rounds: the Timeline rail (B) wins, with fixed node
// alignment and day labels moved beside the rail. Other variant files stay
// on this branch as the archived primary source but are out of the switcher.
import {
  PrototypeVariants,
  type PrototypeVariant,
} from "@/components/dev/prototype-variants";

import type { ActivityLogVariantProps } from "./shared";

import { ActivityLog } from "../thread-log";
import { ActivityLogTimelineRail } from "./variant-b-rail";

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
  ] satisfies readonly [PrototypeVariant, ...PrototypeVariant[]];

  return <PrototypeVariants variants={variants} defaultVariant="B" />;
}
