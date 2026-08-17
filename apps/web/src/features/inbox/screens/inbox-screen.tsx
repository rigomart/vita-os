import type { ProjectedTask } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { usePaginatedQuery } from "convex/react";
import { useState } from "react";

import { InboxTaskList } from "@/features/inbox/components/inbox-task-list";
import { ProcessTaskDialogContainer } from "@/features/tasks/process-task/process-task-dialog-container";

const DONE_PAGE_SIZE = 10;

export function InboxScreen() {
  const tasks = useQuery(api.tasks.list);
  const {
    results: doneTasks,
    status: doneStatus,
    loadMore: loadMoreDone,
  } = usePaginatedQuery(
    api.tasks.listDone,
    {},
    { initialNumItems: DONE_PAGE_SIZE },
  );
  const [processingTask, setProcessingTask] = useState<
    ProjectedTask | undefined
  >(undefined);

  if (tasks === undefined) {
    return <InboxSkeleton />;
  }

  return (
    <>
      <InboxTaskList
        tasks={tasks}
        onProcess={setProcessingTask}
        doneTasks={doneTasks}
        isDoneExhausted={doneStatus === "Exhausted"}
        canLoadMoreDone={doneStatus === "CanLoadMore"}
        isLoadingMoreDone={doneStatus === "LoadingMore"}
        onLoadMoreDone={() => loadMoreDone(DONE_PAGE_SIZE)}
      />

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
    <div>
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
