import { useDroppable } from "@dnd-kit/core";
import { cn } from "@vita-os/ui/lib/utils";
import { CircleDashed, CornerDownRight, Inbox } from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { SlotDropData } from "./axis";
import type {
  Axis,
  DaySlot,
  Density,
  DragState,
  Lane,
  PlanItem,
} from "./model";

import { TODAY_COLUMN } from "./axis";
import { PlanChip } from "./chip";
import {
  conditionIconTone,
  conditionLaneTint,
  conditionRailTone,
  conditionShort,
  INBOX_LANE_ID,
} from "./model";

export interface LaneChrome {
  axis: Axis;
  density: Density;
  drag: DragState | null;
  now: number;
  onSelect: (id: string) => void;
  selectedId?: string;
}

/**
 * One Area as a horizontal band under the shared ruler.
 *
 * Chips sit in the day slot matching their date and read left to right in date
 * order; anything already past docks in the tinted waiting bay at the lane's
 * left edge. Dragging along the lane retargets the day, dragging across lanes
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
        <InboxLaneHeader lane={lane} />
      ) : (
        <AreaLaneHeader incoming={incoming} lane={lane} />
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
        if (column.kind === "none") {
          return (
            <NoDateBay
              key="none"
              chrome={chrome}
              gridColumn={gridColumn}
              items={lane.none}
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
            isLaterStart={chrome.axis.laterFrom === index}
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

function AreaLaneHeader({ incoming, lane }: { incoming: boolean; lane: Lane }) {
  const area = lane.area!;

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
      <div className="relative flex items-start gap-2.5 py-2 pr-3 pl-3.5">
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
            <span className="truncate font-heading text-sm font-semibold tracking-tight">
              {area.name}
            </span>
            <span
              className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70"
              title={`${lane.openCount} open Threads`}
            >
              {lane.openCount}
            </span>
          </div>
          <LaneStatus incoming={incoming} lane={lane} />
        </div>
      </div>
    </div>
  );
}

function LaneStatus({ incoming, lane }: { incoming: boolean; lane: Lane }) {
  const area = lane.area!;

  if (incoming) {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-foreground">
        <CornerDownRight className="size-3" />
        Move to {area.name}
      </span>
    );
  }

  if (lane.openCount === 0) {
    return (
      <span className="mt-0.5 block text-[11px] text-muted-foreground/50">
        No open Threads
      </span>
    );
  }

  if (lane.plannedCount === 0) {
    return (
      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
        <CircleDashed className="size-3" />
        Nothing planned
      </span>
    );
  }

  if (lane.nearHorizon === 0) {
    return (
      <span
        className={cn(
          "mt-0.5 block text-[11px]",
          area.condition === "healthy"
            ? "text-muted-foreground/60"
            : "font-medium text-condition-attention",
        )}
      >
        Nothing this week
      </span>
    );
  }

  return (
    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/60">
      {conditionShort[area.condition]} ·{" "}
      <span className="tabular-nums">{lane.plannedCount}</span> planned
    </span>
  );
}

function InboxLaneHeader({ lane }: { lane: Lane }) {
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
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
              {lane.openCount}
            </span>
          </div>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/60">
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
  isLaterStart,
  items = EMPTY,
  laneId,
}: {
  chrome: LaneChrome;
  day: DaySlot;
  gridColumn: number;
  isLaterStart: boolean;
  items?: PlanItem[];
  laneId: string;
}) {
  const { density, drag, now, onSelect, selectedId } = chrome;

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
        "relative flex min-h-[2.75rem] flex-col justify-center gap-1 py-1.5 transition-colors",
        day.wide ? "px-1.5" : "px-0",
        isLaterStart
          ? "border-l border-border/60"
          : day.isWeekStart
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
          onSelect={onSelect}
          selected={item.id === selectedId}
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
  const { density, drag, now, onSelect, selectedId } = chrome;

  const { isOver, setNodeRef } = useDroppable({
    id: `${laneId}::overdue`,
    data: { laneId, slotKey: "overdue" } satisfies SlotDropData,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ gridColumn, gridRow: 1 }}
      className={cn(
        "relative flex min-h-[2.75rem] flex-col justify-center gap-1 border-l border-border/60 bg-condition-attention/[0.07] px-1.5 py-1.5",
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
          onSelect={onSelect}
          selected={item.id === selectedId}
          slotKey="overdue"
        />
      ))}
    </div>
  );
}

/** Pinned to the right edge: everything with no date at all. */
function NoDateBay({
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
  const { density, drag, now, onSelect, selectedId } = chrome;

  const { isOver, setNodeRef } = useDroppable({
    id: `${laneId}::none`,
    data: { laneId, slotKey: "none" } satisfies SlotDropData,
  });

  const armed = drag != null && acceptsKind(laneId, drag.kind) && isOver;

  return (
    <div
      ref={setNodeRef}
      style={{ gridColumn, gridRow: 1 }}
      className={cn(
        "sticky right-0 z-20 flex min-h-[2.75rem] flex-col justify-center gap-1 border-l border-border bg-surface-1 px-1.5 py-1.5",
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
      <div className="relative flex flex-col gap-1">
        {items.map((item) => (
          <PlanChip
            key={item.id}
            density={density}
            item={item}
            laneId={laneId}
            now={now}
            onSelect={onSelect}
            selected={item.id === selectedId}
            slotKey="none"
          />
        ))}
      </div>
    </div>
  );
}

function acceptsKind(laneId: string, kind: PlanItem["kind"]): boolean {
  return kind === "task" ? laneId === INBOX_LANE_ID : laneId !== INBOX_LANE_ID;
}
