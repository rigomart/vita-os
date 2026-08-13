// PROTOTYPE — throwaway Area view design variant E ("Mosaic").
//
// The Area as a pinboard: one banner, then every open Thread as an equal-weight
// card in a uniform grid. Attention order drives reading order (left-to-right,
// top-to-bottom) — there are no group headings, the sweep of urgency marks in
// the top-left corner of each card is the whole navigation model.

import type { ProjectedThread } from "@convex/lib/validators";

import { groupAreaThreadsByAttention } from "@convex/lib/attentionOrdering";
import { conditionLabels } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  Pencil,
  Plus,
} from "lucide-react";

import { BrandHexagon } from "@/components/ui/brand-hexagon";
import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionPillClassName,
} from "@/features/areas/condition-presentation";
import { whenTone } from "@/features/attention-list/date-parts";
import { cn } from "@/lib/utils";

import type { AreaVariantProps } from "./variant-props";

type CardTone = "due" | "overdue" | "scheduled" | "unscheduled";

/** Urgency mark — same corner on every card, so the grid can be swept. */
const chipToneClassName: Record<CardTone, string> = {
  overdue:
    "bg-condition-attention-fill text-condition-attention-fill-foreground",
  due: "bg-surface-3 text-brand-accent-foreground",
  scheduled: "bg-surface-3/70 text-muted-foreground",
  unscheduled: "text-muted-foreground/40",
};

/** The hairline echoes the chip so urgency survives peripheral vision. */
const cardToneClassName: Record<CardTone, string> = {
  overdue:
    "ring-condition-attention-fill/45 hover:ring-condition-attention-fill/70",
  due: "ring-brand-gold-strong/35 hover:ring-brand-gold-strong/60",
  scheduled: "ring-foreground/5 hover:ring-foreground/15",
  unscheduled: "ring-foreground/5 hover:ring-foreground/15",
};

function toneFor(followUp: number | undefined, now: number): CardTone {
  if (followUp === undefined) return "unscheduled";
  return whenTone(followUp, now) ?? "scheduled";
}

export function AreaVariantE({
  area,
  threads,
  now,
  onEdit,
  onCreateThread,
}: AreaVariantProps) {
  const groups = groupAreaThreadsByAttention(threads, now);
  // Canonical attention order, flattened into grid reading order.
  const ordered = [
    ...groups.dueNow,
    ...groups.upcoming,
    ...groups.withNextMoves,
    ...groups.open,
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <AreaBanner
        area={area}
        threadCount={ordered.length}
        onEdit={onEdit}
        onCreateThread={onCreateThread}
      />

      {ordered.length === 0 ? (
        <InviteCard
          onCreateThread={onCreateThread}
          label="Start the first Thread"
          hint="Nothing open in this Area yet."
          className="min-h-40"
        />
      ) : (
        <section
          aria-label="Open Threads"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {ordered.map((thread) => (
            <ThreadCard key={thread._id} thread={thread} now={now} />
          ))}
          <InviteCard onCreateThread={onCreateThread} label="New Thread" />
        </section>
      )}
    </div>
  );
}

function AreaBanner({
  area,
  threadCount,
  onEdit,
  onCreateThread,
}: {
  area: AreaVariantProps["area"];
  threadCount: number;
  onEdit: () => void;
  onCreateThread: () => void;
}) {
  const ConditionIcon = conditionIcons[area.condition];
  const standard = area.standard?.trim();

  return (
    <header className="rounded-3xl bg-surface-2 px-5 py-4 ring-1 ring-foreground/5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <BrandHexagon className="size-9 bg-brand-ink text-brand-gold">
          <AreaIcon icon={area.icon} className="size-4" />
        </BrandHexagon>

        <h1 className="min-w-0 truncate font-heading text-2xl font-semibold tracking-tight">
          {area.name}
        </h1>

        <span
          className={cn(
            "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
            conditionPillClassName[area.condition],
          )}
        >
          <ConditionIcon aria-hidden className="size-3.5" />
          {conditionLabels[area.condition]}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil data-icon="inline-start" />
            Edit Area
          </Button>
          <Button size="sm" onClick={onCreateThread}>
            <Plus data-icon="inline-start" />
            New Thread
          </Button>
        </div>
      </div>

      {standard && (
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-muted-foreground/80">
          {standard}
        </p>
      )}

      <p className="mt-2 text-[11px] tabular-nums text-muted-foreground/70">
        {threadCount} {threadCount === 1 ? "Open Thread" : "Open Threads"}
      </p>
    </header>
  );
}

