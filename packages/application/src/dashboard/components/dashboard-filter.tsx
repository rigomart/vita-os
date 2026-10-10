import { Link, useNavigate } from "@tanstack/react-router";
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
import { ChevronDown, Layers, Settings2, StickyNote, Tag } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import type { DashboardFilterOption } from "./dashboard-filter-model";

import { AreaIcon } from "../../areas/components/area-icon";
import { ManageAreasDialog } from "../../areas/manage-areas/manage-areas-dialog";
import { useDashboardPath } from "../../navigation/dashboard-path";
import { withDashboardFilter } from "../../navigation/search-params";
import { fitFilterChips } from "./dashboard-filter-fit";

/** Room kept for the More button once some chips fold. */
const MORE_WIDTH = 92;
/** The gap between chips. */
const GAP = 2;
/** The pill's own padding, the margin setting Notes apart, and some slack. */
const PADDING = 24;

interface Measure {
  widths: number[];
  room: number;
}

/**
 * The board's filter, one pill group: All, each Area with its count and No
 * area, then Notes set apart, then Edit areas. Choosing one filters the board
 * and writes the choice to the URL, so a filtered Dashboard survives a reload
 * and an open Thread. Notes is set apart because it is not an Area.
 *
 * The row never wraps and never scrolls. Every chip is measured in a hidden
 * ruler; those that fit show and the rest fold into More, in the same order.
 * The selected chip always shows, and so does Notes (`fitFilterChips`).
 */
export function DashboardFilter({
  options,
}: {
  options: DashboardFilterOption[];
}) {
  const navigate = useNavigate();
  const dashboard = useDashboardPath();
  const [manageOpen, setManageOpen] = useState(false);
  const areas = options.filter((option) => !option.separated);
  const notes = options.filter((option) => option.separated);

  const frame = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLDivElement>(null);
  // Unmeasured, every chip shows; that is also how a test renders.
  const [measure, setMeasure] = useState<Measure | null>(null);
  // What changes a chip's width: its words, its count, and being selected.
  const signature = options
    .map(
      (option) =>
        `${option.key}:${option.label}:${option.count}:${option.selected}`,
    )
    .join("|");

  useLayoutEffect(() => {
    const measureRow = () => {
      if (frame.current === null || ruler.current === null) return;
      const width = frame.current.clientWidth;
      if (width === 0) return;
      const widths = [...ruler.current.children].map(
        (child) => (child as HTMLElement).offsetWidth + GAP,
      );
      const areaCount = widths.length - notes.length - 1;
      const beside = widths.slice(areaCount).reduce((a, b) => a + b, 0);
      const next = {
        widths: widths.slice(0, areaCount),
        room: width - beside - PADDING,
      };
      setMeasure((previous) =>
        previous !== null &&
        previous.room === next.room &&
        previous.widths.join() === next.widths.join()
          ? previous
          : next,
      );
    };
    measureRow();
    // The frame resizes with the window; the ruler when a web font lands.
    const observer = new ResizeObserver(measureRow);
    if (frame.current) observer.observe(frame.current);
    if (ruler.current) observer.observe(ruler.current);
    return () => observer.disconnect();
    // The ruler's chips change only with the signature.
  }, [signature, notes.length]);

  const selected = areas.findIndex((option) => option.selected);
  const shownIndices =
    measure === null || measure.widths.length !== areas.length
      ? areas.map((_, index) => index)
      : fitFilterChips({ ...measure, moreWidth: MORE_WIDTH, selected });
  const shown = shownIndices.map((index) => areas[index]!);
  const folded = areas.filter((_, index) => !shownIndices.includes(index));

  return (
    <div ref={frame} className="relative w-full min-w-0">
      {/* The ruler: every chip at its natural width, never seen. */}
      <div
        ref={ruler}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex"
      >
        {options.map((option) => (
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
          <FilterLink key={option.key} option={option} />
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
                value={options.find((option) => option.selected)?.key}
                onValueChange={(key) => {
                  const option = folded.find((each) => each.key === key);
                  if (option === undefined) return;
                  void navigate({
                    to: dashboard,
                    search: withDashboardFilter(option.search),
                  });
                }}
              >
                {folded.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.key}
                    value={option.key}
                    closeOnClick
                    className={cn(option.muted && "text-muted-foreground")}
                  >
                    <OptionIcon option={option} />
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
              <DropdownMenuItem onClick={() => setManageOpen(true)}>
                <Settings2 />
                Edit areas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {notes.map((option) => (
          <FilterLink key={option.key} option={option} className="ml-2" />
        ))}
        <button
          type="button"
          aria-label="Edit areas"
          title="Edit areas"
          onClick={() => setManageOpen(true)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Settings2 aria-hidden className="size-3.5" />
        </button>
      </nav>

      {/* Mounted on demand, like the shell's dialogs: it holds form state
          that should not survive a close. */}
      {manageOpen && <ManageAreasDialog open onOpenChange={setManageOpen} />}
    </div>
  );
}

function FilterLink({
  option,
  className,
}: {
  option: DashboardFilterOption;
  className?: string;
}) {
  const dashboard = useDashboardPath();
  return (
    <Link
      to={dashboard}
      search={withDashboardFilter(option.search)}
      // Exact, so All — whose search only clears — is not active under every
      // other option too.
      activeOptions={{ exact: true }}
      aria-current={option.selected ? "true" : undefined}
      className={cn(
        chip(option),
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      <ChipContent option={option} />
    </Link>
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
      <OptionIcon option={option} />
      {option.label}
      <span className="text-[11px] tabular-nums opacity-60">
        {option.count}
      </span>
    </>
  );
}

function OptionIcon({ option }: { option: DashboardFilterOption }) {
  if (option.area !== undefined) {
    return <AreaIcon icon={option.area.icon} className="size-3.5 shrink-0" />;
  }
  const Icon =
    option.key === "notes"
      ? StickyNote
      : option.search.area === undefined
        ? Layers
        : Tag;
  return <Icon aria-hidden className="size-3.5 shrink-0" />;
}
