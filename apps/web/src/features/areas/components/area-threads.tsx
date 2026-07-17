import type { Doc, Id } from "@convex/_generated/dataModel";

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
import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react";

import { getThreadStatus } from "@/features/threads/derived-status";
import {
  flatListClassName,
  flatListRowHoverClassName,
} from "@/lib/flat-surface";

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
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-3">
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-medium">Threads</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={onCreateThread}
        >
          <Plus className="h-3.5 w-3.5" />
          New thread
        </Button>
      </div>

      {isLoading ? (
        <AreaThreadsSkeleton />
      ) : threads.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No threads in this area yet.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCreateThread}
            className="gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Create thread
          </Button>
        </div>
      ) : (
        <div className={flatListClassName}>
          {threads.map((thread) => (
            <AreaThreadRow
              key={thread._id}
              areaSlug={areaSlug}
              thread={thread}
              currentDate={currentDate}
              onRemoveThread={onRemoveThread}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AreaThreadRow({
  areaSlug,
  thread,
  currentDate,
  onRemoveThread,
}: {
  areaSlug: string;
  thread: Doc<"threads">;
  currentDate: number;
  onRemoveThread: (threadId: Id<"threads">) => void;
}) {
  const slug = thread.slug ?? thread._id;

  return (
    <div className="group flex items-center">
      <Link
        to="/$areaSlug/$threadSlug"
        params={{ areaSlug, threadSlug: slug }}
        className={cn(
          "flex min-w-0 flex-1 items-start gap-4 py-4",
          flatListRowHoverClassName,
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{thread.title}</p>
            <AreaThreadAttentionBadge
              thread={thread}
              currentDate={currentDate}
            />
          </div>
          <AreaThreadSubtitle thread={thread} />
        </div>
      </Link>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="mr-2 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Delete thread"
            />
          }
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
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
    </div>
  );
}

function AreaThreadAttentionBadge({
  thread,
  currentDate,
}: {
  thread: Doc<"threads">;
  currentDate: number;
}) {
  const status = getThreadStatus(thread, currentDate);

  if (status === "follow_up_due") {
    return (
      <Badge
        variant="outline"
        className="shrink-0 gap-1 border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400"
      >
        <CalendarClock className="h-3 w-3" />
        Follow-up due
      </Badge>
    );
  }

  if (status === "scheduled" && thread.followUp != null) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
        <CalendarClock className="h-3 w-3" />
        {format(new Date(thread.followUp), "MMM d")}
      </span>
    );
  }

  return null;
}

function AreaThreadSubtitle({ thread }: { thread: Doc<"threads"> }) {
  const nextAction = thread.nextMove;

  if (nextAction) {
    return (
      <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
        <ArrowRight className="h-3 w-3 shrink-0" />
        {nextAction}
      </p>
    );
  }

  return null;
}
