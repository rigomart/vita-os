// PROTOTYPE — throwaway Area view design variant B2 ("Hot Lane").
// Refinement of variant B: the due-now lane becomes a genuinely elevated,
// solid-accented band; every other lane retreats to micro-caps so the hot
// band owns the page's energy. When nothing is due now, the heat disappears.

import type { ProjectedThread } from "@convex/lib/validators";

import { groupAreaThreadsByAttention } from "@convex/lib/attentionOrdering";
import { conditionLabels } from "@convex/lib/condition";
import { Button } from "@vita-os/ui/components/button";
import { Pencil, Plus, TriangleAlert } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { BrandHexagon } from "@/components/ui/brand-hexagon";
import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionPillClassName,
} from "@/features/areas/condition-presentation";
import {
  AttentionEmpty,
  AttentionList,
  AttentionRow,
  type AttentionRowModel,
} from "@/features/attention-list";
import { cn } from "@/lib/utils";

import type { AreaVariantProps } from "./variant-props";

interface Lane {
  id: string;
  label: string;
  threads: ProjectedThread[];
}

export function AreaVariantB2({
  area,
  threads,
  now,
  onEdit,
  onCreateThread,
}: AreaVariantProps) {
  const groups = groupAreaThreadsByAttention(threads, now);
  const hotLane: Lane = {
    id: "lane-due-now",
    label: "Due now",
    threads: groups.dueNow,
  };
  const quietLanes: Lane[] = [
    { id: "lane-upcoming", label: "Upcoming", threads: groups.upcoming },
    {
      id: "lane-next-moves",
      label: "Next moves",
      threads: groups.withNextMoves,
    },
    { id: "lane-open", label: "Open", threads: groups.open },
  ];
  const lanes = [hotLane, ...quietLanes];
  const total = lanes.reduce((sum, lane) => sum + lane.threads.length, 0);
  const standard = area.standard?.trim();
  const ConditionIcon = conditionIcons[area.condition];

  return (
    <div className="mx-auto flex max-w-4xl flex-col border-t-2 border-brand-gold-strong/55 pt-3">
      <PageHeader
        className="mb-0"
        title={area.name}
        titleLeading={
          <BrandHexagon className="mr-1.5 size-8 bg-brand-ink text-brand-gold">
            <AreaIcon icon={area.icon} className="size-4" />
          </BrandHexagon>
        }
        titleAccessory={
          <span
            className={cn(
              "ml-2.5 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
              conditionPillClassName[area.condition],
            )}
          >
            <ConditionIcon aria-hidden className="size-3.5" />
            {conditionLabels[area.condition]}
          </span>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit Area"
              onClick={onEdit}
            >
              <Pencil />
            </Button>
            <Button size="sm" onClick={onCreateThread}>
              <Plus data-icon="inline-start" />
              New Thread
            </Button>
          </>
        }
      />

      {standard && (
        <p className="mt-1.5 flex max-w-3xl items-baseline gap-2">
          <span className="shrink-0 text-[10px] font-medium tracking-wider text-muted-foreground/70 uppercase">
            Standard
          </span>
          <span className="min-w-0 truncate text-sm text-muted-foreground">
            {standard}
          </span>
        </p>
      )}

      {total === 0 ? (
        <div className="mt-8">
          <AttentionEmpty>
            <div className="flex flex-col items-center gap-3">
              <span>No open Threads in this Area yet.</span>
              <Button size="sm" onClick={onCreateThread}>
                <Plus data-icon="inline-start" />
                New Thread
              </Button>
            </div>
          </AttentionEmpty>
        </div>
      ) : (
        <>
          <StatusBand lanes={lanes} total={total} />

          {hotLane.threads.length > 0 ? (
            <HotLane lane={hotLane} now={now} />
          ) : (
            <p className="mt-6 text-xs text-muted-foreground/70">
              Nothing due now.
            </p>
          )}

          {quietLanes
            .filter((lane) => lane.threads.length > 0)
            .map((lane) => (
              <QuietLane key={lane.id} lane={lane} now={now} />
            ))}
        </>
      )}
    </div>
  );
}

