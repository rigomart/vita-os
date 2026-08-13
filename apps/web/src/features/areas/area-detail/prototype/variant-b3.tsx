// PROTOTYPE — throwaway Area view design variant B3 ("Workbench").
// Refinement of variant B (Triage Lanes): the same lanes, but as drawers you
// can open and close. Asks whether lanes earn interaction — is the collapse
// machinery worth it, or is a static inventory enough?

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
import { useState } from "react";

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

export function AreaVariantB3({
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
          <WorkbenchToolbar
            total={total}
            allCollapsed={filledLanes.every((lane) =>
              collapsedIds.has(lane.id),
            )}
            allExpanded={filledLanes.every(
              (lane) => !collapsedIds.has(lane.id),
            )}
            onCollapseAll={() =>
              setCollapsedIds(new Set(filledLanes.map((lane) => lane.id)))
            }
            onExpandAll={() => setCollapsedIds(new Set<string>())}
          />

          <div className="mt-2 flex flex-col gap-7">
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
 * Replaces B's sticky triage strip: a quiet, non-sticky bench control bar.
 * Total inventory on the left of the controls, drawer controls on the right.
 * No lane anchors — collapsed lanes make anchor-scroll meaningless.
 */
function WorkbenchToolbar({
  allCollapsed,
  allExpanded,
  onCollapseAll,
  onExpandAll,
  total,
}: {
  allCollapsed: boolean;
  allExpanded: boolean;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  total: number;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-x-2 gap-y-1 border-b border-border/60 pb-1.5">
      <span className="mr-auto text-[11px] tabular-nums text-muted-foreground/70">
        {total} Open {total === 1 ? "Thread" : "Threads"}
      </span>
      <Button
        variant="ghost"
        size="xs"
        className="text-muted-foreground"
        disabled={allCollapsed}
        onClick={onCollapseAll}
      >
        Collapse all
      </Button>
      <Button
        variant="ghost"
        size="xs"
        className="text-muted-foreground"
        disabled={allExpanded}
        onClick={onExpandAll}
      >
        Expand all
      </Button>
    </div>
  );
}

/**
 * One drawer. Heading carries real weight (the anti-B1 move): heading type,
 * lane icon, count chip. Due now is toned with condition-attention on the
 * heading and a solid chip — no wash, no panel.
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
