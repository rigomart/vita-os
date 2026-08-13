// PROTOTYPE — throwaway Area view design variant D ("Focus Stack").
// One question per page: what does this Area need from me next? A slim Area
// strip, one floating hero for the most urgent Thread, then every remaining
// open Thread as flat rows.

import type { ProjectedThread } from "@convex/lib/validators";

import {
  groupAreaThreadsByAttention,
  startOfLocalDay,
} from "@convex/lib/attentionOrdering";
import { conditionLabels } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, CalendarClock, Pencil, Plus } from "lucide-react";

import { BrandHexagon } from "@/components/ui/brand-hexagon";
import { AreaIcon } from "@/features/areas/components/area-icon";
import { conditionTextClassName } from "@/features/areas/condition-presentation";
import {
  AttentionRow,
  type AttentionRowModel,
} from "@/features/attention-list";
import { cn } from "@/lib/utils";

import type { AreaVariantProps } from "./variant-props";

const DAY = 86_400_000;

type FollowUpTone = "later" | "overdue" | "today";

const followUpToneClassName: Record<FollowUpTone, string> = {
  overdue: "font-medium text-condition-attention",
  today: "font-medium text-brand-accent-foreground",
  later: "text-muted-foreground/80",
};

function describeFollowUp(
  followUp: number,
  now: number,
): { label: string; tone: FollowUpTone } {
  const days = Math.round(
    (startOfLocalDay(followUp) - startOfLocalDay(now)) / DAY,
  );
  const date = format(new Date(followUp), "MMM d");

  if (days < 0)
    return { label: `Follow-up overdue · ${date}`, tone: "overdue" };
  if (days === 0) return { label: "Follow-up today", tone: "today" };
  if (days === 1)
    return { label: `Follow-up tomorrow · ${date}`, tone: "later" };
  return { label: `Follow-up ${date}`, tone: "later" };
}

function trimmed(value: string | undefined) {
  const text = value?.trim();
  return text ? text : undefined;
}

