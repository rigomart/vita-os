import { Skeleton } from "@vita-os/ui/components/skeleton";

import { useDoneNotes, useOpenNotes } from "../../notes/hooks";
import { InboxNoteList } from "../components/inbox-note-list";

const DONE_PAGE_SIZE = 10;

export function InboxScreen() {
  const notes = useOpenNotes().data;
  const done = useDoneNotes(DONE_PAGE_SIZE);

  if (notes === undefined) {
    return <InboxSkeleton />;
  }

  return (
    <>
      <InboxNoteList
        notes={notes}
        doneNotes={done.notes}
        isDoneExhausted={!done.hasNextPage && !done.isPending}
        isDoneInitialLoading={done.isPending}
        canLoadMoreDone={done.hasNextPage && !done.isFetchingNextPage}
        isLoadingMoreDone={done.isFetchingNextPage}
        onLoadMoreDone={() => void done.fetchNextPage()}
      />
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
