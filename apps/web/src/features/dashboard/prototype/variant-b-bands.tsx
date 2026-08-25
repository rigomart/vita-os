// PROTOTYPE — throwaway (issue #309). Delete with features/dashboard/prototype/.
//
// Variant B — "Temporal bands". The contrast direction of the round: time is
// the loudest channel on the surface. The attention run is cut into four
// standing bands (Now / This week / Later / No date) and run order is
// preserved inside each, so position is still the engine's — but the reader's
// first pass is temporal, not attentional. Built as well as it can be built so
// the comparison can see honestly whether soft dates re-harden into deadlines.

import type { Condition } from "@convex/lib/condition";

import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowRight, Square } from "lucide-react";
import { Fragment } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionShort,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type {
  DashboardArea,
  DashboardInboxTask,
} from "../components/dashboard-model";
import type {
  AttentionDashboardProps,
  AttentionEntry,
} from "./attention-contract";

import {
  buildAttentionRun,
  dayDelta,
  daysSinceActivity,
  relativeDayLabel,
  stalenessLevel,
} from "./attention-contract";

type BandId = "later" | "nodate" | "now" | "week";

/** One row of a band: a Thread from the attention run, or a dated Inbox Task. */
type BandItem =
  | { entry: AttentionEntry; id: string; kind: "thread" }
  | { id: string; kind: "task"; task: DashboardInboxTask; when: number };

interface BandSpec {
  /** One quiet line when the band holds nothing — an empty band is news too. */
  emptyLabel: string;
  id: BandId;
  label: string;
  /** Sentence-case fragment for the census line: "3 this week". */
  summaryLabel: string;
  /** 2xs whisper under the header. */
  whisper?: string;
}

const bandSpecs: BandSpec[] = [
  { emptyLabel: "Nothing due", id: "now", label: "Now", summaryLabel: "now" },
  {
    emptyLabel: "Nothing dated in the next week",
    id: "week",
    label: "This week",
    summaryLabel: "this week",
  },
  {
    emptyLabel: "Nothing further out",
    id: "later",
    label: "Later",
    summaryLabel: "later",
  },
  {
    emptyLabel: "No open Threads",
    id: "nodate",
    label: "No date",
    summaryLabel: "open",
    whisper: "open — ranked by your order",
  },
];

/**
 * Backward time as weight. Four calm steps, never a warning: a Thread nobody
 * has touched in six weeks recedes, it is not accused.
 */
const stalenessClassName = [
  "",
  "opacity-90",
  "opacity-75",
  "opacity-60",
] as const;

export function VariantBBands({
  areas,
  currentDate,
  tasks,
  threads,
}: AttentionDashboardProps) {
  const run = buildAttentionRun(threads, areas, currentDate);
  const undatedTasks = tasks.filter((task) => task.when === undefined);

  if (run.length === 0 && tasks.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nothing is asking for you right now.
      </p>
    );
  }

  const bands = bandSpecs.map((spec) => ({
    ...spec,
    // Threads first, in run order, untouched. Dated Tasks trail the band,
    // soonest first — they are a separate stream, so they never displace a
    // Thread the engine ranked.
    items: [
      ...run
        .filter((entry) => bandForEntry(entry, currentDate) === spec.id)
        .map(
          (entry): BandItem => ({ entry, id: entry.thread.id, kind: "thread" }),
        ),
      ...tasks
        .filter(
          (task): task is DashboardInboxTask & { when: number } =>
            task.when !== undefined &&
            bandForDelta(dayDelta(task.when, currentDate)) === spec.id,
        )
        .sort((a, b) => a.when - b.when)
        .map(
          (task): BandItem => ({
            id: task.id,
            kind: "task",
            task,
            when: task.when,
          }),
        ),
    ],
  }));

  return (
    <div className="flex flex-col gap-6">
      <BandCensus bands={bands} />

      <div className="flex flex-col gap-7">
        {bands.map((band) => (
          <Band
            key={band.id}
            band={band}
            currentDate={currentDate}
            items={band.items}
          />
        ))}
      </div>

      {undatedTasks.length > 0 && (
        <Link
          to="."
          search={(prev) => ({ ...prev, inbox: true })}
          className="inline-flex w-fit items-center gap-1.5 rounded-md py-1 text-2xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <Square aria-hidden className="size-3.5 text-muted-foreground/60" />
          <span className="tabular-nums">
            Inbox · {undatedTasks.length} open
          </span>
        </Link>
      )}
    </div>
  );
}

