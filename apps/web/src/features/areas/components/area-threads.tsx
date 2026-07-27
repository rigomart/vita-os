import type { Doc, Id } from "@convex/_generated/dataModel";
import type { LucideIcon } from "lucide-react";

import { groupAreaThreadsByAttention } from "@convex/lib/attentionOrdering";
import { Link } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@vita-os/ui/components/alert-dialog";
import { Button } from "@vita-os/ui/components/button";
import { cn } from "@vita-os/ui/lib/utils";
import { format, isBefore, startOfDay } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react";

import { BrandHexagon } from "@/components/ui/brand-hexagon";
import { flatListClassName } from "@/lib/flat-surface";

import { AreaThreadsSkeleton } from "./area-threads-skeleton";

interface AreaThreadsProps {
  areaSlug: string;
  threads: Doc<"threads">[];
  currentDate: number;
  isLoading?: boolean;
  onCreateThread: () => void;
  onRemoveThread: (threadId: Id<"threads">) => void;
}

export function AreaThreads({
  areaSlug,
  threads,
  currentDate,
  isLoading = false,
  onCreateThread,
  onRemoveThread,
}: AreaThreadsProps) {
  const groups = groupAreaThreadsByAttention(threads, currentDate);
  const scheduledCount = groups.dueNow.length + groups.upcoming.length;
  const undatedCount = groups.withNextMoves.length + groups.open.length;

  return (
    <section>
      <SectionHeading
        icon={CalendarDays}
        title="Follow-up schedule"
        count={scheduledCount}
        action={
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1.5 pr-3 pl-2 text-xs shadow-sm"
            onClick={onCreateThread}
          >
            <Plus data-icon="inline-start" />
            New Thread
          </Button>
        }
      />

      {isLoading ? (
        <div className="mt-3">
          <AreaThreadsSkeleton />
        </div>
      ) : scheduledCount === 0 ? (
        <p className="mt-3 py-6 text-sm text-muted-foreground">
          No Follow-ups scheduled in this Area.
        </p>
      ) : (
        <div className="mt-3">
          {groups.dueNow.length > 0 && (
            <ThreadSubgroup title="Overdue & today">
              {groups.dueNow.map((thread) => (
                <ScheduledThreadRow
                  key={thread._id}
                  areaSlug={areaSlug}
                  thread={thread}
                  onRemoveThread={onRemoveThread}
                  currentDate={currentDate}
                />
              ))}
            </ThreadSubgroup>
          )}
          {groups.upcoming.length > 0 && (
            <ThreadSubgroup
              title="Upcoming"
              separated={groups.dueNow.length > 0}
            >
              {groups.upcoming.map((thread) => (
                <ScheduledThreadRow
                  key={thread._id}
                  areaSlug={areaSlug}
                  thread={thread}
                  onRemoveThread={onRemoveThread}
                  currentDate={currentDate}
                />
              ))}
            </ThreadSubgroup>
          )}
        </div>
      )}

      <section className="mt-8 border-t border-border/50 pt-6">
        <SectionHeading
          icon={FolderOpen}
          title="No Follow-up"
          count={undatedCount}
        />
        {!isLoading && undatedCount === 0 ? (
          <p className="mt-3 py-4 text-sm text-muted-foreground">
            Every open Thread has a Follow-up.
          </p>
        ) : (
          !isLoading && (
            <div className="mt-3">
              {groups.withNextMoves.length > 0 && (
                <ThreadSubgroup title="Threads with Next Moves">
                  {groups.withNextMoves.map((thread) => (
                    <UndatedThreadRow
                      key={thread._id}
                      areaSlug={areaSlug}
                      thread={thread}
                      onRemoveThread={onRemoveThread}
                    />
                  ))}
                </ThreadSubgroup>
              )}
              {groups.open.length > 0 && (
                <ThreadSubgroup
                  title="Open Threads"
                  separated={groups.withNextMoves.length > 0}
                >
                  {groups.open.map((thread) => (
                    <UndatedThreadRow
                      key={thread._id}
                      areaSlug={areaSlug}
                      thread={thread}
                      onRemoveThread={onRemoveThread}
                    />
                  ))}
                </ThreadSubgroup>
              )}
            </div>
          )
        )}
      </section>
    </section>
  );
}

