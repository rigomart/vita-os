import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedThread } from "@convex/lib/validators";
import type { LucideIcon } from "lucide-react";

import { groupAreaThreadsByAttention } from "@convex/lib/attentionOrdering";
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
  Plus,
  TriangleAlert,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";

import {
  AttentionEmpty,
  AttentionList,
  RowDeleteAction,
} from "@/features/attention-list";
import { ThreadAttentionCard } from "@/features/threads/components/thread-attention-card";
import { cn } from "@/lib/utils";

import { AreaThreadsSkeleton } from "./area-threads-skeleton";

interface AreaThreadsProps {
  threads: ProjectedThread[];
  currentDate: number;
  isLoading?: boolean;
  onCreateThread: () => void;
  onCompleteNextMove: (threadId: Id<"threads">) => void;
  onRemoveThread: (threadId: Id<"threads">) => void;
  onSetFollowUp: (threadId: Id<"threads">, when: number | undefined) => void;
}

interface Lane {
  escalated: boolean;
  icon: LucideIcon;
  id: string;
  label: string;
  summaryLabel: string;
  threads: ProjectedThread[];
}

export function AreaThreads({
  threads,
  currentDate,
  isLoading = false,
  onCreateThread,
  onCompleteNextMove,
  onRemoveThread,
  onSetFollowUp,
}: AreaThreadsProps) {
  // Lane state is session-local.
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const groups = groupAreaThreadsByAttention(threads, currentDate);
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

  // Reappearing lanes start expanded.
  const filledLaneKey = filledLanes.map((lane) => lane.id).join(" ");
  useEffect(() => {
    setCollapsedIds((previous) => {
      const filled = new Set(filledLaneKey.split(" "));
      const kept = [...previous].filter((id) => filled.has(id));
      return kept.length === previous.size ? previous : new Set(kept);
    });
  }, [filledLaneKey]);

  const setLaneOpen = (id: string, open: boolean) => {
    setCollapsedIds((previous) => {
      const next = new Set(previous);
      if (open) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <section aria-label="Threads">
        <AreaThreadsSkeleton />
      </section>
    );
  }

  if (total === 0) {
    return (
      <section aria-label="Threads">
        <AttentionEmpty>
          <div className="flex flex-col items-center gap-3">
            <span>No open Threads in this Area yet.</span>
            <Button size="sm" onClick={onCreateThread}>
              <Plus data-icon="inline-start" />
              New Thread
            </Button>
          </div>
        </AttentionEmpty>
      </section>
    );
  }

  return (
    <section aria-label="Threads" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <TriageCensus lanes={filledLanes} />
        <Button size="sm" className="shrink-0" onClick={onCreateThread}>
          <Plus data-icon="inline-start" />
          New Thread
        </Button>
      </div>
      <div className="flex flex-col gap-7">
        {filledLanes.map((lane) => (
          <AttentionLane
            key={lane.id}
            lane={lane}
            now={currentDate}
            open={!collapsedIds.has(lane.id)}
            onOpenChange={(open) => setLaneOpen(lane.id, open)}
            onCompleteNextMove={onCompleteNextMove}
            onRemoveThread={onRemoveThread}
            onSetFollowUp={onSetFollowUp}
          />
        ))}
      </div>
    </section>
  );
}

function TriageCensus({ lanes }: { lanes: Lane[] }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs tabular-nums text-muted-foreground">
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

function AttentionLane({
  lane,
  now,
  onCompleteNextMove,
  onOpenChange,
  onRemoveThread,
  onSetFollowUp,
  open,
}: {
  lane: Lane;
  now: number;
  onCompleteNextMove: (threadId: Id<"threads">) => void;
  onOpenChange: (open: boolean) => void;
  onRemoveThread: (threadId: Id<"threads">) => void;
  onSetFollowUp: (threadId: Id<"threads">, when: number | undefined) => void;
  open: boolean;
}) {
  const LaneIcon = lane.icon;
  const count = lane.threads.length;
  const escalated = lane.escalated && count > 0;

  return (
    <section aria-label={`${lane.label} Threads`}>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        {/* Keep a real heading while making the whole row the trigger. */}
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
                "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
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

        <CollapsibleContent>
          <div className="mt-1">
            <AttentionList className="gap-1">
              {lane.threads.map((thread) => (
                <AreaThreadRow
                  key={thread._id}
                  thread={thread}
                  now={now}
                  onCompleteNextMove={onCompleteNextMove}
                  onRemoveThread={onRemoveThread}
                  onSetFollowUp={onSetFollowUp}
                />
              ))}
            </AttentionList>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function AreaThreadRow({
  thread,
  now,
  onCompleteNextMove,
  onRemoveThread,
  onSetFollowUp,
}: {
  thread: ProjectedThread;
  now: number;
  onCompleteNextMove: (threadId: Id<"threads">) => void;
  onRemoveThread: (threadId: Id<"threads">) => void;
  onSetFollowUp: (threadId: Id<"threads">, when: number | undefined) => void;
}) {
  return (
    <ThreadAttentionCard
      currentDate={now}
      thread={thread}
      onCompleteNextMove={() => onCompleteNextMove(thread._id)}
      onSetFollowUp={(when) => onSetFollowUp(thread._id, when)}
      actions={
        <RowDeleteAction
          label="Delete thread"
          title="Delete thread?"
          description={`“${thread.title}” will be permanently removed.`}
          confirmLabel="Delete"
          onConfirm={() => onRemoveThread(thread._id)}
        />
      }
    />
  );
}
