// PROTOTYPE — throwaway code. Redesigns of the thread activity log,
// switchable via the `?variant=` search param on the existing thread route.
// Final verdict after three rounds: the original Timeline rail (B) wins,
// with wider vertical gaps between day groups (B1's separation without its
// mobile-hostile left date gutter). All losing variants stay on this branch
// as the archived primary source but are out of the switcher.
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
