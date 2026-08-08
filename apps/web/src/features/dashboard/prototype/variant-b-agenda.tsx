// PROTOTYPE — throwaway (issue #268). Variant B: agenda collapse — one vertical day list, area as a chip attribute.

import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import {
  Ban,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Inbox,
} from "lucide-react";
import { useMemo, useState } from "react";

import type {
  DashboardArea,
  DashboardInboxTask,
  DashboardThread,
} from "@/features/dashboard/components/dashboard-model";
import type { PlanItem } from "@/features/dashboard/plan/plan-model";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { AreaFilterChips } from "@/features/dashboard/plan/plan-filters";
import {
  buildPlanItems,
  conditionIconTone,
  conditionRailTone,
  dayAt,
  dayCaption,
  dayDelta,
  dayKey,
  waitingLabel,
} from "@/features/dashboard/plan/plan-model";

/**
 * Plan — agenda collapse (phone).
 *
 * The desktop canvas spends its two dimensions on Area × day. A 390px viewport
 * only has one to spend, so time keeps it and **Area collapses into an
 * attribute**: every chip is a full-width row wearing its Area's icon pill and
 * condition rail, and the filter chips across the top do the narrowing that
 * lane headers used to do. Nothing is pinned sideways, so the whole viewport is
 * list.
 *
 * The axis still compresses, transposed: only occupied days (plus today) earn a
 * full section; runs of empty days shrink to a single "quiet days" divider that
 * expands into droppable day lines when you actually want to plan into one.
 *
 * Rescheduling is a vertical drag under the same touch guard as the canvas
 * (long-press arms, a swipe still scrolls). This is a prototype: drops write to
 * a local `moves` map, never to Convex.
 */
