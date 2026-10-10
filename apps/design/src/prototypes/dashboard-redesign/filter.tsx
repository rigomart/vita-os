import type { DashboardFilterOption } from "@vita-os/application/internal/dashboard/components/dashboard-filter-model.ts";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronDown, Settings2 } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { type Board, FilterIcon, FilterLink, useSetFilter } from "./board";
import { useShell } from "./shell";

/** Room kept for the More button when some chips don't fit. */
const MORE_WIDTH = 92;
const GAP = 2;

/**
 * All, each Area with its count and No area, then Notes set apart, with the
 * edit button at the end. The row never scrolls: the chips that fit show, the
 * rest fold into More, in the same order. The chosen chip always shows, taking
 * the last place if it would have folded, and so does Notes.
 */
export function Filter({ board }: { board: Board }) {
  const { manageAreas } = useShell();
  const setFilter = useSetFilter();
  const areas = board.options.filter((option) => !option.separated);
  const notes = board.options.filter((option) => option.separated);

  const frame = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(areas.length);

  // Measure every chip once in a hidden row, then keep as many as the frame
  // holds beside Notes and the edit button.
  useLayoutEffect(() => {
    const measure = () => {
      if (frame.current === null || ruler.current === null) return;
      const widths = [...ruler.current.children].map(
        (child) => (child as HTMLElement).offsetWidth + GAP,
      );
      const fixed = widths.slice(areas.length).reduce((a, b) => a + b, 0);
      const room = frame.current.clientWidth - fixed - 16;
      const areaWidths = widths.slice(0, areas.length);
      const total = areaWidths.reduce((a, b) => a + b, 0);
      if (total <= room) {
        setFits(areas.length);
        return;
      }
      let used = 0;
      let count = 0;
      for (const width of areaWidths) {
        if (used + width > room - MORE_WIDTH) break;
        used += width;
        count += 1;
      }
      setFits(Math.max(count, 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (frame.current) observer.observe(frame.current);
    return () => observer.disconnect();
  }, [areas.length, board.options]);

  const selectedIndex = areas.findIndex((option) => option.selected);
  let shown = areas.slice(0, fits);
  if (selectedIndex >= fits) {
    shown = [...areas.slice(0, Math.max(fits - 1, 0)), areas[selectedIndex]!];
  }
  const folded = areas.filter((option) => !shown.includes(option));

  return (
    <div ref={frame} className="relative w-full min-w-0">
      {/* The ruler: every chip at its natural width, never seen. */}
      <div
        ref={ruler}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex"
      >
        {[...areas, ...notes].map((option) => (
          <span key={option.key} className={chip(option)}>
            <ChipContent option={option} />
          </span>
        ))}
        <span className="inline-flex size-8 shrink-0" />
      </div>

      <nav
        aria-label="Filter the board"
        className="flex w-fit max-w-full items-center gap-0.5 rounded-full bg-muted/70 p-1"
      >
        {shown.map((option) => (
          <FilterLink key={option.key} option={option} className={chip(option)}>
            <ChipContent option={option} />
          </FilterLink>
        ))}

        {folded.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              }
            >
              {folded.length} more
              <ChevronDown aria-hidden className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-52">
              <DropdownMenuRadioGroup
                value={board.options.find((option) => option.selected)?.key}
                onValueChange={(key) => {
                  const option = folded.find((each) => each.key === key);
                  if (option) setFilter(option);
                }}
              >
                {folded.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.key}
                    value={option.key}
                    closeOnClick
                    className={cn(option.muted && "text-muted-foreground")}
                  >
                    <FilterIcon option={option} />
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {option.count}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={manageAreas}>
                <Settings2 />
                Edit areas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {notes.map((option) => (
          <FilterLink
            key={option.key}
            option={option}
            className={cn(chip(option), "ml-2")}
          >
            <ChipContent option={option} />
          </FilterLink>
        ))}
        <button
          type="button"
          aria-label="Edit areas"
          title="Edit areas"
          onClick={manageAreas}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <Settings2 aria-hidden className="size-3.5" />
        </button>
      </nav>
    </div>
  );
}

function chip(option: DashboardFilterOption) {
  return cn(
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap transition-colors",
    option.selected
      ? "bg-surface-2 font-semibold text-foreground shadow-sm ring-1 ring-border"
      : option.muted
        ? "text-muted-foreground/50 hover:text-foreground"
        : "text-muted-foreground hover:text-foreground",
  );
}

function ChipContent({ option }: { option: DashboardFilterOption }) {
  return (
    <>
      <FilterIcon option={option} />
      {option.label}
      <span className="text-[11px] tabular-nums opacity-60">
        {option.count}
      </span>
    </>
  );
}
