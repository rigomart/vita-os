/** PROTOTYPE — throwaway. Delete with the rest of this branch. */
import { useEffect, useState } from "react";

/**
 * Cycles a variant key through a list, reading the initial value from a
 * `?<param>=` search param and writing it back with `replaceState` so a
 * reload or a copied URL lands on the same variant.
 *
 * It stays off the router on purpose: the dashboard's tests mock
 * `@tanstack/react-router`, and a prototype has no business making them care.
 */
export function usePrototypeVariant<K extends string>(
  param: string,
  variants: readonly K[],
): [K, (next: K) => void] {
  const fromUrl =
    typeof window === "undefined"
      ? undefined
      : (new URLSearchParams(window.location.search).get(param) as K | null);

  const [current, setCurrent] = useState<K>(
    fromUrl != null && variants.includes(fromUrl) ? fromUrl : variants[0]!,
  );

  const select = (next: K) => {
    setCurrent(next);
    const url = new URL(window.location.href);
    url.searchParams.set(param, next);
    window.history.replaceState(window.history.state, "", url);
  };

  return [current, select];
}

/**
 * Floating bar that steps through the variants. Deliberately loud so it never
 * reads as part of the design being judged, and stripped from production.
 */
export function PrototypeSwitcher<K extends string>({
  current,
  names,
  onSelect,
  variants,
}: {
  current: K;
  names?: Record<K, string>;
  onSelect: (next: K) => void;
  variants: readonly K[];
}) {
  const step = (delta: number) => {
    const index = variants.indexOf(current);
    onSelect(variants[(index + delta + variants.length) % variants.length]!);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']") !=
        null
      ) {
        return;
      }
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-900 p-1 text-neutral-50 shadow-lg ring-1 ring-white/15">
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => step(-1)}
        className="size-7 rounded-full text-sm hover:bg-white/15"
      >
        ←
      </button>
      <span className="px-2 text-xs font-medium whitespace-nowrap">
        {current}
        {names ? ` — ${names[current]}` : ""}
        <span className="pl-2 tabular-nums text-neutral-400">
          {variants.indexOf(current) + 1}/{variants.length}
        </span>
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => step(1)}
        className="size-7 rounded-full text-sm hover:bg-white/15"
      >
        →
      </button>
    </div>
  );
}
