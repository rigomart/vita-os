// PROTOTYPE(thread-view) — throwaway. Floating bottom-centre bar that cycles
// the ?variant= search param. Not part of the design under evaluation.
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

export interface PrototypeVariantDescriptor {
  key: string;
  name: string;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

export function PrototypeSwitcher({
  variants,
}: {
  variants: PrototypeVariantDescriptor[];
}) {
  const navigate = useNavigate();
  const { variant } = useLocation({
    select: (location) => location.search,
  }) as {
    variant?: string;
  };

  const index = Math.max(
    0,
    variants.findIndex((entry) => entry.key === variant),
  );
  const current = variants[index] ?? variants[0]!;

  const goTo = (nextIndex: number) => {
    const wrapped = (nextIndex + variants.length) % variants.length;
    const next = variants[wrapped]!;
    navigate({
      to: ".",
      search: (prev) => ({
        ...prev,
        variant: next.key === "current" ? undefined : next.key,
      }),
      replace: true,
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "ArrowLeft") goTo(index - 1);
      if (event.key === "ArrowRight") goTo(index + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/95 px-2 py-1 text-zinc-100 shadow-lg backdrop-blur">
      <button
        type="button"
        aria-label="Previous variant"
        className="flex size-6 items-center justify-center rounded-full hover:bg-zinc-700"
        onClick={() => goTo(index - 1)}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-40 text-center font-mono text-xs">
        {current.key.toUpperCase()} — {current.name}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        className="flex size-6 items-center justify-center rounded-full hover:bg-zinc-700"
        onClick={() => goTo(index + 1)}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
