import type { Condition } from "@convex/lib/condition";

import { format, startOfDay } from "date-fns";

import type { MockActivity, MockArea } from "../mock-data";

import { DAY, mockAreas, mockTasks, mockThreads } from "../mock-data";

/**
 * Model for **Lane flow** — the Area × *day* canvas.
 *
 * Where the base view buckets time into fuzzy horizons, this one keeps a single
 * continuous day axis and lets it **compress**: a day nobody has planned into
 * shrinks to a hairline tick, a day that holds work opens to a full slot. The
 * axis therefore stays short without ever losing day resolution — every drop
 * still names an exact calendar day.
 *
 * Everything here is pure: the view rebuilds the whole axis from a flat item
 * list on every render, and nothing from `mock-data` is ever mutated.
 */

/* ----------------------------------------------------------------- items -- */

export type PlanItemKind = "task" | "thread";

/**
 * One planable thing.
 *
 * A **Thread** has an Area, at most one **Next Move**, and a soft **Follow-up**.
 * An inbox **Task** has neither Area nor Next Move, only a soft **When**.
 * `date` is whichever of the two the item carries — never a deadline.
 */
export interface PlanItem {
  /** Threads only. */
  areaId?: string;
  /** Tasks only: when it landed in the Inbox. */
  createdAt?: number;
  /** Follow-up (Thread) or When (Task). Undefined is a legitimate state. */
  date?: number;
  id: string;
  kind: PlanItemKind;
  /** Threads only. */
  lastActivity?: MockActivity;
  /** Threads only, and at most one — never a checklist. */
  nextMove?: string;
  /** Threads only. */
  summary?: string;
  title: string;
}

export function seedItems(): PlanItem[] {
  const threads: PlanItem[] = mockThreads.map((thread) => ({
    areaId: thread.areaId,
    date: thread.followUp,
    id: thread.id,
    kind: "thread",
    lastActivity: thread.lastActivity,
    nextMove: thread.nextMove,
    summary: thread.summary,
    title: thread.title,
  }));

  const tasks: PlanItem[] = mockTasks.map((task) => ({
    createdAt: task.createdAt,
    date: task.when,
    id: task.id,
    kind: "task",
    title: task.text,
  }));

  return [...threads, ...tasks];
}

/* ----------------------------------------------------------------- dates -- */

const LANDING_HOUR = 9;
/** Today lands late: a Follow-up set today should resurface this evening. */
const TODAY_HOUR = 17;

/** Whole local calendar days between two timestamps; negative when past. */
export function dayDelta(when: number, now: number): number {
  return Math.round(
    (startOfDay(new Date(when)).getTime() -
      startOfDay(new Date(now)).getTime()) /
      DAY,
  );
}

/** `offset` days from `now`, at the canonical resurfacing hour. */
export function dayAt(
  offset: number,
  now: number,
  hour = offset === 0 ? TODAY_HOUR : LANDING_HOUR,
): number {
  const base = new Date(now);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + offset,
    hour,
  ).getTime();
}

/** Days left in the current week after today, treating Monday as day one. */
function daysLeftThisWeek(now: number): number {
  const isoDay = (new Date(now).getDay() + 6) % 7;
  return 6 - isoDay;
}

export type QuickTarget = "next-week" | "today" | "tomorrow" | "weekend";

/** Resolve a quick key to a concrete soft date. */
export function quickDate(target: QuickTarget, now: number): number {
  const today = new Date(now);

  switch (target) {
    case "today":
      return dayAt(0, now);
    case "tomorrow":
      return dayAt(1, now);
    case "weekend":
      // The upcoming Saturday; on a Saturday, "this weekend" is still today.
      return dayAt((6 - today.getDay() + 7) % 7, now, 10);
    case "next-week":
      return dayAt(daysLeftThisWeek(now) + 1, now);
  }
}

/** "Thu 13 Aug" — the exact-day promise printed on every drag caption. */
export function dayCaption(at: number): string {
  return format(new Date(at), "EEE d MMM");
}

/* ------------------------------------------------------------------ axis -- */

export type Density = "comfortable" | "compact";

/** Days shown at full tick density before the axis coarsens into "Later". */
export const NEAR_DAYS = 14;
/** The axis always reaches this far so there is somewhere to plan into. */
const MIN_HORIZON = 27;
const MAX_HORIZON = 90;

export const HEADER_WIDTH = 178;

const TICK_NEAR = 26;
const TICK_LATER = 20;

