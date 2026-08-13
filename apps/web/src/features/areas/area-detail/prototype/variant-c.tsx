// PROTOTYPE — throwaway Area view design variant C ("Cockpit").
// Wide two-pane ops console: a sticky identity rail plus a dense,
// table-like Thread register whose only urgency signal is the date column.

import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";
import type { ReactNode } from "react";

import { groupAreaThreadsByAttention } from "@convex/lib/attentionOrdering";
import { conditionLabels } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
import { Button } from "@vita-os/ui/components/button";
import { format, formatDistance } from "date-fns";
import { Pencil, Plus } from "lucide-react";

import { BrandHexagon } from "@/components/ui/brand-hexagon";
import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionPillClassName,
} from "@/features/areas/condition-presentation";
import { whenTone } from "@/features/attention-list/date-parts";
import { cn } from "@/lib/utils";

import type { AreaVariantProps } from "./variant-props";

/** One grid template shared by the header row and every register row. */
const registerGrid =
  "grid grid-cols-[minmax(0,1fr)_5.5rem] items-baseline gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_6rem]";

const labelClassName =
  "text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80";

export function AreaVariantC({
  area,
  threads,
  now,
  onEdit,
  onCreateThread,
}: AreaVariantProps) {
  const groups = groupAreaThreadsByAttention(threads, now);
  // Canonical attention order, flattened — the register has no group headings.
  const register = [
    ...groups.dueNow,
    ...groups.upcoming,
    ...groups.withNextMoves,
    ...groups.open,
  ];

  return (
    <div className="mx-auto max-w-7xl border-t-2 border-brand-gold-strong/55 pt-4">
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-10">
        <IdentityRail
          area={area}
          threads={register}
          dueNowCount={groups.dueNow.length}
          now={now}
          onEdit={onEdit}
          onCreateThread={onCreateThread}
        />

        <section className="min-w-0 flex-1">
          <h2 className="sr-only">Threads</h2>
          {register.length === 0 ? (
            <EmptyRegister onCreateThread={onCreateThread} />
          ) : (
            <div>
              <div
                className={cn(
                  registerGrid,
                  "hidden border-b border-border px-2 pb-1.5 sm:grid",
                  labelClassName,
                )}
              >
                <span>Thread</span>
                <span>Next Move</span>
                <span className="text-right">Follow-up</span>
              </div>

              <div className="divide-y divide-border/50">
                {register.map((thread) => (
                  <RegisterRow key={thread._id} thread={thread} now={now} />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function IdentityRail({
  area,
  threads,
  dueNowCount,
  now,
  onEdit,
  onCreateThread,
}: {
  area: ProjectedArea;
  threads: ProjectedThread[];
  dueNowCount: number;
  now: number;
  onEdit: () => void;
  onCreateThread: () => void;
}) {
  const ConditionIcon = conditionIcons[area.condition];
  const standard = area.standard?.trim();

  const followUps = threads
    .map((thread) => thread.followUp)
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);
  const nextFollowUp = followUps[0];

  const activityStamps = threads
    .map((thread) => thread.lastActivityAt)
    .filter((value): value is number => value != null)
    .sort((a, b) => b - a);
  const lastActivity = activityStamps[0];

  return (
    <aside className="shrink-0 md:sticky md:top-16 md:w-64 md:self-start lg:w-72">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <BrandGlyph area={area} />
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-xl font-semibold tracking-tight break-words">
              {area.name}
            </h1>
            <span
              className={cn(
                "mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
                conditionPillClassName[area.condition],
              )}
            >
              <ConditionIcon aria-hidden className="size-3" />
              {conditionLabels[area.condition]}
            </span>
          </div>
        </div>

        {standard && (
          <div className="border-l-2 border-brand-gold-strong/55 pl-3">
            <p className={labelClassName}>Standard</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {standard}
            </p>
          </div>
        )}

        <dl className="divide-y divide-border/50 border-y border-border/50">
          <Stat label="Open Threads" value={threads.length} />
          <Stat
            label="Due now"
            value={dueNowCount}
            tone={dueNowCount > 0 ? "text-condition-attention" : undefined}
          />
          <Stat
            label="Next Follow-up"
            value={
              nextFollowUp === undefined ? undefined : (
                <FollowUpDate followUp={nextFollowUp} now={now} />
              )
            }
          />
          <Stat
            label="Last activity"
            value={
              lastActivity === undefined
                ? undefined
                : formatDistance(new Date(lastActivity), new Date(now), {
                    addSuffix: true,
                  })
            }
          />
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onCreateThread}>
            <Plus data-icon="inline-start" />
            New Thread
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil data-icon="inline-start" />
            Edit Area
          </Button>
        </div>
      </div>
    </aside>
  );
}

function BrandGlyph({ area }: { area: ProjectedArea }) {
  return (
    <BrandHexagon className="size-11 bg-brand-ink text-brand-gold">
      <AreaIcon icon={area.icon} className="size-5" />
    </BrandHexagon>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className={labelClassName}>{label}</dt>
      <dd
        className={cn(
          "text-sm font-medium tabular-nums",
          value == null
            ? "text-muted-foreground/40"
            : (tone ?? "text-foreground"),
        )}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

function RegisterRow({
  thread,
  now,
}: {
  thread: ProjectedThread;
  now: number;
}) {
  const nextMove = thread.nextMove?.trim();

  return (
    <Link
      to="."
      search={(prev) => ({ ...prev, thread: thread.slug })}
      className={cn(
        registerGrid,
        "rounded-sm px-2 py-2.5 outline-none transition-colors duration-200 motion-reduce:transition-none",
        "hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30",
      )}
    >
      <span className="col-start-1 row-start-1 truncate text-sm font-medium">
        {thread.title}
      </span>

      <span
        className={cn(
          "col-start-1 row-start-2 truncate text-xs sm:col-start-2 sm:row-start-1",
          nextMove ? "text-muted-foreground/80" : "text-muted-foreground/30",
        )}
      >
        {nextMove ?? "—"}
      </span>

      <span className="col-start-2 row-start-1 text-right text-xs tabular-nums sm:col-start-3">
        <FollowUpDate followUp={thread.followUp} now={now} />
      </span>
    </Link>
  );
}

function FollowUpDate({
  followUp,
  now,
}: {
  followUp: number | undefined;
  now: number;
}) {
  if (followUp === undefined) {
    return <span className="text-muted-foreground/40">—</span>;
  }

  const date = new Date(followUp);
  const tone = whenTone(followUp, now);

  return (
    <time
      dateTime={date.toISOString()}
      title={format(date, "EEEE, MMMM d, yyyy")}
      className={cn(
        "tabular-nums",
        tone === "overdue" && "font-medium text-condition-attention",
        tone === "due" && "font-medium text-brand-accent-foreground",
        tone === undefined && "text-muted-foreground",
      )}
    >
      {format(date, "MMM d")}
    </time>
  );
}

function EmptyRegister({ onCreateThread }: { onCreateThread: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center">
      <p className="text-sm font-medium">No open Threads in this Area yet.</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        The register stays empty until this Area has something in motion.
      </p>
      <Button size="sm" variant="outline" onClick={onCreateThread}>
        <Plus data-icon="inline-start" />
        New Thread
      </Button>
    </div>
  );
}
