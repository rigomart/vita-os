/** PROTOTYPE — throwaway. Dev-only floating switcher for the Inbox variants. */
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  PROTOTYPE_VARIANTS,
  type PrototypeVariantKey,
} from "./use-prototype-variant";

export function PrototypeSwitcher({
  variant,
  onCycle,
}: {
  variant: PrototypeVariantKey;
  onCycle: (step: number) => void;
}) {
  const current = PROTOTYPE_VARIANTS.find((each) => each.key === variant);

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-900 px-1.5 py-1.5 text-xs text-neutral-100 shadow-lg ring-1 ring-white/10">
      <button
        type="button"
        aria-label="Previous variant"
        className="rounded-full p-1 hover:bg-white/10"
        onClick={() => onCycle(-1)}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-2 font-medium tabular-nums">
        {current?.key} — {current?.name}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        className="rounded-full p-1 hover:bg-white/10"
        onClick={() => onCycle(1)}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