const SLOT_WIDTH: Record<Density, number> = {
  compact: 130,
  comfortable: 166,
};

/** The waiting bay and the pinned No-date bay share the slot width. */
export function bayWidth(density: Density): number {
  return SLOT_WIDTH[density];
}

export interface DaySlot {
  /** The exact timestamp a drop on this day writes. */
  at: number;
  isMonthStart: boolean;
  isToday: boolean;
  isWeekStart: boolean;
  isWeekend: boolean;
  key: string;
  /** Something is planned here. */
  occupied: boolean;
  offset: number;
  region: "later" | "near";
  /**
   * The slot is open to full width, so it carries a full day header. Occupied
   * days earn it; today keeps it unconditionally — the present never collapses
   * to a tick, however empty the filters leave it.
   */
  wide: boolean;
  width: number;
}

export type AxisColumn =
  | { day: DaySlot; key: string; kind: "day"; width: number }
  | { key: "none"; kind: "none"; width: number }
  | { key: "overdue"; kind: "overdue"; width: number };

export interface MonthSpan {
  /** Inclusive 0-based index into `columns`. */
  from: number;
  label: string;
  to: number;
}

export interface Axis {
  columns: AxisColumn[];
  days: DaySlot[];
  hasOverdue: boolean;
  /** Index into `columns` where the coarse Later region starts, if any. */
  laterFrom?: number;
  minWidth: number;
  monthSpans: MonthSpan[];
  /** `grid-template-columns`, header and both bays included. */
  template: string;
  todayIndex?: number;
}

/**
 * Build the shared day axis.
 *
 * `items` is the **visible** set: filtering an Area out collapses the days only
 * it occupied, which is the whole point of a compressing axis.
 */
export function buildAxis(
  items: PlanItem[],
  now: number,
  density: Density,
): Axis {
  const planned: number[] = [];
  let hasOverdue = false;
  let furthest = 0;

  for (const item of items) {
    if (item.date == null) continue;
    const offset = dayDelta(item.date, now);
    if (offset < 0) {
      hasOverdue = true;
      continue;
    }
    planned.push(offset);
    if (offset > furthest) furthest = offset;
  }

  const horizon = Math.min(MAX_HORIZON, Math.max(MIN_HORIZON, furthest));
  const slotWidth = SLOT_WIDTH[density];
  // Anything past the horizon piles into the last day, exactly as `slotKeyFor`
  // files it — otherwise that day would show a count but stay tick-narrow.
  const occupied = new Set(planned.map((offset) => Math.min(offset, horizon)));

  const days: DaySlot[] = [];
  for (let offset = 0; offset <= horizon; offset += 1) {
    const at = dayAt(offset, now);
    const date = new Date(at);
    const weekday = date.getDay();
    const isOccupied = occupied.has(offset);
    const region = offset < NEAR_DAYS ? "near" : "later";
    const wide = isOccupied || offset === 0;

    days.push({
      at,
      isMonthStart: date.getDate() === 1,
      isToday: offset === 0,
      isWeekend: weekday === 0 || weekday === 6,
      isWeekStart: weekday === 1,
      key: dayKey(offset),
      occupied: isOccupied,
      offset,
      region,
      wide,
      width: wide ? slotWidth : region === "near" ? TICK_NEAR : TICK_LATER,
    });
  }

  const columns: AxisColumn[] = [];
  if (hasOverdue) {
    columns.push({ key: "overdue", kind: "overdue", width: slotWidth });
  }
  for (const day of days) {
    columns.push({ day, key: day.key, kind: "day", width: day.width });
  }
  columns.push({ key: "none", kind: "none", width: slotWidth });

  const dayFrom = hasOverdue ? 1 : 0;
  const monthSpans: MonthSpan[] = [];
  for (let index = 0; index < NEAR_DAYS && index < days.length; index += 1) {
    const label = format(new Date(days[index].at), "MMMM");
    const last = monthSpans.at(-1);
    if (last?.label === label) last.to = dayFrom + index;
    else monthSpans.push({ from: dayFrom + index, label, to: dayFrom + index });
  }

  return {
    columns,
    days,
    hasOverdue,
    laterFrom: days.length > NEAR_DAYS ? dayFrom + NEAR_DAYS : undefined,
    minWidth:
      HEADER_WIDTH + columns.reduce((total, column) => total + column.width, 0),
    monthSpans,
    template: `${HEADER_WIDTH}px ${columns.map((column) => `${column.width}px`).join(" ")}`,
    todayIndex: dayFrom,
  };
}

