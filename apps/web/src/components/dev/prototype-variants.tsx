import { useLocation, useRouter } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  FlaskConical,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

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

type ToolbarPosition = "bottom" | "left" | "right" | "top";

const TOOLBAR_POSITION_STORAGE_KEY = "vita-os:prototype-toolbar-position";

const toolbarPositionClasses: Record<ToolbarPosition, string> = {
  bottom:
    "bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2",
  left: "top-1/2 left-[max(1rem,env(safe-area-inset-left))] -translate-y-1/2",
  right:
    "top-1/2 right-[max(1rem,env(safe-area-inset-right))] -translate-y-1/2",
  top: "top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2",
};

const toolbarPositions = [
  { value: "top", label: "Top", icon: ArrowUp },
  { value: "right", label: "Right", icon: ArrowRight },
  { value: "bottom", label: "Bottom", icon: ArrowDown },
  { value: "left", label: "Left", icon: ArrowLeft },
] satisfies readonly {
  value: ToolbarPosition;
  label: string;
  icon: typeof ArrowUp;
}[];

function getInitialToolbarPosition(): ToolbarPosition {
  try {
    const storedPosition = window.sessionStorage.getItem(
      TOOLBAR_POSITION_STORAGE_KEY,
    );

    if (toolbarPositions.some(({ value }) => value === storedPosition)) {
      return storedPosition as ToolbarPosition;
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  return "bottom";
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
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition>(
    getInitialToolbarPosition,
  );
  const [positionPickerOpen, setPositionPickerOpen] = useState(false);

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

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        TOOLBAR_POSITION_STORAGE_KEY,
        toolbarPosition,
      );
    } catch {
      // The toolbar remains usable when storage is unavailable.
    }
  }, [toolbarPosition]);

  return (
    <aside
      aria-label="Prototype variants"
      data-position={toolbarPosition}
      className={cn(
        "fixed z-100 flex max-w-[calc(100dvw-2rem)] items-center gap-1 rounded-full border border-white/15 bg-zinc-950 p-1.5 text-zinc-50 shadow-2xl shadow-black/35",
        toolbarPositionClasses[toolbarPosition],
        className,
      )}
    >
      <Popover open={positionPickerOpen} onOpenChange={setPositionPickerOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Move prototype toolbar (currently ${toolbarPosition})`}
              className="size-10 text-zinc-400 hover:bg-white/10 hover:text-white sm:size-8"
            />
          }
        >
          <FlaskConical aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent className="w-auto gap-2 p-2" sideOffset={8}>
          <PopoverTitle className="sr-only">
            Move prototype toolbar
          </PopoverTitle>
          <div
            aria-label="Toolbar position"
            className="grid grid-cols-2 gap-1"
            role="group"
          >
            {toolbarPositions.map(({ value, label, icon: PositionIcon }) => (
              <Button
                key={value}
                type="button"
                size="icon-lg"
                variant={toolbarPosition === value ? "secondary" : "ghost"}
                aria-label={`Move toolbar to ${label.toLowerCase()}`}
                aria-pressed={toolbarPosition === value}
                onClick={() => {
                  setToolbarPosition(value);
                  setPositionPickerOpen(false);
                }}
              >
                <PositionIcon aria-hidden="true" />
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <button
        type="button"
        aria-label="Previous prototype variant"
        className="flex size-10 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:size-8"
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
                "min-w-10 rounded-full px-2.5 py-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-w-8 sm:py-1.5",
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
        className="flex size-10 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:size-8"
        onClick={() => cycle(1)}
      >
        <ArrowRight aria-hidden="true" className="size-4" />
      </button>

      <span className="hidden max-w-44 truncate pr-3 text-xs text-zinc-300 sm:block">
        {activeVariant.name}
      </span>
    </aside>
  );
}
