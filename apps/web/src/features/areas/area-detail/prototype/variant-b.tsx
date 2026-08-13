// PROTOTYPE — throwaway Area view design variant B ("Triage Lanes").
// Challenges the flat-list decision: the same single column, but every Thread
// sits inside a visible attention lane, with the due-now lane escalated.

import type { ProjectedThread } from "@convex/lib/validators";
import type { LucideIcon } from "lucide-react";

import { groupAreaThreadsByAttention } from "@convex/lib/attentionOrdering";
import { conditionLabels } from "@convex/lib/condition";
import { Button } from "@vita-os/ui/components/button";
import {
  ArrowRight,
  CalendarClock,
  CircleDashed,
  Pencil,
  Plus,
  TriangleAlert,
} from "lucide-react";
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
  icon: LucideIcon;
  id: string;
  label: string;
  threads: ProjectedThread[];
}

export function AreaVariantB({
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
      icon: TriangleAlert,
      threads: groups.dueNow,
      escalated: true,
    },
    {
      id: "lane-upcoming",
      label: "Upcoming",
      icon: CalendarClock,
      threads: groups.upcoming,
      escalated: false,
    },
    {
      id: "lane-next-moves",
      label: "Next moves",
      icon: ArrowRight,
      threads: groups.withNextMoves,
      escalated: false,
    },
    {
      id: "lane-open",
      label: "Open",
      icon: CircleDashed,
      threads: groups.open,
      escalated: false,
    },
  ];
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
          <TriageStrip lanes={lanes} total={total} />
          {lanes
            .filter((lane) => lane.threads.length > 0)
            .map((lane) => (
              <TriageLane key={lane.id} lane={lane} now={now} />
            ))}
        </>
      )}
    </div>
  );
}

/**
 * The whole page in one band: how much is on fire, how much is merely open.
 * Sits below the app top bar (h-12, z-20) so lane anchors scroll under it.
 */
function TriageStrip({ lanes, total }: { lanes: Lane[]; total: number }) {
  return (
    <div className="sticky top-12 z-10 mt-4 flex flex-wrap items-center gap-y-1 border-y border-border/60 bg-surface-1/95 py-1.5 backdrop-blur">
      {lanes.map((lane, index) => (
        <Fragment key={lane.id}>
          {index > 0 && (
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
          )}
          <TriageSegment lane={lane} />
        </Fragment>
      ))}
      <span className="ml-auto pr-1 pl-3 text-[11px] tabular-nums text-muted-foreground/70">
        {total} Open {total === 1 ? "Thread" : "Threads"}
      </span>
    </div>
  );
}

function TriageSegment({ lane }: { lane: Lane }) {
  const count = lane.threads.length;
  const escalated = lane.escalated && count > 0;
  const body = (
    <>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          escalated && "text-condition-attention",
          count === 0 && "font-medium text-muted-foreground/50",
        )}
      >
        {count}
      </span>
      <span
        className={cn(
          "text-[11px] tracking-wider uppercase",
          escalated ? "text-condition-attention" : "text-muted-foreground/80",
          count === 0 && "text-muted-foreground/50",
        )}
      >
        {lane.label}
      </span>
    </>
  );
  const shared = "flex items-baseline gap-1.5 rounded-md px-2 py-0.5";

  // Empty lanes render no section, so there is nothing to anchor to.
  if (count === 0) {
    return <span className={shared}>{body}</span>;
  }

  return (
    <a
      href={`#${lane.id}`}
      className={cn(
        shared,
        "outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none",
      )}
    >
      {body}
    </a>
  );
}

function TriageLane({ lane, now }: { lane: Lane; now: number }) {
  const LaneIcon = lane.icon;
  const escalated = lane.escalated;

  return (
    <section
      id={lane.id}
      aria-label={`${lane.label} Threads`}
      className={cn(
        "scroll-mt-24 pt-5",
        escalated &&
          "mt-4 rounded-r-lg border-l-2 border-condition-attention bg-condition-attention-fill/10 py-3 pr-2 pl-3",
      )}
    >
      <div className="flex items-center gap-2">
        <LaneIcon
          aria-hidden
          className={cn(
            "size-3.5 shrink-0",
            escalated ? "text-condition-attention" : "text-muted-foreground/70",
          )}
        />
        <h2
          className={cn(
            "font-heading text-xs font-semibold tracking-wider uppercase",
            escalated ? "text-condition-attention" : "text-muted-foreground",
          )}
        >
          {lane.label}
        </h2>
        <span
          className={cn(
            "rounded-full px-1.5 text-[11px] font-medium tabular-nums",
            escalated
              ? "bg-condition-attention-fill text-condition-attention-fill-foreground"
              : "bg-surface-3 text-muted-foreground",
          )}
        >
          {lane.threads.length}
        </span>
        <span
          aria-hidden
          className={cn(
            "ml-1 h-px flex-1",
            escalated ? "bg-condition-attention/30" : "bg-border/50",
          )}
        />
      </div>

      <div className="mt-1">
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