export function dayKey(offset: number): string {
  return `d${offset}`;
}

/** Which axis column an item's date belongs in. */
export function slotKeyFor(
  date: number | undefined,
  now: number,
  horizon: number,
): string {
  if (date == null) return "none";
  const offset = dayDelta(date, now);
  if (offset < 0) return "overdue";
  return dayKey(Math.min(offset, horizon));
}

/* ----------------------------------------------------------------- lanes -- */

export const INBOX_LANE_ID = "inbox";

export interface Lane {
  /** Undefined on the pinned Inbox lane. */
  area?: MockArea;
  byDay: Map<string, PlanItem[]>;
  id: string;
  /**
   * Threads on the forward-looking near horizon (today plus the rest of this
   * week). Overdue is excluded on purpose: an Area whose only dated Thread is
   * already late has nothing planned, it has a debt.
   */
  nearHorizon: number;
  none: PlanItem[];
  openCount: number;
  overdue: PlanItem[];
  plannedCount: number;
}

const conditionRank: Record<Condition, number> = {
  critical: 0,
  needs_attention: 1,
  healthy: 2,
};

function emptyLane(id: string, area?: MockArea): Lane {
  return {
    area,
    byDay: new Map(),
    id,
    nearHorizon: 0,
    none: [],
    openCount: 0,
    overdue: [],
    plannedCount: 0,
  };
}

function push(lane: Lane, key: string, item: PlanItem) {
  if (key === "none") {
    lane.none.push(item);
    return;
  }
  if (key === "overdue") {
    lane.overdue.push(item);
    return;
  }
  const bucket = lane.byDay.get(key);
  if (bucket) bucket.push(item);
  else lane.byDay.set(key, [item]);
}

/** Area lanes worst condition first, then the pinned Inbox lane. */
export function buildLanes(
  items: PlanItem[],
  now: number,
  horizon: number,
): { areaLanes: Lane[]; inbox: Lane } {
  const lanes = new Map<string, Lane>();
  for (const area of mockAreas) lanes.set(area.id, emptyLane(area.id, area));
  const inbox = emptyLane(INBOX_LANE_ID);

  for (const item of items) {
    const key = slotKeyFor(item.date, now, horizon);
    if (item.kind === "task") {
      push(inbox, key, item);
      continue;
    }
    const lane = item.areaId == null ? undefined : lanes.get(item.areaId);
    if (lane) push(lane, key, item);
  }

  const restOfWeek = daysLeftThisWeek(now);
  for (const lane of [...lanes.values(), inbox]) {
    for (const bucket of lane.byDay.values()) bucket.sort(byDateThenTitle);
    lane.overdue.sort(byDateThenTitle);
    lane.none.sort(byDateThenTitle);

    let dated = 0;
    let near = 0;
    for (const [key, bucket] of lane.byDay) {
      dated += bucket.length;
      if (Number(key.slice(1)) <= restOfWeek) near += bucket.length;
    }
    lane.nearHorizon = near;
    lane.plannedCount = dated;
    lane.openCount = dated + lane.overdue.length + lane.none.length;
  }

  const areaLanes = [...lanes.values()].sort(
    (a, b) =>
      conditionRank[a.area!.condition] - conditionRank[b.area!.condition] ||
      a.area!.order - b.area!.order,
  );

  return { areaLanes, inbox };
}

function byDateThenTitle(a: PlanItem, b: PlanItem): number {
  const left = a.date ?? 0;
  const right = b.date ?? 0;
  if (left !== right) return left - right;
  return a.title.localeCompare(b.title);
}

/* ---------------------------------------------------------------- totals -- */

export interface SlotTotals {
  /** Items per day slot, summed across the lanes actually on screen. */
  byDay: Map<string, number>;
  none: number;
  overdue: number;
  /** The busiest single day — the scale the header bars are drawn against. */
  peak: number;
}

/**
 * What each column of the axis is holding *right now*.
 *
 * Pass only the visible lanes: the header counts have to agree with what the
 * canvas below them shows, so filtering an Area out has to take its work out of
 * the day headers too.
 */
export function slotTotals(lanes: Lane[]): SlotTotals {
  const byDay = new Map<string, number>();
  let none = 0;
  let overdue = 0;

  for (const lane of lanes) {
    for (const [key, bucket] of lane.byDay) {
      byDay.set(key, (byDay.get(key) ?? 0) + bucket.length);
    }
    none += lane.none.length;
    overdue += lane.overdue.length;
  }

  let peak = 1;
  for (const count of byDay.values()) if (count > peak) peak = count;

  return { byDay, none, overdue, peak };
}