export function AreaVariantD({
  area,
  threads,
  now,
  onEdit,
  onCreateThread,
}: AreaVariantProps) {
  const groups = groupAreaThreadsByAttention(threads, now);
  // Canonical attention order, flattened — the first Thread is the hero and
  // everything after it is the queue. No truncation: hero + queue is all of them.
  const ordered = [
    ...groups.dueNow,
    ...groups.upcoming,
    ...groups.withNextMoves,
    ...groups.open,
  ];
  const hero = ordered.length > 0 ? ordered[0] : undefined;
  const queue = ordered.slice(1);
  const standard = trimmed(area.standard);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 border-t-2 border-brand-gold-strong/55 pt-3">
      <div>
        <header className="flex h-9 items-center gap-3">
          <BrandHexagon className="size-7 bg-brand-ink text-brand-gold">
            <AreaIcon icon={area.icon} className="size-3.5" />
          </BrandHexagon>

          <h1 className="min-w-0 truncate font-heading text-lg font-semibold tracking-tight">
            {area.name}
          </h1>

          <span
            className={cn(
              "hidden shrink-0 items-center gap-1.5 text-[11px] sm:inline-flex",
              conditionTextClassName[area.condition],
            )}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {conditionLabels[area.condition]}
          </span>

          <span className="shrink-0 text-[11px] text-muted-foreground/80">
            <span className="tabular-nums">{ordered.length}</span>
            {ordered.length === 1 ? " Open Thread" : " Open Threads"}
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit Area"
              onClick={onEdit}
            >
              <Pencil />
            </Button>
            <Button variant="ghost" size="xs" onClick={onCreateThread}>
              <Plus data-icon="inline-start" />
              New Thread
            </Button>
          </div>
        </header>

        {standard && (
          <p
            className="mt-1 truncate text-xs text-muted-foreground/80"
            title={standard}
          >
            <span className="mr-1.5 text-[10px] tracking-wider text-muted-foreground/60 uppercase">
              Standard
            </span>
            {standard}
          </p>
        )}
      </div>

      {hero ? (
        <Hero thread={hero} now={now} isDueNow={groups.dueNow.length > 0} />
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-4xl bg-surface-2 px-6 py-16 text-center shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
          <BrandHexagon className="size-10 bg-brand-ink text-brand-gold">
            <AreaIcon icon={area.icon} className="size-5" />
          </BrandHexagon>
          <div className="space-y-1">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              No open Threads
            </h2>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground/80">
              Nothing in {area.name} needs you right now. Start a Thread when
              something does.
            </p>
          </div>
          <Button size="sm" onClick={onCreateThread}>
            <Plus data-icon="inline-start" />
            New Thread
          </Button>
        </div>
      )}

      {queue.length > 0 && (
        <section>
          <p className="px-1 pb-1 text-[10px] tracking-wider text-muted-foreground/70 uppercase">
            Up next · <span className="tabular-nums">{queue.length}</span>
          </p>
          <div className="divide-y divide-border/50">
            {queue.map((thread) => (
              <QueueRow key={thread._id} thread={thread} now={now} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Hero({
  thread,
  now,
  isDueNow,
}: {
  thread: ProjectedThread;
  now: number;
  isDueNow: boolean;
}) {
  const nextMove = trimmed(thread.nextMove);
  const summary = trimmed(thread.summary);
  const followUp =
    thread.followUp === undefined
      ? undefined
      : describeFollowUp(thread.followUp, now);

  return (
    <Link
      to="."
      search={(prev) => ({ ...prev, thread: thread.slug })}
      className="block rounded-4xl bg-surface-2 p-6 shadow-md ring-1 ring-foreground/5 transition-colors duration-200 outline-none hover:bg-surface-3 focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none sm:p-8 dark:ring-foreground/10"
    >
      <p
        className={cn(
          "text-[10px] font-medium tracking-wider uppercase",
          isDueNow ? "text-condition-attention" : "text-muted-foreground/70",
        )}
      >
        {isDueNow ? "Needs you" : "Up next"}
      </p>

      <h2 className="mt-2 font-heading text-2xl leading-tight font-semibold tracking-tight break-words sm:text-3xl">
        {thread.title}
      </h2>

      {!nextMove && summary && (
        <p className="mt-2 text-sm break-words text-muted-foreground/80">
          {summary}
        </p>
      )}

      <div className="mt-5 flex items-start gap-2.5">
        {nextMove ? (
          <>
            <ArrowRight
              aria-hidden
              className="mt-1 size-4 shrink-0 text-brand-accent-foreground"
            />
            <p className="min-w-0 text-base leading-snug font-medium break-words">
              {nextMove}
            </p>
          </>
        ) : (
          <>
            <span
              aria-hidden
              className="mt-0.5 size-3.5 shrink-0 rounded-full border border-dashed border-muted-foreground/50"
            />
            <p className="text-sm text-muted-foreground/80">No next move yet</p>
          </>
        )}
      </div>

      {(followUp || thread.lastActivityAt !== undefined) && (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          {followUp && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 tabular-nums",
                followUpToneClassName[followUp.tone],
              )}
            >
              <CalendarClock aria-hidden className="size-3.5" />
              {followUp.label}
            </span>
          )}
          {thread.lastActivityAt !== undefined && (
            <span className="text-muted-foreground/70 tabular-nums">
              Last activity{" "}
              {formatDistanceToNow(new Date(thread.lastActivityAt), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

function QueueRow({ thread, now }: { thread: ProjectedThread; now: number }) {
  const nextMove = trimmed(thread.nextMove);
  const row: AttentionRowModel = {
    title: thread.title,
    detail: nextMove ?? trimmed(thread.summary),
    detailKind: nextMove ? "next-move" : "summary",
    when: thread.followUp,
    linkTo: { threadSlug: thread.slug },
  };

  return <AttentionRow now={now} row={row} />;
}
