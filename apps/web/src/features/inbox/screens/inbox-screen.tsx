import type { Doc } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";

import { InboxTaskList } from "@/features/inbox/components/inbox-task-list";
import { ProcessTaskDialogContainer } from "@/features/tasks/process-task/process-task-dialog-container";

export function InboxScreen() {
  const tasks = useQuery(api.tasks.list);
  const [processingTask, setProcessingTask] = useState<
    Doc<"tasks"> | undefined
  >(undefined);

  if (tasks === undefined) {
    return <InboxSkeleton />;
  }

  return (
    <>
      <InboxTaskList tasks={tasks} onProcess={setProcessingTask} />

      {processingTask && (
        <ProcessTaskDialogContainer
          open={!!processingTask}
          onOpenChange={(open) => {
            if (!open) setProcessingTask(undefined);
          }}
          task={processingTask}
        />
      )}
    </>
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
