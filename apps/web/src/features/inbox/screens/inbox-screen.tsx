import { api } from "@convex/_generated/api";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { usePaginatedQuery } from "convex/react";

import { InboxNoteList } from "@/features/inbox/components/inbox-note-list";
// PROTOTYPE — throwaway; delete this import and the ../prototype folder together.
import { InboxPrototype } from "@/features/inbox/prototype/inbox-prototype";

const DONE_PAGE_SIZE = 10;

export function InboxScreen() {
  const notes = useQuery(api.notes.list);
  const {
    results: doneNotes,
    status: doneStatus,
    loadMore: loadMoreDone,
  } = usePaginatedQuery(
    api.notes.listDone,
    {},
    { initialNumItems: DONE_PAGE_SIZE },
  );

  if (notes === undefined) {
    return <InboxSkeleton />;
  }

  const list = (
    <InboxNoteList
      notes={notes}
      doneNotes={doneNotes}
      isDoneExhausted={doneStatus === "Exhausted"}
      canLoadMoreDone={doneStatus === "CanLoadMore"}
      isLoadingMoreDone={doneStatus === "LoadingMore"}
      onLoadMoreDone={() => loadMoreDone(DONE_PAGE_SIZE)}
    />
  );

  // PROTOTYPE — throwaway. Statically false in production, so the whole
  // prototype tree is eliminated from the bundle.
  if (import.meta.env.DEV) {
    return (
      <InboxPrototype notes={notes} doneNotes={doneNotes} current={list} />
    );
  }

  return list;
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
