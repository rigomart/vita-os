// PROTOTYPE — throwaway Area view design variant B1 ("Quiet Lanes").
// A refinement of variant B: the same triage lanes, stripped of every piece of
// chrome that was not carrying its weight. One continuous list of Threads,
// briefly interrupted by whispered lane labels. The only escalation left for
// "Due now" is typographic — the AttentionRow date rail is loud enough.

import type { ProjectedThread } from "@convex/lib/validators";

import { groupAreaThreadsByAttention } from "@convex/lib/attentionOrdering";
import { conditionLabels } from "@convex/lib/condition";
import { Button } from "@vita-os/ui/components/button";
import { Pencil, Plus } from "lucide-react";
import { Fragment } from "react";

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
  escalated: boolean;
  id: string;
  /** Micro-label above the rows: "DUE NOW". */
  label: string;
  /** Sentence-case fragment for the census line: "3 due now". */
  summaryLabel: string;
  threads: ProjectedThread[];
}

export function AreaVariantB1({
  area,
  threads,
  now,
  onEdit,
  onCreateThread,
}: AreaVariantProps) {
  const groups = groupAreaThreadsByAttention(threads, now);
  const lanes: Lane[] = [
    {
      id: "lane-due-now",
      label: "Due now",
      summaryLabel: "due now",
      threads: groups.dueNow,
      escalated: true,
    },
    {
      id: "lane-upcoming",
      label: "Upcoming",
      summaryLabel: "upcoming",
      threads: groups.upcoming,
      escalated: false,
    },
    {
      id: "lane-next-moves",
      label: "Next moves",
      summaryLabel: "next moves",
      threads: groups.withNextMoves,
      escalated: false,
    },
    {
      id: "lane-open",
      label: "Open",
      summaryLabel: "open",
      threads: groups.open,
      escalated: false,
    },
  ];
  const filledLanes = lanes.filter((lane) => lane.threads.length > 0);
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

      {filledLanes.length === 0 ? (
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
          <TriageCensus lanes={filledLanes} />
          {filledLanes.map((lane) => (
            <QuietLane key={lane.id} lane={lane} now={now} />
          ))}
        </>
      )}
    </div>
  );
}

/**
 * The former sticky strip, reduced to a single line of running text that scrolls
 * away with everything else: no anchors, no borders, no backdrop. It tells you
 * the shape of the page once, then gets out of the way.
 */
function TriageCensus({ lanes }: { lanes: Lane[] }) {
  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-[11px] tabular-nums text-muted-foreground">
      {lanes.map((lane, index) => (
        <Fragment key={lane.id}>
          {index > 0 && (
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
          )}
          <span className={cn(lane.escalated && "text-condition-attention")}>
            {lane.threads.length} {lane.summaryLabel}
          </span>
        </Fragment>
      ))}
    </p>
  );
}

/**
 * A whisper, a count, and a hairline. Escalation for the due-now lane is a
 * colour swap on those two words — no wash, no rule, no panel, no chip.
 */
function QuietLane({ lane, now }: { lane: Lane; now: number }) {
  const escalated = lane.escalated;

  return (
    <section aria-label={`${lane.label} Threads`} className="pt-4">
      <div className="flex items-baseline gap-1.5 border-b border-border/40 pb-1">
        <h2
          className={cn(
            "min-w-0 truncate text-[10px] font-medium tracking-wider uppercase",
            escalated ? "text-condition-attention" : "text-muted-foreground/70",
          )}
        >
          {lane.label}
        </h2>
        <span
          className={cn(
            "shrink-0 text-[10px] tabular-nums",
            escalated
              ? "text-condition-attention/80"
              : "text-muted-foreground/50",
          )}
        >
          {lane.threads.length}
        </span>
      </div>

      <div className="mt-0.5">
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
