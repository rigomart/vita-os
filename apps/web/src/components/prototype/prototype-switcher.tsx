// PROTOTYPE — throwaway. Floating variant switcher for UI prototypes:
// cycles a `?variant=` search param with the on-screen arrows or ← / →.
// Dev-only; delete together with the prototype it serves.
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect } from "react";

export interface PrototypeVariantMeta {
  key: string;
  name: string;
}

/** `null` in the cycle means "no variant" — the shipped design. */
const SHIPPED = { key: undefined, name: "Current (shipped)" };

export function PrototypeSwitcher({
  variants,
}: {
  variants: PrototypeVariantMeta[];
}) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { variant?: string };

  const cycle = [SHIPPED, ...variants];
  const index = Math.max(
    0,
    cycle.findIndex((entry) => entry.key === search.variant),
  );
  const current = cycle[index]!;

  const step = useCallback(
    (delta: number) => {
      const next = cycle[(index + delta + cycle.length) % cycle.length]!;
      void navigate({
        to: ".",
        replace: true,
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          variant: next.key,
        }),
      });
    },
    [index, navigate, variants],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      // Leave arrows alone wherever they already mean something.
      if (
        target?.closest(
          'input, textarea, select, [contenteditable], [role="listbox"], [role="option"], [role="menu"], [data-slot="select-trigger"]',
        )
      ) {
        return;
      }
      step(event.key === "ArrowRight" ? 1 : -1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [step]);

  return (
    <div className="fixed bottom-4 left-1/2 z-100 flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-900 px-2 py-1 text-neutral-50 shadow-xl">
      <button
        type="button"
        aria-label="Previous variant"
        className="rounded-full p-1 hover:bg-neutral-700"
        onClick={() => step(-1)}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-40 text-center font-mono text-xs">
        {current.name}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        className="rounded-full p-1 hover:bg-neutral-700"
        onClick={() => step(1)}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
