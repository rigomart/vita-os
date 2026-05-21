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
import { Button } from "@vita-os/ui/components/button";
import { ArrowRight, FolderOpen, Plus, Trash2 } from "lucide-react";

interface AreaThreadsProps {
  areaSlug: string;
  threads: Doc<"threads">[];
  onCreateThread: () => void;
  onRemoveThread: (threadId: Id<"threads">) => void;
}

export function AreaThreads({
  areaSlug,
  threads,
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

      {threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-10 text-center">
          <FolderOpen className="mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="mb-4 max-w-xs text-sm text-muted-foreground">
            No threads in this area yet.
          </p>
          <Button variant="outline" size="sm" onClick={onCreateThread}>
            Create thread
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
          {threads.map((thread) => (
            <AreaThreadRow
              key={thread._id}
              areaSlug={areaSlug}
              thread={thread}
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
  onRemoveThread,
}: {
  areaSlug: string;
  thread: Doc<"threads">;
  onRemoveThread: (threadId: Id<"threads">) => void;
}) {
  const slug = thread.slug ?? thread._id;

  return (
    <div className="group flex items-center first:rounded-t-xl last:rounded-b-xl">
      <Link
        to="/$areaSlug/$threadSlug"
        params={{ areaSlug, threadSlug: slug }}
        className="flex min-w-0 flex-1 items-start gap-4 px-4 py-4 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-surface-3/60"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{thread.title}</p>
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
