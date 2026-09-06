/**
 * PROTOTYPE — throwaway. The whole prototype hangs off this one component so a
 * production build can drop it: `inbox-screen` renders it only under
 * `import.meta.env.DEV`, which is statically false in prod, so this module and
 * everything it imports gets eliminated.
 */
import type { ProjectedNote } from "@convex/lib/validators";
import type { ReactNode } from "react";

import { VariantD1, VariantD2, VariantD3 } from "./inbox-prototype-variants";
import { PrototypeSwitcher } from "./prototype-switcher";
import { usePrototypeVariant } from "./use-prototype-variant";

export function InboxPrototype({
  notes,
  doneNotes,
  current,
}: {
  notes: ProjectedNote[];
  doneNotes: ProjectedNote[];
  /** The real Inbox list, shown under the `current` variant for comparison. */
  current: ReactNode;
}) {
  const { variant, cycle } = usePrototypeVariant();

  return (
    <>
      {variant === "current" && current}
      {variant === "D1" && <VariantD1 notes={notes} doneNotes={doneNotes} />}
      {variant === "D2" && <VariantD2 notes={notes} doneNotes={doneNotes} />}
      {variant === "D3" && <VariantD3 notes={notes} doneNotes={doneNotes} />}
      <PrototypeSwitcher variant={variant} onCycle={cycle} />
    </>
  );
}
