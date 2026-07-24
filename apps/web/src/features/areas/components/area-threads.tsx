import type { Doc, Id } from "@convex/_generated/dataModel";
import type { LucideIcon } from "lucide-react";

import { Link, useLocation } from "@tanstack/react-router";
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
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react";

import { compareThreadsByStatusUrgency } from "@/features/threads/derived-status";
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
  const { pathname } = useLocation();
  const isThreadOpen = pathname !== `/${areaSlug}`;
  const scheduled = threads
    .filter((thread) => thread.followUp != null)
    .sort((a, b) => (a.followUp ?? 0) - (b.followUp ?? 0));
  const undated = [...threads]
    .filter((thread) => thread.followUp == null)
    .sort((a, b) => compareThreadsByStatusUrgency(a, b, currentDate));

  return (
    <section>
      <SectionHeading
        icon={CalendarDays}
        title="Follow-up schedule"
        count={scheduled.length}
        action={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={onCreateThread}
          >
            <Plus className="size-3.5" />
            New Thread
          </Button>
        }
      />

      {isLoading ? (
        <div className="mt-3">
          <AreaThreadsSkeleton />
        </div>
      ) : scheduled.length === 0 ? (
        <p className="mt-3 py-6 text-sm text-muted-foreground">
          No Follow-ups scheduled in this Area.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-border/60 border-y border-border/70">
          {scheduled.map((thread) => (
            <ScheduledThreadRow
              key={thread._id}
              areaSlug={areaSlug}
              thread={thread}
              compact={isThreadOpen}
              onRemoveThread={onRemoveThread}
            />
          ))}
        </div>
      )}

      <section className="mt-8">
        <SectionHeading
          icon={FolderOpen}
          title="No Follow-up"
          count={undated.length}
        />
        {!isLoading && undated.length === 0 ? (
          <p className="mt-3 py-4 text-sm text-muted-foreground">
            Every open Thread has a Follow-up.
          </p>
        ) : (
          !isLoading && (
            <div className={cn("mt-3", flatListClassName)}>
              {undated.map((thread) => (
                <UndatedThreadRow
                  key={thread._id}
                  areaSlug={areaSlug}
                  thread={thread}
                  onRemoveThread={onRemoveThread}
                />
              ))}
            </div>
          )
        )}
      </section>
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
        <Icon className="size-3.5 text-muted-foreground" />
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
  compact,
  onRemoveThread,
}: {
  areaSlug: string;
  thread: Doc<"threads">;
  compact: boolean;
  onRemoveThread: (threadId: Id<"threads">) => void;
}) {
  const followUp = thread.followUp;
  if (!followUp) return null;

  return (
    <div className="group flex items-center rounded-md transition-colors hover:bg-muted/50">
      <Link
        to="/$areaSlug/$threadSlug"
        params={{ areaSlug, threadSlug: thread.slug ?? thread._id }}
        className={cn(
          "grid min-w-0 flex-1 items-center gap-4 px-2 py-3",
          compact
            ? "grid-cols-[3.5rem_minmax(0,1fr)]"
            : "grid-cols-[5rem_minmax(0,1fr)]",
        )}
      >
        <time
          dateTime={new Date(followUp).toISOString()}
          className="flex flex-col text-muted-foreground"
        >
          <span className="text-[10px] font-medium uppercase tracking-wider">
            {format(new Date(followUp), "MMM")}
          </span>
          <span className="text-lg font-semibold leading-none text-foreground">
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

  return (
    <p
      className={cn(
        "mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground",
        !nextMove && "text-muted-foreground/60",
      )}
    >
      <ArrowRight className="size-3 shrink-0" />
      <span className="truncate">{nextMove || "No next move"}</span>
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
