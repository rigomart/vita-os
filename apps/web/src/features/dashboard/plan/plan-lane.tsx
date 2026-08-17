import { useDroppable } from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { CircleDashed, CornerDownRight, Inbox } from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { AreaQuickPanel } from "@/features/areas/components/area-quick-panel";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { conditionShort } from "@/features/areas/condition-presentation";

import type { SlotDropData } from "./plan-axis";
import type {
  Axis,
  DaySlot,
  Density,
  DragState,
  Lane,
  PlanItem,
} from "./plan-model";

import { TODAY_COLUMN } from "./plan-axis";
import { PlanChip } from "./plan-chip";
import {
  bayWidth,
  byDateThenTitle,
  conditionIconTone,
  conditionLaneTint,
  conditionRailTone,
  INBOX_LANE_ID,
} from "./plan-model";

export interface LaneChrome {
  axis: Axis;
  density: Density;
  drag: DragState | null;
  /** Below the md breakpoint: the header column stacks icon over name. */
  narrow: boolean;
  now: number;
  /** Capture scoped to one Area, from its lane header's Quick Panel. */
  onNewThreadInArea: (areaId: string) => void;
  onOpen: (item: PlanItem) => void;
}

/**
 * One Area as a horizontal band under the shared ruler.
 *
 * Chips sit in the day slot matching their date and read left to right in date
 * order; anything already past docks in the tinted waiting bay at the lane's
 * left edge, and anything dated past the axis docks in the Later bay pinned at
 * its right. Dragging along the lane retargets the day, dragging across lanes
 * moves the Thread's Area.
 */
export function LaneRow({
  chrome,
  lane,
  last,
}: {
  chrome: LaneChrome;
  lane: Lane;
  last?: boolean;
}) {
  const { drag } = chrome;
  const isInbox = lane.id === INBOX_LANE_ID;
  const incoming =
    drag != null &&
    drag.kind === "thread" &&
    !isInbox &&
    drag.overLaneId === lane.id &&
    drag.laneId !== lane.id;

  const tint = lane.area ? conditionLaneTint[lane.area.condition] : "";

  return (
    <div
      className={cn(
        "relative grid w-full bg-surface-1 transition-shadow",
        isInbox ? "border-t-2 border-border" : "border-b border-border/50",
        last && !isInbox && "border-b-0",
        incoming && "ring-1 ring-foreground/35 ring-inset",
      )}
      style={{ gridTemplateColumns: chrome.axis.template }}
    >
      <Tint className={tint} />

      {isInbox ? (
        <InboxLaneHeader lane={lane} narrow={chrome.narrow} />
      ) : (
        <AreaLaneHeader
          incoming={incoming}
          lane={lane}
          narrow={chrome.narrow}
          onNewThreadInArea={chrome.onNewThreadInArea}
        />
      )}

      {chrome.axis.columns.map((column, index) => {
        const gridColumn = index + 2;

        if (column.kind === "overdue") {
          return (
            <WaitingBay
              key="overdue"
              chrome={chrome}
              gridColumn={gridColumn}
              items={lane.overdue}
              laneId={lane.id}
            />
          );
        }
        if (column.kind === "beyond") {
          return (
            <LaterBay
              key="beyond"
              chrome={chrome}
              gridColumn={gridColumn}
              items={lane.beyond}
              laneId={lane.id}
              tint={tint}
            />
          );
        }

        return (
          <DayCell
            key={column.key}
            chrome={chrome}
            day={column.day}
            gridColumn={gridColumn}
            items={lane.byDay.get(column.key)}
            laneId={lane.id}
          />
        );
      })}
    </div>
  );
}

/** A translucent condition wash that sits under everything in its container. */
function Tint({ className }: { className: string }) {
  if (className === "") return null;
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
    />
  );
}

/* --------------------------------------------------------------- headers -- */

/**
 * The whole header is the Area's Quick Panel trigger: the lane is where the
 * Area is already on screen, so acting on it — Condition, capture, the way
 * through to its page — happens here rather than a navigation away.
 *
 * Headers are never drag sources or drop targets — only chips are draggables —
 * so opening the panel cannot collide with dnd-kit: a drag passing over the
 * header keeps working, and a plain click opens the panel.
 */
