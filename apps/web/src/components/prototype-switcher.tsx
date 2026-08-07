// PROTOTYPE — throwaway. Floating variant switcher for UI prototypes,
// driven by the `?variant=` search param on the authenticated routes.
// Remove together with src/features/dashboard/prototype/.
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect } from "react";

export type PrototypeVariantKey = "a" | "b" | "c";

/**
 * Resolves the active prototype variant for its children. Renders with
 * `undefined` (the current production UI) in production builds and outside a
 * RouterProvider (unit tests render screens bare), so only dev browsing with
 * `?variant=` ever sees a prototype.
 */
export function PrototypeVariantGate({
  children,
}: {
  children: (variant: PrototypeVariantKey | undefined) => ReactNode;
}) {
  const router = useRouter({ warn: false });
  if (import.meta.env.PROD || !router) return <>{children(undefined)}</>;
  return <RoutedVariantGate>{children}</RoutedVariantGate>;
}

function RoutedVariantGate({
  children,
}: {
  children: (variant: PrototypeVariantKey | undefined) => ReactNode;
}) {
  const { variant } = useSearch({ from: "/_authenticated" });
  return <>{children(variant)}</>;
}

interface PrototypeVariant {
  key: PrototypeVariantKey | undefined;
  label: string;
}

const VARIANTS: PrototypeVariant[] = [
  { key: undefined, label: "Current — Overview default" },
  { key: "a", label: "A — Plan default · health on Overview tab" },
  { key: "b", label: "B — Plan default · health inside Plan" },
  { key: "c", label: "C — Plan-first single surface" },
];

export function PrototypeSwitcher() {
  const router = useRouter({ warn: false });
  if (import.meta.env.PROD || !router) return null;
  return <PrototypeSwitcherBar />;
}

function PrototypeSwitcherBar() {
  const { variant } = useSearch({ from: "/_authenticated" });
  const navigate = useNavigate();

  const index = Math.max(
    0,
    VARIANTS.findIndex((entry) => entry.key === variant),
  );

  const cycle = (delta: number) => {
    const next = VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length];
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, variant: next.key }),
      replace: true,
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      cycle(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground py-1.5 pl-1.5 pr-4 text-background shadow-lg">
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => cycle(-1)}
        className="rounded-full p-1 transition-colors hover:bg-background/20"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => cycle(1)}
        className="rounded-full p-1 transition-colors hover:bg-background/20"
      >
        <ChevronRight className="size-4" />
      </button>
      <span className="text-xs font-medium tabular-nums">
        {VARIANTS[index].label}
      </span>
    </div>
  );
}
