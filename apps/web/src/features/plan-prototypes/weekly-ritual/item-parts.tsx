import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { ArrowRight, Check, Inbox } from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { PlanItem } from "./model";

import { areaOf, daysLate } from "./model";

/** Everything a rendered item can do to itself. All local, all synchronous. */
export interface PlanActions {
  /** `undefined` clears the soft date, which is always a legitimate outcome. */
  setWhen: (id: string, when: number | undefined) => void;
  setNextMove: (id: string, text: string) => void;
  toggleNextMoveDone: (id: string) => void;
  /** Resolve a Thread / complete a Task — either way it leaves the surface. */
  resolve: (id: string) => void;
}

/**
 * The one mark that says "Thread" or "Task" at a glance: Threads get their
 * Area icon on a solid tile, Tasks get a dashed inbox tile and no Area.
 */
export function ItemGlyph({
  className,
  item,
  size = "md",
}: {
  className?: string;
  item: PlanItem;
  size?: "lg" | "md";
}) {
  const area = areaOf(item);
  const box = size === "lg" ? "size-9 rounded-lg" : "size-6 rounded-md";
  const glyph = size === "lg" ? "size-4.5" : "size-3.5";

  if (item.kind === "task") {
    return (
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center border border-dashed border-border text-muted-foreground/70",
          box,
          className,
        )}
      >
        <Inbox className={glyph} />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-surface-3 text-brand-accent-foreground",
        box,
        className,
      )}
    >
      <AreaIcon icon={area?.icon} className={glyph} />
    </span>
  );
}

/** "Family Health" for Threads, "Inbox task" for Tasks. */
export function ItemContext({
  className,
  item,
}: {
  className?: string;
  item: PlanItem;
}) {
  const area = areaOf(item);
  return (
    <span
      className={cn(
        "truncate text-[11px] text-muted-foreground",
        item.kind === "task" && "text-muted-foreground/70 italic",
        className,
      )}
    >
      {item.kind === "task" ? "Inbox task" : (area?.name ?? "Thread")}
    </span>
  );
}

/**
 * A passed soft date. Reads as "waiting on you", so it uses the
 * `condition-attention` family — never `destructive`.
 */
export function StaleChip({
  className,
  now,
  when,
}: {
  className?: string;
  now: number;
  when: number;
}) {
  const late = daysLate(when, now);
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full bg-condition-attention/12 px-1.5 text-[10px] font-medium text-condition-attention tabular-nums",
        className,
      )}
    >
      {late}d waiting
    </span>
  );
}

/** The single Next Move, rendered as one line. Never a list. */
export function NextMoveLine({
  className,
  item,
}: {
  className?: string;
  item: PlanItem;
}) {
  if (!item.nextMove) return null;
  return (
    <span
      className={cn(
        "flex min-w-0 items-start gap-1 text-xs text-muted-foreground",
        item.nextMoveDone && "text-muted-foreground/50",
        className,
      )}
    >
      {item.nextMoveDone ? (
        <Check className="mt-px size-3 shrink-0 text-condition-healthy" />
      ) : (
        <ArrowRight className="mt-px size-3 shrink-0" />
      )}
      <span className={cn("truncate", item.nextMoveDone && "line-through")}>
        {item.nextMove}
      </span>
    </span>
  );
}

/** "Thu 6" / "waiting 2 days" / "no date" — the item's soft-date state. */
export function whenSummary(item: PlanItem, now: number): string {
  if (item.when === undefined) return "No date";
  const late = daysLate(item.when, now);
  if (late > 0) return `Waiting ${late} ${late === 1 ? "day" : "days"}`;
  if (late === 0) return "Today";
  return format(new Date(item.when), "EEE d MMM");
}
