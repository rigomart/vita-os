import type { Doc } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { ChevronRight, Inbox } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ProcessTaskDialogContainer } from "@/features/tasks/process-task/process-task-dialog-container";
import { TaskRowContainer } from "@/features/tasks/task-row/task-row-container";

export function InboxScreen() {
  const tasks = useQuery(api.tasks.list);
  const [processingTask, setProcessingTask] = useState<
    Doc<"tasks"> | undefined
  >(undefined);

  if (tasks === undefined) {
    return <InboxSkeleton />;
  }

  const openTasks = tasks.filter((task) => task.state === "open");
  const doneTasks = tasks.filter((task) => task.state === "done");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Inbox" />
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Inbox zero — nothing to process
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {openTasks.length > 0 && (
            <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
              {openTasks.map((task) => (
                <TaskRowContainer
                  key={task._id}
                  task={task}
                  onProcess={setProcessingTask}
                />
              ))}
            </div>
          )}

          {doneTasks.length > 0 && (
            <Collapsible>
              <div className="rounded-xl border border-border-subtle bg-surface-2">
                <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground">
                  <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                  <span>Done</span>
                  <span className="ml-auto text-xs tabular-nums">
                    {doneTasks.length}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="divide-y divide-border/50 border-t border-border/50">
                    {doneTasks.map((task) => (
                      <TaskRowContainer key={task._id} task={task} />
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}
        </div>
      )}

      {processingTask && (
        <ProcessTaskDialogContainer
          open={!!processingTask}
          onOpenChange={(open) => {
            if (!open) setProcessingTask(undefined);
          }}
          task={processingTask}
        />
      )}
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b py-3 last:border-b-0">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-1.5 h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