function ThreadSubgroup({
  title,
  separated = false,
  children,
}: {
  title: string;
  separated?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(separated && "mt-5 border-t border-border/50 pt-4")}>
      <h3 className="px-2 text-[11px] font-medium tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className={cn("mt-1", flatListClassName)}>{children}</div>
    </section>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  count,
  action,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <BrandHexagon className="size-6 bg-brand-gold/28 text-brand-accent-foreground">
          <Icon className="size-3.5" />
        </BrandHexagon>
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      {action}
    </div>
  );
}

function ScheduledThreadRow({
  areaSlug,
  thread,
  onRemoveThread,
  currentDate,
}: {
  areaSlug: string;
  thread: Doc<"threads">;
  onRemoveThread: (threadId: Id<"threads">) => void;
  currentDate: number;
}) {
  const followUp = thread.followUp;
  if (!followUp) return null;
  const isOverdue = isBefore(
    startOfDay(new Date(followUp)),
    startOfDay(new Date(currentDate)),
  );

  return (
    <div className="group flex items-center rounded-md transition-colors hover:bg-muted/50">
      <Link
        to="/$areaSlug/$threadSlug"
        params={{ areaSlug, threadSlug: thread.slug ?? thread._id }}
        className={cn(
          "grid min-w-0 flex-1 items-center gap-4 px-2 py-3",
          "grid-cols-[3.5rem_minmax(0,1fr)]",
        )}
      >
        <time
          dateTime={new Date(followUp).toISOString()}
          className={cn(
            "flex flex-col text-brand-accent-foreground",
            isOverdue && "text-destructive",
          )}
        >
          <span className="text-[10px] font-medium uppercase tracking-wider">
            {format(new Date(followUp), "MMM")}
          </span>
          <span
            className={cn(
              "text-lg font-semibold leading-none text-foreground",
              isOverdue && "text-destructive",
            )}
          >
            {format(new Date(followUp), "d")}
          </span>
        </time>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{thread.title}</h3>
          <ThreadNextMove thread={thread} />
        </div>
      </Link>
      <ThreadDeleteAction thread={thread} onRemoveThread={onRemoveThread} />
    </div>
  );
}

function UndatedThreadRow({
  areaSlug,
  thread,
  onRemoveThread,
}: {
  areaSlug: string;
  thread: Doc<"threads">;
  onRemoveThread: (threadId: Id<"threads">) => void;
}) {
  return (
    <div className="group flex items-center rounded-md transition-colors hover:bg-muted/50">
      <Link
        to="/$areaSlug/$threadSlug"
        params={{ areaSlug, threadSlug: thread.slug ?? thread._id }}
        className="min-w-0 flex-1 px-2 py-3"
      >
        <h3 className="truncate text-sm font-medium">{thread.title}</h3>
        <ThreadNextMove thread={thread} />
      </Link>
      <ThreadDeleteAction thread={thread} onRemoveThread={onRemoveThread} />
    </div>
  );
}

function ThreadNextMove({ thread }: { thread: Doc<"threads"> }) {
  const nextMove = thread.nextMove?.trim();

  if (!nextMove) return null;

  return (
    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <ArrowRight className="size-3 shrink-0" />
      <span className="truncate">{nextMove}</span>
    </p>
  );
}

function ThreadDeleteAction({
  thread,
  onRemoveThread,
}: {
  thread: Doc<"threads">;
  onRemoveThread: (threadId: Id<"threads">) => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="mr-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="Delete thread"
          />
        }
      >
        <Trash2 className="size-3.5 text-muted-foreground" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete thread?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{thread.title}&rdquo; will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onRemoveThread(thread._id)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
