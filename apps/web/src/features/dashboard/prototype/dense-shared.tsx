/**
 * PROTOTYPE — issue #314, round 3. The vocabulary the dense variants share.
 *
 * Round 2 answered "too much information density" by removing information;
 * the real ask is the opposite — a dashboard should USE the desktop width —
 * but with far less text, tighter rhythm, and structure doing the work that
 * sentences were doing. So: dates become numeric tokens, Areas become icons,
 * summaries are dropped entirely, and a row is a Next Move (or a title) plus
 * at most one token.
 */
import { conditionLabels } from "@convex/lib/condition";
import { format } from "date-fns";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { conditionTextClassName } from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta } from "../components/dashboard-model";

/** ~4 characters, never a sentence: −6d · Today · Tue · Mar 4. */
export function dateToken(when: number, currentDate: number) {
  const delta = dayDelta(when, currentDate);
  if (delta < 0) return `−${-delta}d`;
  if (delta === 0) return "Today";
  if (delta <= 6) return format(new Date(when), "EEE");
  if (delta <= 27) return `${delta}d`;
  return format(new Date(when), "MMM d");
}

export function dateTone(when: number, currentDate: number) {
  const delta = dayDelta(when, currentDate);
  if (delta < 0) return "text-condition-attention";
  if (delta === 0) return "text-foreground";
  if (delta <= 6) return "text-foreground/60";
  return "text-muted-foreground/45";
}

/** A row says one thing: the move if there is one, else the Thread's name. */
export function rowText(entry: PrototypeEntry) {
  return entry.isNextMove && entry.detail ? entry.detail : entry.title;
}

/** The Area is an icon, never a word — the tooltip carries the name. */
export function AreaGlyph({
  className,
  entry,
}: {
  className?: string;
  entry: PrototypeEntry;
}) {
  if (entry.kind === "note") {
    return (
      <span
        title="Note"
        className={cn(
          "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground/60",
          className,
        )}
      />
    );
  }
  if (!entry.area) return null;
  return (
    <span
      title={`${entry.area.name} — ${conditionLabels[entry.area.condition]}`}
      className={cn(
        "inline-flex shrink-0",
        conditionTextClassName[entry.area.condition],
        className,
      )}
    >
      <AreaIcon icon={entry.area.icon} className="size-3.5" />
    </span>
  );
}

export function DateToken({
  className,
  currentDate,
  when,
}: {
  className?: string;
  currentDate: number;
  when?: number;
}) {
  if (when === undefined) return null;
  return (
    <time
      dateTime={new Date(when).toISOString()}
      className={cn(
        "shrink-0 text-[11px] tabular-nums",
        dateTone(when, currentDate),
        className,
      )}
    >
      {dateToken(when, currentDate)}
    </time>
  );
}

/** Attention order, used wherever a variant needs one flat run. */
export function byAttention(currentDate: number) {
  const rank = (entry: PrototypeEntry) => {
    if (entry.when !== undefined) {
      const delta = dayDelta(entry.when, currentDate);
      if (delta < 0) return 0;
      if (delta === 0) return 1;
      return 3;
    }
    return entry.isNextMove ? 2 : 4;
  };
  return (a: PrototypeEntry, b: PrototypeEntry) =>
    rank(a) - rank(b) || (a.when ?? Infinity) - (b.when ?? Infinity);
}