/* ------------------------------------------------------------------ drop -- */

export interface DragState {
  itemId: string;
  kind: PlanItemKind;
  laneId: string;
  /** The lane the pointer is over; the ruler reports the source lane. */
  overLaneId?: string;
  overSlotKey?: string;
  slotKey: string;
}

export type DropTone = "blocked" | "default" | "move";

export interface DropPlan {
  /** The Area the Thread ends up in, when the drag crossed lanes. */
  areaMove?: string;
  caption: string;
  clears: boolean;
  date?: number;
  laneId: string;
  reschedule: boolean;
  slotKey: string;
  tone: DropTone;
  valid: boolean;
}

/**
 * What would happen if the drag ended right now.
 *
 * The caption always names the exact calendar day — never a horizon, never
 * "somewhere next week". The past is not a target: a lane's waiting bay shows
 * a debt, it does not accept new plans.
 */
export function planDrop(
  drag: DragState,
  axis: Axis,
  areaName: (id: string) => string,
): DropPlan | null {
  const { overLaneId, overSlotKey } = drag;
  if (!overLaneId || !overSlotKey) return null;

  const blocked = (caption: string): DropPlan => ({
    caption,
    clears: false,
    laneId: overLaneId,
    reschedule: false,
    slotKey: overSlotKey,
    tone: "blocked",
    valid: false,
  });

  if (overSlotKey === "overdue") return blocked("Can't plan into the past");

  const wrongLane =
    drag.kind === "task"
      ? overLaneId !== INBOX_LANE_ID
      : overLaneId === INBOX_LANE_ID;
  if (wrongLane) {
    return blocked(
      drag.kind === "task"
        ? "Tasks stay in the Inbox"
        : "Threads live in Areas",
    );
  }

  const clears = overSlotKey === "none";
  const day = clears
    ? undefined
    : axis.days.find((entry) => entry.key === overSlotKey);
  if (!clears && !day) return null;

  const reschedule = overSlotKey !== drag.slotKey;
  const movedLane = overLaneId !== drag.laneId;
  const when = clears ? "No date" : dayCaption(day!.at);

  if (!reschedule && !movedLane) return null;

  return {
    areaMove: movedLane ? overLaneId : undefined,
    caption: movedLane
      ? reschedule
        ? `${areaName(overLaneId)} · ${when}`
        : areaName(overLaneId)
      : when,
    clears,
    date: day?.at,
    laneId: overLaneId,
    reschedule,
    slotKey: overSlotKey,
    tone: movedLane ? "move" : "default",
    valid: true,
  };
}

/* --------------------------------------------------------- copy register -- */

/** Confirmation fragment after a reschedule: "resurfaces Mon 11 Aug". */
export function landedLabel(
  date: number | undefined,
  kind: PlanItemKind,
): string {
  if (date == null) {
    return kind === "task" ? "when cleared" : "Follow-up cleared";
  }
  const verb = kind === "task" ? "set for" : "resurfaces";
  return `${verb} ${dayCaption(date)}`;
}

/** "3d ago" — for Inbox capture lines. */
export function agoLabel(timestamp: number, now: number): string {
  const days = -dayDelta(timestamp, now);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

/** How long a waiting chip has been waiting. */
export function waitingLabel(date: number, now: number): string {
  return `${-dayDelta(date, now)}d`;
}

/* ---------------------------------------------------------------- tokens -- */

/** Short condition wording, so the lane subtitle stays on one line. */
export const conditionShort: Record<Condition, string> = {
  critical: "Critical",
  needs_attention: "Needs you",
  healthy: "Healthy",
};

export const conditionIconTone: Record<Condition, string> = {
  critical: "bg-condition-critical text-white",
  needs_attention: "bg-condition-attention/15 text-condition-attention",
  healthy: "bg-surface-3 text-muted-foreground",
};

export const conditionLaneTint: Record<Condition, string> = {
  critical: "bg-condition-critical/[0.05]",
  needs_attention: "bg-condition-attention/[0.04]",
  healthy: "",
};

export const conditionRailTone: Record<Condition, string> = {
  critical: "bg-condition-critical",
  needs_attention: "bg-condition-attention/60",
  healthy: "bg-transparent",
};
