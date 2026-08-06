// PROTOTYPE (issue #247) — THROWAWAY CODE, do not ship.
//
// Plan: three nav-chrome variants plus the current sidebar as baseline, switchable
// via `?variant=` on the existing authenticated layout. Real routes, real data —
// only the chrome swaps.
//
//   current — today's sidebar (reference point)
//   A       — top bar, no sidebar; breadcrumbs with segment dropdowns (direction 1)
//   B       — slim icon rail: areas w/ condition dot + open-thread count (direction 2),
//             bottom tab bar on mobile (direction 3)
//   C       — palette-first: minimal top bar, ⌘K jump-to-anything as primary nav
//             (direction 4), bottom tab bar on mobile (direction 3)
//
// The variant is kept in the URL (`?variant=`) for shareability and mirrored to
// localStorage so it survives in-app navigation (router links drop unknown params).

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export const NAV_VARIANTS = [
  { key: "current", name: "Current sidebar" },
  { key: "A", name: "Top bar" },
  { key: "B", name: "Slim rail" },
  { key: "C", name: "Palette-first" },
] as const;

export type NavVariantKey = (typeof NAV_VARIANTS)[number]["key"];

const STORAGE_KEY = "nav-prototype-variant-247";

function isVariantKey(value: string | null): value is NavVariantKey {
  return NAV_VARIANTS.some((v) => v.key === value);
}

export function useNavVariant() {
  const [variant, setVariantState] = useState<NavVariantKey>(() => {
    if (import.meta.env.PROD || typeof window === "undefined") return "current";
    const fromUrl = new URLSearchParams(window.location.search).get("variant");
    if (isVariantKey(fromUrl)) return fromUrl;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isVariantKey(stored)) return stored;
    return "current";
  });

  const setVariant = useCallback((key: NavVariantKey) => {
    setVariantState(key);
    window.localStorage.setItem(STORAGE_KEY, key);
    const url = new URL(window.location.href);
    url.searchParams.set("variant", key);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return [variant, setVariant] as const;
}

export function NavPrototypeSwitcher({
  variant,
  onVariantChange,
}: {
  variant: NavVariantKey;
  onVariantChange: (key: NavVariantKey) => void;
}) {
  const index = NAV_VARIANTS.findIndex((v) => v.key === variant);

  const cycle = useCallback(
    (delta: number) => {
      const next =
        NAV_VARIANTS[
          (index + delta + NAV_VARIANTS.length) % NAV_VARIANTS.length
        ];
      onVariantChange(next.key);
    },
    [index, onVariantChange],
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      cycle(e.key === "ArrowLeft" ? -1 : 1);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cycle]);

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-amber-500/50 bg-zinc-900 py-1 pr-3 pl-1 text-zinc-50 shadow-lg md:bottom-4 dark:bg-zinc-100 dark:text-zinc-900">
      <button
        type="button"
        onClick={() => cycle(-1)}
        aria-label="Previous variant"
        className="flex size-7 items-center justify-center rounded-full hover:bg-zinc-700 dark:hover:bg-zinc-300"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => cycle(1)}
        aria-label="Next variant"
        className="flex size-7 items-center justify-center rounded-full hover:bg-zinc-700 dark:hover:bg-zinc-300"
      >
        <ChevronRight className="size-4" />
      </button>
      <span className="text-xs font-medium whitespace-nowrap tabular-nums">
        {variant} — {NAV_VARIANTS[index]?.name}
      </span>
    </div>
  );
}
