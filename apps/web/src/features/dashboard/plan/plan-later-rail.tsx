import { useDroppable } from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState } from "react";

import type { SlotDropData } from "./plan-axis";
import type { LaneChrome } from "./plan-lane";
import type { Lane } from "./plan-model";

import { PlanChip } from "./plan-chip";

/** The one droppable the rail owns; the canvas has no other `beyond` target. */
const LATER_DROP_ID = "bucket::beyond";

/**
 * Total width, corridor included. The rail is collapsed to a spine until there
 * is something to do with it, and opens wide enough for a chip to read.
 */
const SPINE_WIDTH = "w-12";
const OPEN_WIDTH = "w-[238px]";
/** Between the phone schedule and a roomy canvas, the rail gives ground. */
const OPEN_WIDTH_NARROW = "w-[198px]";

/**
 * **Later** — work dated past the far end of the axis, held in a rail beside
 * the day scroller rather than in a column of its own.
 *
 * A day the calendar does not draw has no column to sit in, so Later sits
 * outside the calendar entirely: a spine at the canvas' right edge, naming its
 * count and nothing else, that opens when there is something to do with it —
 * pinned by hand, or by a chip leaving its slot. Because it is a sibling of the
 * scroller and not a cell inside it, the target holds still however far the
 * days are scrolled.
 *
 * A drop here names no single day, so the canvas answers it with a calendar
 * instead of a mutation — see `plan-later-dialog.tsx`. The rail publishes no
 * `laneId`: like the ruler, it means "further out, whichever lane you came
 * from", so a Thread dropped here keeps its Area, and each chip carries its own
 * lane back for the drag out.
 *
 * **Two rules keep the drop landable.** dnd-kit measures every droppable once
 * as the drag starts and afterwards only compensates those rects for scrolling,
 * so the rail's rect has to be right at that one moment, at the width it will
 * be dropped on:
 *
 * 1. *The rail must already be open in the commit that starts the drag.* It is:
 *    the canvas' `onDragStart` — which sets the drag state this reads — runs
 *    inside the same batch as dnd-kit's own drag-start dispatch, so the open
 *    width is on screen before any rect is taken.
 * 2. *The width must never transition.* An animating box measures mid-flight,
 *    and every drop for the rest of that drag lands on a sliver of the target.
 */
export function LaterRail({
  chrome,
  lanes,
}: {
  chrome: LaneChrome;
  /** The lanes on screen — an Area filtered out takes its far work with it. */
  lanes: Lane[];
}) {
  const { density, drag, narrow, now, onOpen } = chrome;
  const [pinned, setPinned] = useState(false);
  const contentId = useId();

  const { isOver, setNodeRef } = useDroppable({
    id: LATER_DROP_ID,
    data: { slotKey: "beyond" } satisfies SlotDropData,
  });

  const groups = lanes
    .map((lane) => ({
      id: lane.id,
      items: lane.beyond,
      name: lane.area?.name ?? "Inbox",
    }))
    .filter((group) => group.items.length > 0);

  const count = groups.reduce((sum, group) => sum + group.items.length, 0);
  const open = pinned || drag != null;
  const armed = drag != null && isOver;

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label="Later"
      data-slot-key="beyond"
      // The droppable owns the gutter between the days and the rail: an 8px
      // corridor with no target in it would drop the pointer back onto nothing
      // mid-approach, and the lanes would start scrolling again.
      className={cn(
        "relative shrink-0 pl-2",
        open ? (narrow ? OPEN_WIDTH_NARROW : OPEN_WIDTH) : SPINE_WIDTH,
      )}
    >
      {/* Nothing here is in flow: the rail takes its height from the lanes
          beside it, and its content scrolls inside that rather than stretching
          the canvas to fit however much is dated far out. */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 left-2 rounded-xl border border-dashed border-border bg-surface-2/60 transition-colors",
          armed && "border-solid border-foreground/40 bg-surface-3/70",
        )}
      >
        <div
          id={contentId}
          className={cn(
            "absolute inset-0 overflow-y-auto",
            open && (density === "compact" ? "p-2" : "p-2.5"),
          )}
        >
          {open ? (
            <>
              <div className="mb-2 flex items-baseline gap-1.5 pr-6">
                <span className="text-2xs font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase">
                  Later
                </span>
                <span className="text-xs tabular-nums text-muted-foreground/70">
                  {count}
                </span>
              </div>

              {count === 0 ? (
                <p className="text-xs text-muted-foreground/45">
                  Drop here to pick a further day
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {groups.map((group) => (
                    <div key={group.id} className="flex flex-col gap-1">
                      <span className="truncate text-2xs font-semibold tracking-[0.08em] text-muted-foreground/55 uppercase">
                        {group.name}
                      </span>
                      {group.items.map((item) => (
                        <PlanChip
                          key={item.id}
                          density={density}
                          item={item}
                          laneId={group.id}
                          now={now}
                          onOpen={onOpen}
                          slotKey="beyond"
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Read bottom-up like a spine, under the count it is holding.
            <div className="flex h-full flex-col items-center gap-2 py-2.5 text-muted-foreground/70">
              <span className="mt-5 text-xs tabular-nums">{count}</span>
              <span className="text-2xs font-semibold tracking-[0.12em] uppercase [writing-mode:vertical-rl]">
                Later
              </span>
            </div>
          )}
        </div>

        {/* One button in both states — collapsed it *is* the spine, open it is
            the chevron above the list — so pinning never pulls the focused
            element out from under the keyboard. */}
        <button
          type="button"
          aria-controls={contentId}
          aria-expanded={open}
          aria-label="Later rail"
          className={cn(
            "absolute text-muted-foreground/60 transition-colors hover:text-foreground",
            open
              ? "top-2 right-2 rounded-md"
              : "inset-0 flex justify-center rounded-xl pt-2.5",
          )}
          onClick={() => setPinned(!pinned)}
        >
          {pinned ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronLeft className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