/** The whole shape of the day in one line, before any row is read. */
function BandCensus({
  bands,
}: {
  bands: (BandSpec & { items: BandItem[] })[];
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-2xs tabular-nums text-muted-foreground">
      {bands.map((band, index) => {
        const count = band.items.length;
        const escalated = band.id === "now" && count > 0;
        return (
          <Fragment key={band.id}>
            {index > 0 && (
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
            )}
            <span
              className={cn(
                escalated && "font-medium text-condition-attention",
                count === 0 && "text-muted-foreground/50",
              )}
            >
              {count} {band.summaryLabel}
            </span>
          </Fragment>
        );
      })}
    </p>
  );
}

/**
 * One standing band. Headers never collapse: this is an orientation surface,
 * and a band that can hide its contents stops being a frame you can trust.
 */
function Band({
  band,
  currentDate,
  items,
}: {
  band: BandSpec;
  currentDate: number;
  items: BandItem[];
}) {
  const escalated = band.id === "now" && items.length > 0;

  return (
    <section aria-label={band.label}>
      <h2 className="flex items-center gap-2">
        <span
          className={cn(
            "font-heading text-2xs font-semibold uppercase tracking-wide",
            escalated ? "text-condition-attention" : "text-muted-foreground",
          )}
        >
          {band.label}
        </span>
        <span
          className={cn(
            "text-2xs tabular-nums",
            escalated ? "text-condition-attention" : "text-muted-foreground/60",
          )}
        >
          {items.length}
        </span>
        <span
          aria-hidden
          className={cn(
            "h-px flex-1",
            escalated ? "bg-condition-attention/25" : "bg-border/60",
          )}
        />
      </h2>

      {band.whisper && items.length > 0 && (
        <p className="mt-1 pl-2 text-2xs text-muted-foreground/60">
          {band.whisper}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-1.5 pl-2 text-2xs text-muted-foreground/60">
          {band.emptyLabel}
        </p>
      ) : (
        <div className="mt-1 flex flex-col">
          {items.map((item) =>
            item.kind === "thread" ? (
              <ThreadRow
                key={item.id}
                band={band.id}
                currentDate={currentDate}
                entry={item.entry}
              />
            ) : (
              <TaskRow
                key={item.id}
                currentDate={currentDate}
                task={item.task}
                when={item.when}
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}

function ThreadRow({
  band,
  currentDate,
  entry,
}: {
  band: BandId;
  currentDate: number;
  entry: AttentionEntry;
}) {
  const { area, thread } = entry;
  const nextMove = thread.nextMove?.trim();
  const summary = thread.summary?.trim();
  const detail = nextMove || summary || undefined;
  const staleDays = daysSinceActivity(thread, currentDate);

  return (
    <Link
      to="."
      search={(prev) => ({ ...prev, thread: thread.slug })}
      title={
        staleDays === undefined
          ? thread.title
          : `${thread.title} — last activity ${staleDays}d ago`
      }
      className={cn(
        "group/row flex h-10 items-center gap-3 rounded-lg px-2 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none",
        stalenessClassName[stalenessLevel(thread, currentDate)],
      )}
    >
      <ProximityRail
        band={band}
        currentDate={currentDate}
        when={thread.followUp}
      />

      <span
        className={cn(
          "min-w-0 truncate text-sm font-medium",
          detail ? "max-w-[48%] shrink-0" : "flex-1",
        )}
      >
        {thread.title}
      </span>

      {detail && (
        <span className="flex min-w-0 flex-1 items-baseline gap-1 text-2xs text-muted-foreground/80">
          {nextMove && (
            <ArrowRight
              aria-hidden
              className="size-3 shrink-0 translate-y-0.5"
            />
          )}
          <span className="truncate">{detail}</span>
        </span>
      )}

      {area && <AreaMark area={area} />}
    </Link>
  );
}

/**
 * A dated Inbox Task, inline where its date puts it. Read-only: the square is
 * a glyph, not a control — checking things off is the Inbox's job.
 */
function TaskRow({
  currentDate,
  task,
  when,
}: {
  currentDate: number;
  task: DashboardInboxTask;
  when: number;
}) {
  return (
    <div className="flex h-10 items-center gap-3 rounded-lg px-2">
      <ProximityRail
        band={bandForDelta(dayDelta(when, currentDate))}
        currentDate={currentDate}
        task
        when={when}
      />
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {task.text}
      </span>
      <span className="sr-only">Inbox task</span>
    </div>
  );
}

/**
 * The row's share of time. Inside a band the label can be terse — the band
 * already said which stretch of time this is.
 */
function ProximityRail({
  band,
  currentDate,
  task = false,
  when,
}: {
  band: BandId;
  currentDate: number;
  task?: boolean;
  when?: number;
}) {
  if (when === undefined) {
    return (
      <span className="flex w-16 shrink-0 items-center">
        <span
          aria-hidden
          className="size-3 rounded-full border border-dashed border-muted-foreground/40"
        />
        <span className="sr-only">No date</span>
      </span>
    );
  }

  const delta = dayDelta(when, currentDate);
  const date = new Date(when);
  const label =
    band === "week"
      ? format(date, "EEE")
      : band === "later"
        ? format(date, "MMM d")
        : relativeDayLabel(when, currentDate);

  return (
    <span className="flex w-16 shrink-0 items-center gap-1.5">
      {task && (
        <Square aria-hidden className="size-3.5 text-muted-foreground/50" />
      )}
      <time
        dateTime={date.toISOString()}
        className={cn(
          "truncate text-2xs tabular-nums",
          task
            ? "text-muted-foreground/70"
            : delta < 0
              ? "font-medium text-condition-attention"
              : delta === 0
                ? "font-medium text-foreground"
                : band === "later"
                  ? "text-muted-foreground/70"
                  : "text-muted-foreground",
        )}
      >
        {label}
      </time>
    </span>
  );
}

/**
 * Whose it is, and how that part of life is doing. Condition rides a shape as
 * well as a hue — the glyph appears only when an Area is asking for something.
 */
function AreaMark({ area }: { area: DashboardArea }) {
  const condition: Condition = area.condition;
  const ConditionIcon = conditionIcons[condition];
  const attention = condition !== "healthy";

  return (
    <span
      title={`${area.name} — ${conditionShort[condition]}`}
      className="hidden w-40 shrink-0 items-center justify-end gap-1 text-2xs lg:flex"
    >
      {attention && (
        <ConditionIcon
          aria-hidden
          className={cn("size-3 shrink-0", conditionTextClassName[condition])}
        />
      )}
      <AreaIcon
        icon={area.icon}
        className={cn("size-3.5 shrink-0", conditionTextClassName[condition])}
      />
      <span
        className={cn(
          "truncate",
          attention
            ? conditionTextClassName[condition]
            : "text-muted-foreground",
        )}
      >
        {area.name}
      </span>
    </span>
  );
}

function bandForEntry(entry: AttentionEntry, currentDate: number): BandId {
  const { followUp } = entry.thread;
  if (followUp === undefined) return "nodate";
  return bandForDelta(dayDelta(followUp, currentDate));
}

function bandForDelta(delta: number): BandId {
  if (delta <= 0) return "now";
  if (delta <= 6) return "week";
  return "later";
}