export function PlanVariantAgenda({
  areas,
  currentDate,
  tasks,
  threads,
}: {
  areas: DashboardArea[];
  currentDate: number;
  tasks: DashboardInboxTask[];
  threads: DashboardThread[];
}) {
  const now = currentDate;
  const navigate = useNavigate();

  const [activeAreas, setActiveAreas] = useState<ReadonlySet<string> | null>(
    null,
  );
  /** itemId → day key (`d3`) or `"none"`. Prototype-local; no mutation runs. */
  const [moves, setMoves] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [drag, setDrag] = useState<AgendaDrag | null>(null);
  const [openGaps, setOpenGaps] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [showNoDate, setShowNoDate] = useState(false);

  /** Same guards as the canvas: 5px for mouse, long-press for touch. */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

  const areaById = useMemo(
    () => new Map(areas.map((area) => [area.id, area])),
    [areas],
  );

  const items = useMemo(() => buildPlanItems(threads, tasks), [threads, tasks]);

  /** Local drops re-date the item before anything else looks at it. */
  const moved = useMemo(
    () =>
      items.map((item) => {
        const target = moves.get(item.id);
        if (target == null) return item;
        if (target === "none") return { ...item, date: undefined };
        return { ...item, date: dayAt(Number(target.slice(1)), now) };
      }),
    [items, moves, now],
  );

  /** Tasks have no Area, so the Area filter never hides them. */
  const visible = useMemo(
    () =>
      moved.filter(
        (item) =>
          item.kind === "task" ||
          activeAreas == null ||
          (item.areaId != null && activeAreas.has(item.areaId)),
      ),
    [moved, activeAreas],
  );

  const agenda = useMemo(() => buildAgenda(visible, now), [visible, now]);

  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of moved) {
      if (item.areaId == null) continue;
      counts.set(item.areaId, (counts.get(item.areaId) ?? 0) + 1);
    }
    return counts;
  }, [moved]);

  /* ------------------------------------------------------------- open -- */

  function openItem(item: PlanItem) {
    if (item.kind === "task") {
      void navigate({ to: "/inbox" });
      return;
    }
    if (item.slug == null) return;
    void navigate({
      to: ".",
      search: (previous) => ({ ...previous, thread: item.slug }),
    });
  }

  /* ------------------------------------------------------------- drag -- */

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as ChipDrag | undefined;
    if (!data) return;
    setDrag({ itemId: data.itemId, slotKey: data.slotKey });
  }

  function handleDragOver(event: DragOverEvent) {
    const over = event.over?.data.current as SlotDrop | undefined;
    setDrag((previous) =>
      previous ? { ...previous, overSlotKey: over?.slotKey } : previous,
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    setDrag(null);

    const source = event.active.data.current as ChipDrag | undefined;
    const over = event.over?.data.current as SlotDrop | undefined;
    if (!source || !over) return;
    // The past is not a target — the same rule the canvas enforces.
    if (over.slotKey === "overdue") return;
    if (over.slotKey === source.slotKey) return;

    if (over.slotKey === "none") setShowNoDate(true);
    setMoves((previous) => {
      const next = new Map(previous);
      next.set(source.itemId, over.slotKey);
      return next;
    });
  }

  function toggleGap(from: number) {
    setOpenGaps((previous) => {
      const next = new Set(previous);
      if (next.has(from)) next.delete(from);
      else next.add(from);
      return next;
    });
  }

  const dragging = drag && visible.find((item) => item.id === drag.itemId);
  const caption = drag?.overSlotKey ? dropCaption(drag.overSlotKey, now) : null;

  const chrome: AgendaChrome = { areaById, drag, now, onOpen: openItem };

  /* ------------------------------------------------------------ render -- */

  return (
    <section aria-label="Plan" className="flex flex-col gap-2.5">
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        <span
          className={cn(
            "tabular-nums",
            agenda.overdue.length > 0 && "font-medium text-condition-attention",
          )}
        >
          {agenda.overdue.length} waiting
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">
          {agenda.byDay.get(dayKey(0))?.length ?? 0} today
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{agenda.none.length} undated</span>
      </p>

      {/* The narrowing that lane headers do on desktop. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <div className="w-max">
          <AreaFilterChips
            active={activeAreas}
            areas={areas}
            counts={areaCounts}
            onChange={setActiveAreas}
          />
        </div>
      </div>

      <DndContext
        collisionDetection={pointerWithin}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDrag(null)}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Drag up or down onto a day to reschedule, or onto No date to clear it. Press Enter to open it instead.",
          },
        }}
      >
        <div className="flex flex-col">
          {agenda.overdue.length > 0 && (
            <OverdueSection chrome={chrome} items={agenda.overdue} />
          )}

          {agenda.rows.map((row) =>
            row.kind === "day" ? (
              <DaySection
                key={dayKey(row.offset)}
                chrome={chrome}
                items={agenda.byDay.get(dayKey(row.offset))}
                offset={row.offset}
              />
            ) : (
              <GapRow
                key={`gap${row.from}`}
                chrome={chrome}
                from={row.from}
                open={openGaps.has(row.from)}
                onToggle={() => toggleGap(row.from)}
                to={row.to}
              />
            ),
          )}

          <NoDateSection
            chrome={chrome}
            items={agenda.none}
            open={showNoDate}
            onToggle={() => setShowNoDate((previous) => !previous)}
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && drag && (
            <div className="w-[17rem] max-w-[80vw] cursor-grabbing">
              <ChipSurface
                areaById={areaById}
                item={dragging}
                lifted
                now={now}
                slotKey={drag.slotKey}
              />
              {caption && (
                <span
                  className={cn(
                    "mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm",
                    caption.blocked
                      ? "bg-surface-2 text-muted-foreground/70 ring-1 ring-border/60"
                      : "bg-foreground text-surface-1",
                  )}
                >
                  {caption.blocked ? (
                    <Ban className="size-2.5 shrink-0" />
                  ) : (
                    <CornerDownRight className="size-2.5 shrink-0" />
                  )}
                  {caption.text}
                </span>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {agenda.total === 0 && (
        <p className="mt-3 rounded-2xl border border-dashed border-border p-10 text-center font-heading text-sm font-semibold">
          Nothing to plan
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- grouping -- */

interface AgendaDrag {
  itemId: string;
  overSlotKey?: string;
  slotKey: string;
}

interface ChipDrag {
  itemId: string;
  slotKey: string;
}

interface SlotDrop {
  slotKey: string;
}

interface AgendaChrome {
  areaById: ReadonlyMap<string, DashboardArea>;
  drag: AgendaDrag | null;
  now: number;
  onOpen: (item: PlanItem) => void;
}

type AgendaRow =
  | { from: number; kind: "gap"; to: number }
  | { kind: "day"; offset: number };

/** The list always reaches this far so there is somewhere to plan into. */
const MIN_HORIZON = 27;
const MAX_HORIZON = 90;

interface Agenda {
  byDay: Map<string, PlanItem[]>;
  none: PlanItem[];
  overdue: PlanItem[];
  rows: AgendaRow[];
  total: number;
}

/**
 * One pass from `PlanItem[]` to the rows the list renders.
 *
 * Occupied days and today become full sections; every run of empty days between
 * them becomes a single gap row — the axis compression of the desktop canvas,
 * turned ninety degrees.
 */
function buildAgenda(items: PlanItem[], now: number): Agenda {
  const byDay = new Map<string, PlanItem[]>();
  const none: PlanItem[] = [];
  const overdue: PlanItem[] = [];
  let furthest = 0;

  for (const item of items) {
    if (item.date == null) {
      none.push(item);
      continue;
    }
    const offset = dayDelta(item.date, now);
    if (offset < 0) {
      overdue.push(item);
      continue;
    }
    if (offset > furthest) furthest = offset;
  }

  const horizon = Math.min(MAX_HORIZON, Math.max(MIN_HORIZON, furthest));

  for (const item of items) {
    if (item.date == null) continue;
    const offset = dayDelta(item.date, now);
    if (offset < 0) continue;
    const key = dayKey(Math.min(offset, horizon));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(item);
    else byDay.set(key, [item]);
  }

  for (const bucket of byDay.values()) bucket.sort(byDateThenTitle);
  overdue.sort(byDateThenTitle);
  none.sort(byDateThenTitle);

  const rows: AgendaRow[] = [];
  let gapFrom: number | null = null;
  for (let offset = 0; offset <= horizon; offset += 1) {
    // Today keeps its section unconditionally — the present never collapses.
    const wide = offset === 0 || (byDay.get(dayKey(offset))?.length ?? 0) > 0;
    if (!wide) {
      if (gapFrom == null) gapFrom = offset;
      continue;
    }
    if (gapFrom != null) {
      rows.push({ from: gapFrom, kind: "gap", to: offset - 1 });
      gapFrom = null;
    }
    rows.push({ kind: "day", offset });
  }
  if (gapFrom != null) rows.push({ from: gapFrom, kind: "gap", to: horizon });

  return {
    byDay,
    none,
    overdue,
    rows,
    total: items.length,
  };
}

function byDateThenTitle(a: PlanItem, b: PlanItem): number {
  const left = a.date ?? 0;
  const right = b.date ?? 0;
  if (left !== right) return left - right;
  return a.title.localeCompare(b.title);
}

function dropCaption(
  slotKey: string,
  now: number,
): { blocked: boolean; text: string } {
  if (slotKey === "overdue") {
    return { blocked: true, text: "Can't plan into the past" };
  }
  if (slotKey === "none") return { blocked: false, text: "No date" };
  return {
    blocked: false,
    text: dayCaption(dayAt(Number(slotKey.slice(1)), now)),
  };
}

/* ------------------------------------------------------------- sections -- */

const EMPTY: PlanItem[] = [];

function DaySection({
  chrome,
  items = EMPTY,
  offset,
}: {
  chrome: AgendaChrome;
  items?: PlanItem[];
  offset: number;
}) {
  const key = dayKey(offset);
  const at = dayAt(offset, chrome.now);
  const date = new Date(at);
  const isToday = offset === 0;
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  const { isOver, setNodeRef } = useDroppable({
    id: `slot::${key}`,
    data: { slotKey: key } satisfies SlotDrop,
  });
  const armed = chrome.drag != null && isOver;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative rounded-lg transition-colors",
        isWeekend && !isToday && "bg-foreground/[0.02]",
        armed && "bg-brand-gold-strong/15",
      )}
    >
      {armed && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0.5 rounded-lg border border-dashed border-foreground/40"
        />
      )}

      <div
        className={cn(
          "sticky top-0 z-10 flex items-center gap-2 bg-surface-1/95 px-1 py-1.5 backdrop-blur-sm",
          isToday && "bg-surface-3/80",
        )}
      >
        {isToday ? (
          <span className="rounded-full bg-foreground px-2 py-0.5 font-heading text-[11px] font-semibold tracking-tight text-surface-1">
            Today
          </span>
        ) : (
          <span className="font-heading text-[12px] font-semibold tracking-tight">
            {format(date, "EEE")}
          </span>
        )}
        <span
          className={cn(
            "text-[11px] tabular-nums",
            isToday ? "text-foreground/70" : "text-muted-foreground/70",
          )}
        >
          {format(date, "d MMM")}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border/50" />
        {items.length > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground/60">
            {items.length}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 px-1 pt-0.5 pb-2">
        {items.length === 0 ? (
          <p className="py-1 pl-1 text-[11px] text-muted-foreground/40">
            Nothing planned
          </p>
        ) : (
          items.map((item) => (
            <AgendaChip
              key={item.id}
              chrome={chrome}
              item={item}
              slotKey={key}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * A run of empty days as one hairline. Tapping it opens the run into thin
 * droppable day lines, so an empty date is still reachable without spending a
 * screenful of list on it.
 */
function GapRow({
  chrome,
  from,
  onToggle,
  open,
  to,
}: {
  chrome: AgendaChrome;
  from: number;
  onToggle: () => void;
  open: boolean;
  to: number;
}) {
  const count = to - from + 1;
  const offsets: number[] = [];
  for (let offset = from; offset <= to; offset += 1) offsets.push(offset);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-1 py-1.5 text-left"
      >
        <span aria-hidden className="h-px flex-1 bg-border/50" />
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/55">
          <span className="tabular-nums">{count}</span>
          {count === 1 ? "quiet day" : "quiet days"}
          {open ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border/50" />
      </button>

      {open &&
        offsets.map((offset) => (
          <EmptyDayLine key={dayKey(offset)} chrome={chrome} offset={offset} />
        ))}
    </div>
  );
}

function EmptyDayLine({
  chrome,
  offset,
}: {
  chrome: AgendaChrome;
  offset: number;
}) {
  const key = dayKey(offset);
  const date = new Date(dayAt(offset, chrome.now));

  const { isOver, setNodeRef } = useDroppable({
    id: `slot::${key}`,
    data: { slotKey: key } satisfies SlotDrop,
  });
  const armed = chrome.drag != null && isOver;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-2 rounded-md px-1 py-1 transition-colors",
        armed && "bg-brand-gold-strong/15",
      )}
    >
      <span className="w-8 text-[11px] text-muted-foreground/55">
        {format(date, "EEE")}
      </span>
      <span className="text-[11px] tabular-nums text-muted-foreground/45">
        {format(date, "d MMM")}
      </span>
      <span
        aria-hidden
        className={cn(
          "h-px flex-1",
          armed ? "bg-foreground/40" : "bg-border/30",
        )}
      />
    </div>
  );
}

/** Pinned to the top of the list: the debt, not a plan. Never accepts a drop. */
function OverdueSection({
  chrome,
  items,
}: {
  chrome: AgendaChrome;
  items: PlanItem[];
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: "slot::overdue",
    data: { slotKey: "overdue" } satisfies SlotDrop,
  });
  const rejecting = chrome.drag != null && isOver;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mb-1 rounded-lg bg-condition-attention/[0.07] transition-colors",
        rejecting && "ring-1 ring-condition-attention/30 ring-inset",
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="font-heading text-[12px] font-semibold tracking-tight text-condition-attention">
          Waiting
        </span>
        <span className="text-[11px] text-muted-foreground/70">overdue</span>
        <span aria-hidden className="h-px flex-1 bg-condition-attention/20" />
        <span className="text-[10px] tabular-nums text-condition-attention">
          {items.length}
        </span>
      </div>
      <div className="flex flex-col gap-1 px-1.5 pb-2">
        {items.map((item) => (
          <AgendaChip
            key={item.id}
            chrome={chrome}
            item={item}
            slotKey="overdue"
          />
        ))}
      </div>
    </div>
  );
}

/** The bottom of the list, folded away behind its count until asked for. */
function NoDateSection({
  chrome,
  items,
  onToggle,
  open,
}: {
  chrome: AgendaChrome;
  items: PlanItem[];
  onToggle: () => void;
  open: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: "slot::none",
    data: { slotKey: "none" } satisfies SlotDrop,
  });
  const armed = chrome.drag != null && isOver;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-1 rounded-lg border-t border-border transition-colors",
        armed && "bg-brand-gold-strong/15",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-2 text-left"
      >
        <span className="font-heading text-[12px] font-semibold tracking-tight">
          No date
        </span>
        <span className="rounded-full bg-surface-3 px-1.5 text-[10px] tabular-nums text-muted-foreground">
          {items.length}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border/40" />
        {open ? (
          <ChevronUp className="size-3.5 text-muted-foreground/60" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground/60" />
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-1 px-1.5 pb-2">
          {items.length === 0 ? (
            <p className="py-1 pl-1 text-[11px] text-muted-foreground/40">
              Everything has a day
            </p>
          ) : (
            items.map((item) => (
              <AgendaChip
                key={item.id}
                chrome={chrome}
                item={item}
                slotKey="none"
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- chip -- */

/**
 * Presentation only, so the lifted ghost is identical to the row it left.
 *
 * The row *is* the Area label: a condition rail down its left edge and the
 * Area's icon in a condition-toned pill. An inbox Task wears a dashed pill and
 * the Inbox glyph instead — it has no Area to wear.
 */
function ChipSurface({
  areaById,
  item,
  lifted,
  now,
  slotKey,
}: {
  areaById: ReadonlyMap<string, DashboardArea>;
  item: PlanItem;
  lifted?: boolean;
  now: number;
  slotKey: string;
}) {
  const isTask = item.kind === "task";
  const area = item.areaId == null ? undefined : areaById.get(item.areaId);
  const waiting = slotKey === "overdue" && item.date != null;
  const ConditionIcon = area ? conditionIcons[area.condition] : undefined;

  return (
    <div
      className={cn(
        "relative flex w-full items-start gap-2 overflow-hidden rounded-lg border py-2 pr-2 pl-2.5 text-left",
        isTask
          ? "border-dashed border-border bg-surface-2/60"
          : "border-border/70 bg-surface-2",
        waiting && "border-condition-attention/30 bg-condition-attention/8",
        lifted &&
          "border-border bg-surface-2 shadow-lg ring-1 ring-foreground/10",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          waiting
            ? "bg-condition-attention"
            : area == null || area.condition === "healthy"
              ? "bg-border"
              : conditionRailTone[area.condition],
        )}
      />

      <span
        className={cn(
          "mt-px flex size-6 shrink-0 items-center justify-center rounded-md",
          isTask
            ? "border border-dashed border-border bg-surface-2 text-muted-foreground"
            : conditionIconTone[area?.condition ?? "healthy"],
        )}
      >
        {isTask ? (
          <Inbox aria-hidden className="size-3" />
        ) : (
          <AreaIcon icon={area?.icon} className="size-3.5" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "line-clamp-2 text-[13px] leading-snug",
            isTask ? "font-normal text-foreground/90" : "font-medium",
          )}
        >
          {item.title}
        </span>

        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] leading-snug text-muted-foreground/60">
          {ConditionIcon && area && area.condition !== "healthy" && (
            <ConditionIcon
              aria-hidden
              className={cn("size-2.5", conditionTextClassName[area.condition])}
            />
          )}
          <span className="truncate">{area?.name ?? "Inbox"}</span>
          {item.nextMove && (
            <>
              <span aria-hidden>·</span>
              <CornerDownRight aria-hidden className="size-2.5 shrink-0" />
              <span className="truncate">{item.nextMove}</span>
            </>
          )}
        </span>
      </span>

      {waiting && (
        <span className="mt-px shrink-0 text-[10px] font-medium tabular-nums text-condition-attention">
          {waitingLabel(item.date!, now)}
        </span>
      )}
    </div>
  );
}

function AgendaChip({
  chrome,
  item,
  slotKey,
}: {
  chrome: AgendaChrome;
  item: PlanItem;
  slotKey: string;
}) {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: item.id,
    data: { itemId: item.id, slotKey } satisfies ChipDrag,
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      onClick={() => chrome.onOpen(item)}
      className={cn(
        // `touch-manipulation`, not `touch-none`: a swipe that starts on a chip
        // must still scroll the list until the long-press arms the drag.
        "w-full touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <ChipSurface
        areaById={chrome.areaById}
        item={item}
        now={chrome.now}
        slotKey={slotKey}
      />
    </button>
  );
}
