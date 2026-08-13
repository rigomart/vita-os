// PROTOTYPE — throwaway Area view design variant A ("The Ledger").
//
// An editorial reading of the Area: one narrow, flowing column where the
// typography carries the hierarchy. The Area name is set large, the Standard
// runs as an epigraph, and the open Threads are set as a ruled ledger index —
// hanging Follow-up gutter, dotted leaders, Next Move as a subordinate line.

import type { ProjectedThread } from "@convex/lib/validators";

import {
  groupAreaThreadsByAttention,
  startOfLocalDay,
} from "@convex/lib/attentionOrdering";
import { conditionLabels } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { format } from "date-fns";
import { CornerDownRight, Pencil, Plus } from "lucide-react";

import { BrandHexagon } from "@/components/ui/brand-hexagon";
import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type { AreaVariantProps } from "./variant-props";

const DAY = 86_400_000;

/** Ledger gutter + entry column; shared by the column heads and every row. */
const ledgerGrid = "grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-5";

type FollowUpTone = "due" | "none" | "overdue" | "upcoming";

const followUpToneClassName: Record<FollowUpTone, string> = {
  overdue: cn(conditionTextClassName.needs_attention, "font-medium"),
  due: "font-medium text-brand-accent-foreground",
  upcoming: "text-muted-foreground",
  none: "text-muted-foreground/35",
};

function dayOffset(when: number, now: number) {
  return Math.round((startOfLocalDay(when) - startOfLocalDay(now)) / DAY);
}

function followUpTone(followUp: number | undefined, now: number): FollowUpTone {
  if (followUp == null) return "none";

  const days = dayOffset(followUp, now);
  if (days < 0) return "overdue";
  if (days === 0) return "due";
  return "upcoming";
}

function followUpLabel(followUp: number, now: number) {
  const date = new Date(followUp);
  if (dayOffset(followUp, now) === 0) return "Today";

  return date.getFullYear() === new Date(now).getFullYear()
    ? format(date, "d MMM")
    : format(date, "d MMM yy");
}

/** The subordinate line under an entry: Next Move first, then whatever is known. */
function entryNote(thread: ProjectedThread) {
  const nextMove = thread.nextMove?.trim();
  if (nextMove) return { kind: "next-move" as const, text: nextMove };

  const summary = thread.summary?.trim();
  if (summary) return { kind: "aside" as const, text: summary };

  const activity = thread.lastActivityContent?.trim();
  if (activity) return { kind: "aside" as const, text: activity };

  return undefined;
}

