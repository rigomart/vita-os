// PROTOTYPE — throwaway thread-line variant experiment, do not ship
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

import type { PrototypeVariant } from "./use-prototype-variant";

import {
  PROTOTYPE_VARIANT_LABELS,
  PROTOTYPE_VARIANTS,
  usePrototypeVariantState,
} from "./use-prototype-variant";

/**
 * Deliberately loud and unstyled-for-this-product: inverted surface, hard
 * shadow, fixed to the bottom of the viewport. Nobody should mistake the
 * switcher for part of the design being evaluated.
 */
export function PrototypeSwitcher() {
  const { setVariant, variant } = usePrototypeVariantState();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      setVariant(step(variant, event.key === "ArrowRight" ? 1 : -1));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setVariant, variant]);

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground px-1.5 py-1 text-background shadow-xl">
      <button
        type="button"
        aria-label="Previous thread variant"
        onClick={() => setVariant(step(variant, -1))}
        className="flex size-7 items-center justify-center rounded-full hover:bg-background/20"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-56 px-2 text-center text-xs font-medium tabular-nums">
        <span className="font-mono">{variant}</span>
        {" — "}
        {PROTOTYPE_VARIANT_LABELS[variant]}
      </span>
      <button
        type="button"
        aria-label="Next thread variant"
        onClick={() => setVariant(step(variant, 1))}
        className="flex size-7 items-center justify-center rounded-full hover:bg-background/20"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

function step(current: PrototypeVariant, delta: number): PrototypeVariant {
  const index = PROTOTYPE_VARIANTS.indexOf(current);
  const length = PROTOTYPE_VARIANTS.length;
  return PROTOTYPE_VARIANTS[(index + delta + length) % length];
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
