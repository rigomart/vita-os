/**
 * PROTOTYPE — issue #314. The floating variant bar. Dev-only; never renders in
 * a production build.
 */
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

export interface VariantMeta {
  /** How this variant answers issue #236. */
  stance: string;
  key: string;
  name: string;
}

export function PrototypeSwitcher({
  current,
  narrow,
  source,
  variants,
}: {
  current: string;
  narrow: boolean;
  source: "fixture" | "live";
  variants: VariantMeta[];
}) {
  const navigate = useNavigate();
  const index = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current),
  );
  const meta = variants[index];

  useEffect(() => {
    const step = (delta: number) => {
      const next =
        variants[(index + delta + variants.length) % variants.length];
      void navigate({
        to: ".",
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          variant: next?.key,
        }),
        replace: true,
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, navigate, variants]);

  if (!import.meta.env.DEV) return null;

  const go = (delta: number) =>
    variants[(index + delta + variants.length) % variants.length]?.key;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full flex-col items-center gap-1 rounded-xl border-2 border-foreground bg-background px-2 py-1.5 shadow-lg">
        <div className="flex items-center gap-1">
          <Step direction={-1} target={go(-1)} />
          <span className="px-2 text-xs font-semibold tabular-nums">
            {meta?.key} — {meta?.name}
          </span>
          <Step direction={1} target={go(1)} />

          <span aria-hidden className="mx-1 h-5 w-px bg-border" />

          <Toggle
            active={narrow}
            label={narrow ? "Constrained" : "Wide"}
            param="narrow"
            value={narrow ? undefined : true}
          />
          <Toggle
            active={source === "live"}
            label={source === "live" ? "Live data" : "Fixture"}
            param="source"
            value={source === "live" ? undefined : "live"}
          />
        </div>
        <p className="max-w-[46rem] px-1 text-center text-[10px] leading-tight text-muted-foreground">
          #236: {meta?.stance}
        </p>
      </div>
    </div>
  );
}

function Step({ direction, target }: { direction: -1 | 1; target?: string }) {
  const navigate = useNavigate();
  const Icon = direction === -1 ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={direction === -1 ? "Previous variant" : "Next variant"}
      onClick={() =>
        void navigate({
          to: ".",
          search: (previous: Record<string, unknown>) => ({
            ...previous,
            variant: target,
          }),
          replace: true,
        })
      }
      className="inline-flex size-7 items-center justify-center rounded-md hover:bg-muted"
    >
      <Icon className="size-4" />
    </button>
  );
}

function Toggle({
  active,
  label,
  param,
  value,
}: {
  active: boolean;
  label: string;
  param: string;
  value: unknown;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() =>
        void navigate({
          to: ".",
          search: (previous: Record<string, unknown>) => ({
            ...previous,
            [param]: value,
          }),
          replace: true,
        })
      }
      className={cn(
        "rounded-md px-2 py-1 text-2xs font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