export function AreaVariantA({
  area,
  threads,
  now,
  onEdit,
  onCreateThread,
}: AreaVariantProps) {
  const groups = groupAreaThreadsByAttention(threads, now);
  const entries = [
    ...groups.dueNow,
    ...groups.upcoming,
    ...groups.withNextMoves,
    ...groups.open,
  ];
  const standard = area.standard?.trim();
  const ConditionIcon = conditionIcons[area.condition];

  return (
    <div className="mx-auto w-full max-w-2xl px-1 pb-24">
      <header className="pt-8 pb-10">
        <div className="flex items-center justify-between gap-4">
          <span className="flex min-w-0 items-center gap-2.5">
            <BrandHexagon className="size-7 bg-brand-ink text-brand-gold">
              <AreaIcon icon={area.icon} className="size-3.5" />
            </BrandHexagon>
            <span
              className={cn(
                "flex items-center gap-1.5 text-[11px] font-medium tracking-[0.18em] uppercase",
                conditionTextClassName[area.condition],
              )}
            >
              <ConditionIcon aria-hidden className="size-3.5" />
              {conditionLabels[area.condition]}
            </span>
          </span>

          <Button
            variant="ghost"
            size="xs"
            onClick={onEdit}
            className="-mr-2 shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            <Pencil data-icon="inline-start" aria-hidden />
            Edit Area
          </Button>
        </div>

        <h1 className="mt-6 font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {area.name}
        </h1>

        {standard && (
          <figure className="mt-7 border-l-2 border-brand-gold-strong/60 pl-5">
            <blockquote className="text-base leading-relaxed text-pretty text-muted-foreground italic sm:text-lg">
              {standard}
            </blockquote>
            <figcaption className="mt-2.5 text-[10px] tracking-[0.2em] text-muted-foreground/60 uppercase">
              The Standard
            </figcaption>
          </figure>
        )}
      </header>

      {entries.length === 0 ? (
        <section className="border-t border-border pt-10">
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground italic">
            Nothing is entered in this ledger yet. Open the first Thread and
            this Area starts keeping its own record.
          </p>
          <Button size="sm" onClick={onCreateThread} className="mt-6">
            <Plus data-icon="inline-start" aria-hidden />
            New Thread
          </Button>
        </section>
      ) : (
        <section>
          <div
            className={cn(
              ledgerGrid,
              "border-b border-border pb-2 text-[10px] tracking-[0.18em] text-muted-foreground/70 uppercase",
            )}
          >
            <span className="text-right">Follow-up</span>
            <span className="flex items-baseline justify-between gap-4">
              <span>
                Open Threads{" "}
                <span className="tabular-nums">{entries.length}</span>
              </span>
              <span className="hidden sm:inline">Activity</span>
            </span>
          </div>

          <ol>
            {entries.map((thread) => (
              <li key={thread._id}>
                <LedgerEntry thread={thread} now={now} />
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={onCreateThread}
            className={cn(
              ledgerGrid,
              "group w-full rounded-sm border-t border-border/60 py-3.5 text-left transition-colors duration-200 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none",
            )}
          >
            <span className="flex justify-end pt-px">
              <Plus
                aria-hidden
                className="size-3.5 text-muted-foreground/60 transition-colors duration-200 group-hover:text-foreground motion-reduce:transition-none"
              />
            </span>
            <span className="text-sm font-medium text-muted-foreground transition-colors duration-200 group-hover:text-foreground motion-reduce:transition-none">
              New Thread
            </span>
          </button>
        </section>
      )}
    </div>
  );
}

function LedgerEntry({
  thread,
  now,
}: {
  thread: ProjectedThread;
  now: number;
}) {
  const tone = followUpTone(thread.followUp, now);
  const note = entryNote(thread);
  const activityAt = thread.lastActivityAt ?? thread.createdAt;

  return (
    <Link
      to="."
      search={(prev) => ({ ...prev, thread: thread.slug })}
      className={cn(
        ledgerGrid,
        "group rounded-sm py-3.5 transition-colors duration-200 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none",
      )}
    >
      <span
        className={cn(
          "pt-px text-right text-[11px] tabular-nums",
          followUpToneClassName[tone],
        )}
      >
        {thread.followUp == null ? (
          <span aria-hidden>—</span>
        ) : (
          <time dateTime={new Date(thread.followUp).toISOString()}>
            {followUpLabel(thread.followUp, now)}
          </time>
        )}
      </span>

      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 truncate text-sm font-medium">
            {thread.title}
          </span>
          <span
            aria-hidden
            className="min-w-6 shrink-0 flex-1 border-b border-dotted border-border"
          />
          <time
            dateTime={new Date(activityAt).toISOString()}
            className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60"
          >
            {format(new Date(activityAt), "d MMM")}
          </time>
        </span>

        {note && (
          <span
            className={cn(
              "mt-1.5 flex min-w-0 items-baseline gap-1.5 text-xs",
              note.kind === "next-move"
                ? "text-muted-foreground"
                : "text-muted-foreground/70 italic",
            )}
          >
            {note.kind === "next-move" && (
              <CornerDownRight
                aria-hidden
                className="size-3 shrink-0 translate-y-0.5 text-muted-foreground/60"
              />
            )}
            <span className="truncate">{note.text}</span>
          </span>
        )}
      </span>
    </Link>
  );
}