function AreaLaneHeader({
  incoming,
  lane,
  narrow,
  onNewThreadInArea,
}: {
  incoming: boolean;
  lane: Lane;
  narrow: boolean;
  onNewThreadInArea: (areaId: string) => void;
}) {
  const area = lane.area!;
  const ConditionIcon = conditionIcons[area.condition];

  return (
    <div
      className="sticky left-0 z-20 border-r border-border bg-surface-1"
      style={{ gridColumn: 1, gridRow: 1 }}
    >
      <Tint className={conditionLaneTint[area.condition]} />
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          conditionRailTone[area.condition],
        )}
      />
      <AreaQuickPanel
        area={area}
        onNewThread={onNewThreadInArea}
        trigger={
          <button
            type="button"
            aria-label={`Area panel for ${area.name}`}
            className={cn(
              "group/lane relative w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              narrow
                ? "flex flex-col gap-1.5 py-2 pr-2 pl-2.5"
                : "flex items-start gap-2.5 py-2 pr-3 pl-3.5",
            )}
          />
        }
      >
        {narrow ? (
          <>
            <div className="flex w-full items-center justify-between gap-1">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg transition-shadow",
                  conditionIconTone[area.condition],
                  incoming && "ring-2 ring-foreground/30",
                )}
              >
                <AreaIcon icon={area.icon} className="size-3.5" />
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {area.condition !== "healthy" && (
                  <ConditionIcon
                    aria-label={conditionShort[area.condition]}
                    className={cn(
                      "size-3",
                      conditionTextClassName[area.condition],
                    )}
                  />
                )}
                <span
                  className="text-2xs tabular-nums text-muted-foreground/70"
                  title={`${lane.openCount} open Threads`}
                >
                  {lane.openCount}
                </span>
              </span>
            </div>
            <span className="line-clamp-2 font-heading text-xs leading-tight font-semibold tracking-tight transition-colors group-hover/lane:text-primary">
              {area.name}
            </span>
          </>
        ) : (
          <>
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg transition-shadow",
                conditionIconTone[area.condition],
                incoming && "ring-2 ring-foreground/30",
              )}
            >
              <AreaIcon icon={area.icon} className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-heading text-sm font-semibold tracking-tight transition-colors group-hover/lane:text-primary">
                  {area.name}
                </span>
                <span
                  className="shrink-0 text-xs tabular-nums text-muted-foreground/70"
                  title={`${lane.openCount} open Threads`}
                >
                  {lane.openCount}
                </span>
              </div>
              <LaneStatus incoming={incoming} lane={lane} />
            </div>
          </>
        )}
      </AreaQuickPanel>
    </div>
  );
}

function LaneStatus({ incoming, lane }: { incoming: boolean; lane: Lane }) {
  const area = lane.area!;

  if (incoming) {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-foreground">
        <CornerDownRight className="size-3" />
        Move to {area.name}
      </span>
    );
  }

  // A non-healthy Area always leads with its condition, even when the lane
  // holds nothing — the condition never hides behind emptiness.
  if (area.condition !== "healthy") {
    const StateIcon = conditionIcons[area.condition];
    const detail =
      lane.openCount === 0
        ? "No open Threads"
        : lane.plannedCount === 0
          ? "Nothing planned"
          : lane.nearHorizon === 0
            ? "Nothing this week"
            : null;

    return (
      <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs">
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 font-medium",
            conditionTextClassName[area.condition],
          )}
        >
          <StateIcon aria-hidden className="size-3" />
          {conditionShort[area.condition]}
        </span>
        <span
          className={cn(
            "truncate",
            detail === "Nothing this week"
              ? "font-medium text-condition-attention"
              : "text-muted-foreground/60",
          )}
        >
          ·{" "}
          {detail ?? (
            <>
              <span className="tabular-nums">{lane.plannedCount}</span> planned
            </>
          )}
        </span>
      </span>
    );
  }

  if (lane.openCount === 0) {
    return (
      <span className="mt-0.5 block text-xs text-muted-foreground/50">
        No open Threads
      </span>
    );
  }

  if (lane.plannedCount === 0) {
    return (
      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground/60">
        <CircleDashed className="size-3" />
        Nothing planned
      </span>
    );
  }

  if (lane.nearHorizon === 0) {
    return (
      <span className="mt-0.5 block text-xs text-muted-foreground/60">
        Nothing this week
      </span>
    );
  }

  return (
    <span className="mt-0.5 block truncate text-xs text-muted-foreground/60">
      {conditionShort[area.condition]} ·{" "}
      <span className="tabular-nums">{lane.plannedCount}</span> planned
    </span>
  );
}

