/**
 * PROTOTYPE (issue #280) — floating variant switcher. Not part of any design
 * being evaluated; deliberately high-contrast and dev-only.
 */
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

import type { PrototypeVariant } from "@/routes/_authenticated/route";

export const PROTOTYPE_VARIANT_NAMES: Record<PrototypeVariant, string> = {
  a: "Runway",
  b: "Journal & Dock",
  c: "Continuum",
  d: "Deck",
  e: "Horizon",
};

const ORDER: PrototypeVariant[] = ["a", "b", "c", "d", "e"];

export function PrototypeSwitcher({ current }: { current: PrototypeVariant }) {
  const navigate = useNavigate();

  const cycle = (direction: 1 | -1) => {
    const index = ORDER.indexOf(current);
    const next = ORDER[(index + direction + ORDER.length) % ORDER.length];
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, variant: next }),
      replace: true,
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, [contenteditable]") ||
        target?.isContentEditable
      ) {
        return;
      }
      const index = ORDER.indexOf(current);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = ORDER[(index + direction + ORDER.length) % ORDER.length];
      void navigate({
        to: ".",
        search: (prev) => ({ ...prev, variant: next }),
        replace: true,
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, navigate]);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-900 px-2 py-1.5 text-zinc-50 shadow-lg ring-1 ring-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:ring-zinc-300">
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => cycle(-1)}
        className="rounded-full p-1 hover:bg-zinc-700 dark:hover:bg-zinc-200"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-40 text-center font-mono text-xs uppercase tracking-wider">
        {current} — {PROTOTYPE_VARIANT_NAMES[current]}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => cycle(1)}
        className="rounded-full p-1 hover:bg-zinc-700 dark:hover:bg-zinc-200"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
