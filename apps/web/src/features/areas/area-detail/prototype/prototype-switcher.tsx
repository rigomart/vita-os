// PROTOTYPE — throwaway code. Floating variant switcher for the Area view
// design prototype. Deliberately styled OUTSIDE the app's design language so
// it never reads as part of the design being evaluated. Dev-only.

import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

interface PrototypeSwitcherProps {
  keys: string[];
  labels: Record<string, string>;
  current: string;
}

export function PrototypeSwitcher(props: PrototypeSwitcherProps) {
  if (!import.meta.env.DEV) return null;
  return <SwitcherBar {...props} />;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable)
  );
}

function SwitcherBar({ keys, labels, current }: PrototypeSwitcherProps) {
  const navigate = useNavigate();

  const cycle = (delta: number) => {
    const index = Math.max(0, keys.indexOf(current));
    const next = keys[(index + delta + keys.length) % keys.length];
    navigate({
      to: ".",
      search: (prev) => ({
        ...prev,
        variant: next === "current" ? undefined : next,
      }),
      replace: true,
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      cycle(event.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-900/95 px-2 py-1.5 font-mono text-xs text-zinc-100 shadow-xl ring-1 ring-white/15 md:bottom-4">
      <button
        type="button"
        aria-label="Previous variant"
        className="rounded-full p-1 hover:bg-white/15"
        onClick={() => cycle(-1)}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <span className="min-w-40 px-1 text-center tabular-nums">
        {current.toUpperCase()} — {labels[current] ?? "?"}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        className="rounded-full p-1 hover:bg-white/15"
        onClick={() => cycle(1)}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}
