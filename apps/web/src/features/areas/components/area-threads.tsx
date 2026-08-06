import type { Doc, Id } from "@convex/_generated/dataModel";

import { groupAreaThreadsByAttention } from "@convex/lib/attentionOrdering";
import { Button } from "@vita-os/ui/components/button";
import { Plus } from "lucide-react";

import {
  AttentionEmpty,
  AttentionList,
  AttentionRow,
  type AttentionRowModel,
  RowDeleteAction,
} from "@/features/attention-list";

import { AreaThreadsSkeleton } from "./area-threads-skeleton";

interface AreaThreadsProps {
  threads: Doc<"threads">[];
  currentDate: number;
  isLoading?: boolean;
  onCreateThread: () => void;
  onRemoveThread: (threadId: Id<"threads">) => void;
}

export function AreaThreads({
  threads,
  currentDate,
  isLoading = false,
  onCreateThread,
  onRemoveThread,
}: AreaThreadsProps) {
  const groups = groupAreaThreadsByAttention(threads, currentDate);
  const flatThreads = [
    ...groups.dueNow,
    ...groups.upcoming,
    ...groups.withNextMoves,
    ...groups.open,
  ];
  const total = flatThreads.length;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Threads
          </h2>
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {total}
          </span>
        </div>
        <Button size="sm" onClick={onCreateThread}>
          <Plus data-icon="inline-start" />
          New Thread
        </Button>
      </div>

      {isLoading ? (
        <AreaThreadsSkeleton />
      ) : total === 0 ? (
        <AttentionEmpty>No open Threads in this Area yet.</AttentionEmpty>
      ) : (
        <AttentionList>
          {flatThreads.map((thread) => (
            <AreaThreadRow
              key={thread._id}
              thread={thread}
              now={currentDate}
              onRemoveThread={onRemoveThread}
            />
          ))}
        </AttentionList>
      )}
    </section>
  );
}

function AreaThreadRow({
  thread,
  now,
  onRemoveThread,
}: {
  thread: Doc<"threads">;
  now: number;
  onRemoveThread: (threadId: Id<"threads">) => void;
}) {
  const row: AttentionRowModel = {
    title: thread.title,
    detail: thread.nextMove?.trim() || undefined,
    detailKind: "next-move",
    when: thread.followUp,
    linkTo: { threadSlug: thread.slug ?? thread._id },
    actions: (
      <RowDeleteAction
        label="Delete thread"
        title="Delete thread?"
        description={`“${thread.title}” will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={() => onRemoveThread(thread._id)}
      />
    ),
  };

  return <AttentionRow now={now} row={row} />;
}