function ThreadCard({ thread, now }: { thread: ProjectedThread; now: number }) {
  const tone = toneFor(thread.followUp, now);
  const nextMove = thread.nextMove?.trim();
  const activityAt = thread.lastActivityAt ?? thread.createdAt;
  const activityDate = new Date(activityAt);

  return (
    <Link
      to="."
      search={(prev) => ({ ...prev, thread: thread.slug })}
      className={cn(
        "group/card flex h-full min-h-[8.5rem] min-w-0 flex-col gap-2 rounded-2xl bg-surface-2 p-3.5 ring-1 outline-none transition-all duration-200 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none",
        cardToneClassName[tone],
      )}
    >
      <UrgencyChip followUp={thread.followUp} tone={tone} />

      <span className="line-clamp-2 min-w-0 text-sm leading-snug font-medium">
        {thread.title}
      </span>

      {nextMove ? (
        <span className="flex min-w-0 items-start gap-1.5 text-xs leading-snug text-muted-foreground">
          <ArrowRight aria-hidden className="mt-0.5 size-3 shrink-0" />
          <span className="line-clamp-2 min-w-0">{nextMove}</span>
        </span>
      ) : (
        <span className="flex min-w-0 items-start gap-1.5 text-xs leading-snug text-muted-foreground/45">
          <ArrowRight aria-hidden className="mt-0.5 size-3 shrink-0" />
          <span>No next move</span>
        </span>
      )}

      <span className="mt-auto flex items-center gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground/80">
        <span className="min-w-0 truncate">
          {thread.lastActivityAt === undefined ? "Created " : "Active "}
          <time dateTime={activityDate.toISOString()} className="tabular-nums">
            {formatDistanceToNow(activityDate, { addSuffix: true })}
          </time>
        </span>
        <ChevronRight
          aria-hidden
          className="ml-auto size-3.5 shrink-0 opacity-0 transition-opacity duration-200 group-hover/card:opacity-60 group-focus-visible/card:opacity-60 motion-reduce:transition-none"
        />
      </span>
    </Link>
  );
}

function UrgencyChip({
  followUp,
  tone,
}: {
  followUp: number | undefined;
  tone: CardTone;
}) {
  const className = cn(
    "inline-flex h-5 w-fit items-center gap-1 rounded-full px-1.5 text-[10px] font-medium tracking-wide uppercase",
    chipToneClassName[tone],
  );

  if (followUp === undefined) {
    return (
      <span className={className}>
        <span
          aria-hidden
          className="size-2.5 rounded-full border border-dashed border-current"
        />
        No follow-up
      </span>
    );
  }

  const date = new Date(followUp);

  return (
    <span className={className}>
      <CalendarClock aria-hidden className="size-3" />
      <time dateTime={date.toISOString()} className="tabular-nums">
        {tone === "due" ? "Today" : format(date, "MMM d")}
      </time>
      {tone === "overdue" && <span>· late</span>}
    </span>
  );
}

function InviteCard({
  onCreateThread,
  label,
  hint,
  className,
}: {
  onCreateThread: () => void;
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onCreateThread}
      className={cn(
        "flex h-full min-h-[8.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border p-3.5 text-muted-foreground outline-none transition-colors duration-200 hover:border-brand-gold-strong/60 hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none",
        className,
      )}
    >
      <Plus aria-hidden className="size-4" />
      <span className="text-xs font-medium">{label}</span>
      {hint && (
        <span className="max-w-prose text-center text-[11px] text-muted-foreground/70">
          {hint}
        </span>
      )}
    </button>
  );
}
