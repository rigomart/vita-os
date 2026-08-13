// PROTOTYPE — throwaway Area view design variant B4 ("Converged").
// Round-3 convergence: B3's workbench drawers, with B1's quiet census line in
// place of the toolbar (no Collapse/Expand all), and no gold top rule.

import type { ProjectedThread } from "@convex/lib/validators";
import type { LucideIcon } from "lucide-react";

import { groupAreaThreadsByAttention } from "@convex/lib/attentionOrdering";
import { conditionLabels } from "@convex/lib/condition";
import { Button } from "@vita-os/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  CircleDashed,
  Pencil,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { Fragment, useState } from "react";

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
  /** Sentence-case fragment for the census line: "3 due now". */
  summaryLabel: string;
  threads: ProjectedThread[];
}

export function AreaVariantB4({
  area,
  threads,
  now,
  onEdit,
  onCreateThread,
}: AreaVariantProps) {
  // Session-local only: every lane starts open, collapsing is a user action
  // and is deliberately not persisted.
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const groups = groupAreaThreadsByAttention(threads, now);
  const lanes: Lane[] = [
    {
      id: "lane-due-now",
      label: "Due now",
      summaryLabel: "due now",
      icon: TriangleAlert,
      threads: groups.dueNow,
      escalated: true,
    },
    {
      id: "lane-upcoming",
      label: "Upcoming",
      summaryLabel: "upcoming",
      icon: CalendarClock,
      threads: groups.upcoming,
      escalated: false,
    },
    {
      id: "lane-next-moves",
      label: "Next moves",
      summaryLabel: "next moves",
      icon: ArrowRight,
      threads: groups.withNextMoves,
      escalated: false,
    },
    {
      id: "lane-open",
      label: "Open",
      summaryLabel: "open",
      icon: CircleDashed,
      threads: groups.open,
      escalated: false,
    },
  ];
  const filledLanes = lanes.filter((lane) => lane.threads.length > 0);
  const total = filledLanes.reduce((sum, lane) => sum + lane.threads.length, 0);
  const standard = area.standard?.trim();
  const ConditionIcon = conditionIcons[area.condition];

  const setLaneOpen = (id: string, open: boolean) => {
    setCollapsedIds((previous) => {
      const next = new Set(previous);
      if (open) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col">
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
          <TriageCensus lanes={filledLanes} />
          <div className="mt-4 flex flex-col gap-7">
            {filledLanes.map((lane) => (
              <WorkbenchLane
                key={lane.id}
                lane={lane}
                now={now}
                open={!collapsedIds.has(lane.id)}
                onOpenChange={(open) => setLaneOpen(lane.id, open)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * B1's census line in place of B3's toolbar: one line of running text that
 * scrolls away with everything else — no anchors, no borders, no controls.
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
          <span
            className={cn(
              lane.escalated &&
                lane.threads.length > 0 &&
                "text-condition-attention",
            )}
          >
            {lane.threads.length} {lane.summaryLabel}
          </span>
        </Fragment>
      ))}
    </p>
  );
}

/**
 * One drawer, straight from B3: weighty heading (heading type, lane icon,
 * count chip), whole row toggles the lane, collapsed lanes keep their count.
 */
function WorkbenchLane({
  lane,
  now,
  onOpenChange,
  open,
}: {
  lane: Lane;
  now: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const LaneIcon = lane.icon;
  const count = lane.threads.length;
  const escalated = lane.escalated && count > 0;

  return (
    <section aria-label={`${lane.label} Threads`}>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        {/* Accordion pattern: the heading wraps the trigger, so the lane keeps
            a real document outline while the whole row stays clickable. */}
        <h2 className="flex">
          <CollapsibleTrigger className="group -mx-2 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none">
            <ChevronRight
              aria-hidden
              className={cn(
                "size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:text-foreground motion-reduce:transition-none",
                open && "rotate-90",
              )}
            />
            <LaneIcon
              aria-hidden
              className={cn(
                "size-4 shrink-0",
                escalated
                  ? "text-condition-attention"
                  : "text-muted-foreground",
              )}
            />
            <span
              className={cn(
                "font-heading text-sm font-semibold tracking-tight",
                escalated ? "text-condition-attention" : "text-foreground",
              )}
            >
              {lane.label}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                escalated
                  ? "bg-condition-attention-fill text-condition-attention-fill-foreground"
                  : "bg-surface-3 text-muted-foreground",
              )}
            >
              {count}
            </span>
            <span
              aria-hidden
              className={cn(
                "ml-1 h-px flex-1",
                escalated ? "bg-condition-attention/25" : "bg-border/50",
              )}
            />
          </CollapsibleTrigger>
        </h2>

        {/* No panel animation: matches AttentionCollapsed, which snaps. */}
        <CollapsibleContent>
          <div className="mt-1">
            <AttentionList>
              {lane.threads.map((thread) => (
                <AttentionRow key={thread._id} now={now} row={toRow(thread)} />
              ))}
            </AttentionList>
          </div>
        </CollapsibleContent>
      </Collapsible>
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
