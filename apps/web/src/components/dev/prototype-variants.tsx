import { useLocation, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, FlaskConical } from "lucide-react";
import { useCallback, useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PrototypeVariant {
  key: string;
  name: string;
  render: () => ReactNode;
}

interface PrototypeVariantsProps {
  variants: readonly [PrototypeVariant, ...PrototypeVariant[]];
  defaultVariant?: string;
  searchParam?: string;
  className?: string;
}

interface PrototypeVariantSelectorProps {
  variants: readonly [PrototypeVariant, ...PrototypeVariant[]];
  activeKey: string;
  onSelect: (key: string) => void;
  className?: string;
}

function canHandleArrowKey(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;

  return !target.closest("input, textarea, select, [contenteditable]");
}

export function PrototypeVariants({
  variants,
  defaultVariant,
  searchParam = "variant",
  className,
}: PrototypeVariantsProps) {
  const router = useRouter();
  const location = useLocation();
  const requestedKey = new URLSearchParams(location.searchStr).get(searchParam);
  const fallbackVariant =
    variants.find(({ key }) => key === defaultVariant) ?? variants[0];
  const activeVariant =
    variants.find(({ key }) => key === requestedKey) ?? fallbackVariant;

  const selectVariant = useCallback(
    (key: string) => {
      const search = new URLSearchParams(location.searchStr);
      search.set(searchParam, key);
      const searchString = search.toString();
      const href = `${location.pathname}${searchString ? `?${searchString}` : ""}${location.hash}`;

      void router.navigate({ href, replace: true, resetScroll: false });
    },
    [location.hash, location.pathname, location.searchStr, router, searchParam],
  );

  return (
    <>
      {activeVariant.render()}
      {import.meta.env.DEV && (
        <PrototypeVariantSelector
          variants={variants}
          activeKey={activeVariant.key}
          onSelect={selectVariant}
          className={className}
        />
      )}
    </>
  );
}

export function PrototypeVariantSelector({
  variants,
  activeKey,
  onSelect,
  className,
}: PrototypeVariantSelectorProps) {
  const activeIndex = Math.max(
    variants.findIndex(({ key }) => key === activeKey),
    0,
  );
  const activeVariant = variants[activeIndex];

  const cycle = useCallback(
    (offset: number) => {
      const nextIndex =
        (activeIndex + offset + variants.length) % variants.length;
      onSelect(variants[nextIndex].key);
    },
    [activeIndex, onSelect, variants],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!canHandleArrowKey(event.target)) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        cycle(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        cycle(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cycle]);

  return (
    <aside
      aria-label="Prototype variants"
      className={cn(
        "fixed bottom-5 left-1/2 z-100 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-zinc-950 p-1.5 text-zinc-50 shadow-2xl shadow-black/35",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 px-2 text-xs font-medium text-zinc-400">
        <FlaskConical aria-hidden="true" className="size-3.5" />
        Prototype
      </span>

      <button
        type="button"
        aria-label="Previous prototype variant"
        className="flex size-8 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={() => cycle(-1)}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
      </button>

      <div aria-label="Choose a prototype variant" className="flex gap-1">
        {variants.map((variant) => {
          const isActive = variant.key === activeKey;

          return (
            <button
              key={variant.key}
              type="button"
              aria-label={`${variant.key} — ${variant.name}`}
              aria-pressed={isActive}
              className={cn(
                "min-w-8 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                isActive
                  ? "bg-white text-zinc-950"
                  : "text-zinc-400 hover:bg-white/10 hover:text-white",
              )}
              onClick={() => onSelect(variant.key)}
            >
              {variant.key}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Next prototype variant"
        className="flex size-8 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={() => cycle(1)}
      >
        <ArrowRight aria-hidden="true" className="size-4" />
      </button>

      <span className="max-w-44 truncate pr-3 text-xs text-zinc-300">
        {activeVariant.name}
      </span>
    </aside>
  );
}
