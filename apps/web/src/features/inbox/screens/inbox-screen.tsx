import type { ProjectedTask } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { usePaginatedQuery } from "convex/react";
import { useState } from "react";

import { InboxTaskList } from "@/features/inbox/components/inbox-task-list";
import { ProcessTaskDialogContainer } from "@/features/tasks/process-task/process-task-dialog-container";

const DONE_PAGE_SIZE = 10;

// PROTOTYPE (issue #291): remove `embedded` — it drops the page-level layout
// (max-width centering, h1 header, bottom padding) so the screen can be mounted
// whole inside a summoned surface.
export function InboxScreen({ embedded = false }: { embedded?: boolean } = {}) {
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
    return <InboxSkeleton embedded={embedded} />;
  }

  return (
    <>
      <InboxTaskList
        embedded={embedded}
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

function InboxSkeleton({ embedded = false }: { embedded?: boolean }) {
  return (
    // PROTOTYPE (issue #291): revert to the plain `mx-auto max-w-3xl` wrapper.
    <div className={embedded ? "" : "mx-auto max-w-3xl"}>
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
