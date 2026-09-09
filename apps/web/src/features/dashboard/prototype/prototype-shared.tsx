/**
 * PROTOTYPE — issue #314. Throwaway; do not import from production code.
 *
 * The few primitives every variant shares: how an item's date is bucketed,
 * how a Thread row opens in place, and how an Area is marked. Layout is
 * deliberately NOT shared — each variant owns its own structure.
 */
import type { ReactNode } from "react";

import { conditionLabels } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { conditionTextClassName } from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type {
  DashboardArea,
  DashboardInboxNote,
  DashboardThread,
} from "../components/dashboard-model";

import { dayDelta, daysSince } from "../components/dashboard-model";

export const QUIET_AFTER_DAYS = 7;
/** A Follow-up this many days out or nearer still reads as "now-ish". */
export const NEAR_TERM_DAYS = 2;

export type Horizon = "later" | "now" | "soon" | "undated";

/** overdue/today = now, 1–6 days = soon, 7+ = later. */
export function horizonOf(
  when: number | undefined,
  currentDate: number,
): Horizon {
  if (when === undefined) return "undated";
  const delta = dayDelta(when, currentDate);
  if (delta <= 0) return "now";
  if (delta <= 6) return "soon";
  return "later";
}

export interface PrototypeEntry {
  area?: DashboardArea;
  detail?: string;
  id: string;
  kind: "note" | "thread";
  /** True when the detail is a Next Move rather than a summary. */
  isNextMove: boolean;
  note?: DashboardInboxNote;
  quietDays?: number;
  thread?: DashboardThread;
  title: string;
  when?: number;
}

export function threadEntry(
  thread: DashboardThread,
  areaById: Map<string, DashboardArea>,
  currentDate: number,
): PrototypeEntry {
  const nextMove = thread.nextMove?.trim();
  return {
    id: thread.id,
    kind: "thread",
    title: thread.title,
    detail: nextMove || thread.summary?.trim(),
    isNextMove: Boolean(nextMove),
    when: thread.followUp,
    area: areaById.get(thread.areaId),
    thread,
    quietDays:
      thread.lastActivityAt === undefined
        ? undefined
        : daysSince(thread.lastActivityAt, currentDate),
  };
}

export function noteEntry(note: DashboardInboxNote): PrototypeEntry {
  return {
    id: note.id,
    kind: "note",
    title: note.body,
    isNextMove: false,
    when: note.when,
    note,
  };
}

export function areaMap(areas: DashboardArea[]) {
  return new Map(areas.map((area) => [area.id, area]));
}

/** Opens the Thread in place, or the Notes surface for a standalone Note. */
export function EntryLink({
  children,
  className,
  entry,
}: {
  children: ReactNode;
  className?: string;
  entry: PrototypeEntry;
}) {
  return (
    <Link
      to="."
      search={(previous) =>
        entry.kind === "thread"
          ? { ...previous, thread: entry.thread?.slug }
          : { ...previous, inbox: true as const }
      }
      className={cn(
        "block outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function AreaMark({
  area,
  className,
  withName = true,
}: {
  area?: DashboardArea;
  className?: string;
  withName?: boolean;
}) {
  if (!area) return null;
  return (
    <span
      title={`${area.name} — ${conditionLabels[area.condition]}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-2xs",
        conditionTextClassName[area.condition],
        className,
      )}
    >
      <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
      {withName && <span className="truncate">{area.name}</span>}
    </span>
  );
}

/** A standalone Note is marked so it never reads as a Thread. */
export function NoteMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm border border-border/60 px-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground/70",
        className,
      )}
    >
      Note
    </span>
  );
}

export function dateToneClassName(when: number, currentDate: number) {
  const delta = dayDelta(when, currentDate);
  if (delta < 0) return "font-semibold text-condition-attention";
  if (delta <= 1) return "font-semibold text-foreground";
  if (delta <= 6) return "text-foreground/70";
  return "text-muted-foreground/70";
}
