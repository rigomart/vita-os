// PROTOTYPE — throwaway (issue #309). Mounts the attention-first dashboard
// variants behind `?variant=` with the shared dev switcher. The current Plan
// canvas rides along as the `plan` baseline so the comparison is honest.
// Delete with features/dashboard/prototype/.

import type { ReactNode } from "react";

import { PrototypeVariants } from "@/components/dev/prototype-variants";

import type { AttentionDashboardProps } from "./attention-contract";

import { VariantARibbon } from "./variant-a-ribbon";
import { VariantA2Gutter } from "./variant-a2-gutter";
import { VariantBBands } from "./variant-b-bands";
import { VariantCAreas } from "./variant-c-areas";

interface AttentionDashboardPrototypeProps extends AttentionDashboardProps {
  /** The existing Plan canvas, rendered as the comparison baseline. */
  plan: ReactNode;
}

export function AttentionDashboardPrototype({
  plan,
  ...props
}: AttentionDashboardPrototypeProps) {
  // Under the test runner the prototype is transparent: existing dashboard
  // tests keep asserting against the real Plan surface, untouched by this
  // round. The switcher also needs a live router, which those tests mock away.
  if (import.meta.env.MODE === "test") {
    return <>{plan}</>;
  }

  return (
    <PrototypeVariants
      defaultVariant="a"
      variants={[
        {
          key: "a",
          name: "Horizon ribbon",
          render: () => <VariantARibbon {...props} />,
        },
        {
          key: "a2",
          name: "Time gutter",
          render: () => <VariantA2Gutter {...props} />,
        },
        {
          key: "b",
          name: "Temporal bands",
          render: () => <VariantBBands {...props} />,
        },
        {
          key: "c",
          name: "Condition groups",
          render: () => <VariantCAreas {...props} />,
        },
        { key: "plan", name: "Plan (current)", render: () => plan },
      ]}
    />
  );
}