/**
 * Segmented status band: one chip per lane, the due-now chip solid when it is
 * carrying anything. Sits below the app top bar (h-12, z-20) so lane anchors
 * scroll under it.
 */
function StatusBand({ lanes, total }: { lanes: Lane[]; total: number }) {
  return (
    <div className="sticky top-12 z-10 mt-4 flex flex-wrap items-center gap-1.5 border-y border-border/60 bg-surface-1/95 py-1.5 backdrop-blur">
      {lanes.map((lane, index) => (
        <StatusChip key={lane.id} lane={lane} hot={index === 0} />
      ))}
      <span className="ml-auto pr-1 pl-3 text-[11px] tabular-nums text-muted-foreground/70">
        {total} Open {total === 1 ? "Thread" : "Threads"}
      </span>
    </div>
  );
}

function StatusChip({ hot, lane }: { hot: boolean; lane: Lane }) {
  const count = lane.threads.length;
  const isHot = hot && count > 0;
  const shared =
    "inline-flex items-baseline gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] tracking-wider uppercase";
  const tone = isHot
    ? "bg-condition-attention-fill font-semibold text-condition-attention-fill-foreground"
    : count === 0
      ? "text-muted-foreground/45"
      : "bg-surface-3/70 text-muted-foreground";
  const body = (
    <>
      <span className="text-[11px] font-semibold tabular-nums">{count}</span>
      <span className="truncate">{lane.label}</span>
    </>
  );

  // Empty lanes render no section, so there is nothing to anchor to.
  if (count === 0) {
    return <span className={cn(shared, tone)}>{body}</span>;
  }

  return (
    <a
      href={`#${lane.id}`}
      className={cn(
        shared,
        tone,
        "max-w-[45%] outline-none transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none",
      )}
    >
      {body}
    </a>
  );
}

/** The hot lane: elevated panel, solid accent rule, solid count chip. */
function HotLane({ lane, now }: { lane: Lane; now: number }) {
  return (
    <section
      id={lane.id}
      aria-label={`${lane.label} Threads`}
      className="mt-5 scroll-mt-24 rounded-2xl border-l-2 border-condition-attention bg-surface-2 px-3 pt-3 pb-2.5 shadow-sm"
    >
      <div className="flex items-center gap-2 pl-1">
        <TriangleAlert
          aria-hidden
          className="size-4 shrink-0 text-condition-attention"
        />
        <h2 className="font-heading text-sm font-semibold tracking-wide text-condition-attention">
          {lane.label}
        </h2>
        <span className="rounded-full bg-condition-attention-fill px-2 py-0.5 text-[11px] leading-none font-semibold tabular-nums text-condition-attention-fill-foreground">
          {lane.threads.length}
        </span>
      </div>

      <div className="mt-2">
        <AttentionList>
          {lane.threads.map((thread) => (
            <AttentionRow key={thread._id} now={now} row={toRow(thread)} />
          ))}
        </AttentionList>
      </div>
    </section>
  );
}

/** Everything that is not on fire: micro-caps heading, no icon, no rule. */
function QuietLane({ lane, now }: { lane: Lane; now: number }) {
  return (
    <section
      id={lane.id}
      aria-label={`${lane.label} Threads`}
      className="mt-8 scroll-mt-24"
    >
      <div className="flex items-baseline gap-2 pl-1">
        <h2 className="font-heading text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
          {lane.label}
        </h2>
        <span className="text-[11px] tabular-nums text-muted-foreground/50">
          {lane.threads.length}
        </span>
      </div>

      <div className="mt-1.5">
        <AttentionList>
          {lane.threads.map((thread) => (
            <AttentionRow key={thread._id} now={now} row={toRow(thread)} />
          ))}
        </AttentionList>
      </div>
    </section>
  );
}

function toRow(thread: ProjectedThread): AttentionRowModel {
  const nextMove = thread.nextMove?.trim();
  const summary = thread.summary?.trim();

  return {
    title: thread.title,
    detail: nextMove || summary || undefined,
    detailKind: nextMove ? "next-move" : "summary",
    when: thread.followUp,
    linkTo: { threadSlug: thread.slug },
  };
}