function InboxLaneHeader({ lane, narrow }: { lane: Lane; narrow: boolean }) {
  if (narrow) {
    return (
      <div
        className="sticky left-0 z-20 border-r border-border bg-surface-1"
        style={{ gridColumn: 1, gridRow: 1 }}
      >
        <div className="relative flex flex-col gap-1.5 py-2 pr-2 pl-2.5">
          <div className="flex w-full items-center justify-between gap-1">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-2 text-muted-foreground">
              <Inbox className="size-3.5" />
            </span>
            <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/70">
              {lane.openCount}
            </span>
          </div>
          <span className="line-clamp-2 font-heading text-xs leading-tight font-semibold tracking-tight">
            Inbox
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="sticky left-0 z-20 border-r border-border bg-surface-1"
      style={{ gridColumn: 1, gridRow: 1 }}
    >
      <div className="relative flex items-start gap-2.5 py-2 pr-3 pl-3.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-2 text-muted-foreground">
          <Inbox className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-heading text-sm font-semibold tracking-tight">
              Inbox
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground/70">
              {lane.openCount}
            </span>
          </div>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground/60">
            Tasks · no Area
          </span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- cells -- */

const EMPTY: PlanItem[] = [];

function DayCell({
  chrome,
  day,
  gridColumn,
  items = EMPTY,
  laneId,
}: {
  chrome: LaneChrome;
  day: DaySlot;
  gridColumn: number;
  items?: PlanItem[];
  laneId: string;
}) {
  const { density, drag, now, onOpen } = chrome;

  const { isOver, setNodeRef } = useDroppable({
    id: `${laneId}::${day.key}`,
    data: { laneId, slotKey: day.key } satisfies SlotDropData,
  });

  const columnActive = drag?.overSlotKey === day.key;
  const valid = drag != null && acceptsKind(laneId, drag.kind);
  const armed = valid && isOver;

  return (
    <div
      ref={setNodeRef}
      data-slot-key={`${laneId}::${day.key}`}
      style={{ gridColumn, gridRow: 1 }}
      className={cn(
        "relative flex flex-col justify-center transition-colors",
        cellRhythm(density),
        day.wide ? "px-1.5" : "px-0",
        day.isWeekStart
          ? "border-l border-border/45"
          : "border-l border-border/25",
        day.isWeekend && "bg-foreground/[0.03]",
        day.isToday && TODAY_COLUMN,
        columnActive && "bg-brand-gold-strong/10",
        armed && "bg-brand-gold-strong/20",
      )}
    >
      {armed && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1 inset-x-0.5 rounded-md border border-dashed border-foreground/40"
        />
      )}

      {items.map((item) => (
        <PlanChip
          key={item.id}
          density={density}
          item={item}
          laneId={laneId}
          now={now}
          onOpen={onOpen}
          slotKey={day.key}
        />
      ))}
    </div>
  );
}

/** The tinted debt bay at the left edge of every lane. Never a drop target. */
function WaitingBay({
  chrome,
  gridColumn,
  items,
  laneId,
}: {
  chrome: LaneChrome;
  gridColumn: number;
  items: PlanItem[];
  laneId: string;
}) {
  const { density, drag, now, onOpen } = chrome;

  const { isOver, setNodeRef } = useDroppable({
    id: `${laneId}::overdue`,
    data: { laneId, slotKey: "overdue" } satisfies SlotDropData,
  });

  return (
    <div
      ref={setNodeRef}
      data-slot-key={`${laneId}::overdue`}
      style={{ gridColumn, gridRow: 1 }}
      className={cn(
        "relative flex flex-col justify-center border-l border-border/60 bg-condition-attention/[0.07] px-1.5",
        cellRhythm(density),
        drag != null && isOver && "bg-condition-attention/10",
      )}
    >
      {items.map((item) => (
        <PlanChip
          key={item.id}
          density={density}
          item={item}
          laneId={laneId}
          now={now}
          onOpen={onOpen}
          slotKey="overdue"
        />
      ))}
    </div>
  );
}

/**
 * **Later** — the bay pinned to the lane's right edge, holding work dated past
 * the far end of the axis. It never scrolls away, so the axis always ends on
 * the same anchor however far it is scrolled.
 *
 * A drop here has no single day to write, so the canvas answers it with a
 * calendar instead of a mutation — see `plan-later-dialog.tsx`.
 */
function LaterBay({
  chrome,
  gridColumn,
  items,
  laneId,
  tint,
}: {
  chrome: LaneChrome;
  gridColumn: number;
  items: PlanItem[];
  laneId: string;
  tint: string;
}) {
  const { density, drag, now, onOpen } = chrome;
  const slotKey = "beyond";

  const { isOver, setNodeRef } = useDroppable({
    id: `${laneId}::${slotKey}`,
    data: { laneId, slotKey } satisfies SlotDropData,
  });

  const armed = drag != null && acceptsKind(laneId, drag.kind) && isOver;

  return (
    <div
      ref={setNodeRef}
      data-slot-key={`${laneId}::${slotKey}`}
      style={{ gridColumn, gridRow: 1 }}
      className={cn(
        "sticky right-0 z-20 flex flex-col justify-center border-l border-border bg-surface-1 px-1.5",
        cellRhythm(density),
        armed && "bg-surface-3",
      )}
    >
      <Tint className={tint} />
      {armed && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-1 rounded-md border border-dashed border-foreground/40"
        />
      )}
      <div
        className={cn(
          "relative flex flex-col",
          density === "compact" ? "gap-1" : "gap-1.5",
        )}
      >
        {items.map((item) => (
          <PlanChip
            key={item.id}
            density={density}
            item={item}
            laneId={laneId}
            now={now}
            onOpen={onOpen}
            slotKey={slotKey}
          />
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- no-date bucket -- */

/**
 * **No date** — everything with no day at all, pooled under the canvas rather
 * than sliced per lane. Undated work has no place on a calendar, so it gets no
 * column on one: it reads as a holding pen, deliberately unlike a lane — no
 * header column, no condition tint, its own raised surface, and chips flowing
 * across the full width instead of down a slot.
 *
 * It is a droppable that clears the date, and it publishes no `laneId` of its
 * own — like the ruler, it means "no day, whichever lane you came from", so a
 * Thread dropped here keeps its Area. Each chip carries its own lane back, so
 * dragging one out onto a day lands it where it belongs.
 */
export function NoDateBucket({
  chrome,
  lanes,
}: {
  chrome: LaneChrome;
  /** The lanes on screen — an Area filtered out takes its undated work with it. */
  lanes: Lane[];
}) {
  const { density, drag, now, onOpen } = chrome;

  const { isOver, setNodeRef } = useDroppable({
    id: "bucket::none",
    data: { slotKey: "none" } satisfies SlotDropData,
  });

  const entries = lanes
    .flatMap((lane) => lane.none.map((item) => ({ item, laneId: lane.id })))
    .sort((a, b) => byDateThenTitle(a.item, b.item));

  const armed = drag != null && isOver;

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label="No date"
      data-slot-key="none"
      className={cn(
        "relative mt-3 rounded-xl border border-dashed border-border bg-surface-2/60 transition-colors",
        density === "compact" ? "p-2.5" : "p-3",
        armed && "border-solid border-foreground/40 bg-surface-3/70",
      )}
    >
      <div className="mb-2 flex items-baseline gap-1.5">
        <span className="text-2xs font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase">
          No date
        </span>
        <span className="text-xs tabular-nums text-muted-foreground/70">
          {entries.length}
        </span>
        <span className="ml-2 truncate text-xs text-muted-foreground/50">
          Drop here to take the day off
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground/45">Nothing undated</p>
      ) : (
        <div
          className={cn(
            "flex flex-wrap",
            density === "compact" ? "gap-1.5" : "gap-2",
          )}
        >
          {entries.map(({ item, laneId }) => (
            <div key={item.id} style={{ width: bayWidth(density) }}>
              <PlanChip
                density={density}
                item={item}
                laneId={laneId}
                now={now}
                onOpen={onOpen}
                slotKey="none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The vertical rhythm every slot shares — row height, chip spacing, breathing
 * room. Comfortable gets the proportional bump; compact keeps its tight values,
 * which is the whole reason the density switch exists.
 */
function cellRhythm(density: Density): string {
  return density === "compact"
    ? "min-h-11 gap-1 py-1.5"
    : "min-h-12 gap-1.5 py-2";
}

function acceptsKind(laneId: string, kind: PlanItem["kind"]): boolean {
  return kind === "task" ? laneId === INBOX_LANE_ID : laneId !== INBOX_LANE_ID;
}
