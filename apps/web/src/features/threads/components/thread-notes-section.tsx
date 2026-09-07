import type { Id } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { usePaginatedQuery, useMutation } from "convex/react";

import { ThreadNotes } from "./thread-notes";

const PAGE_SIZE = 20;

export function ThreadNotesSection({ threadId }: { threadId: Id<"threads"> }) {
  const notes = useQuery(api.threadNotes.list, { threadId });
  const {
    results: doneNotes,
    status: doneStatus,
    loadMore: loadMoreDone,
  } = usePaginatedQuery(
    api.threadNotes.listDone,
    { threadId },
    { initialNumItems: PAGE_SIZE },
  );
  const create = useMutation(api.threadNotes.create);
  const updateBody = useMutation(api.threadNotes.updateBody);
  const markDone = useMutation(api.threadNotes.markDone);
  const markOpen = useMutation(api.threadNotes.markOpen);
  const remove = useMutation(api.threadNotes.remove);

  return (
    <ThreadNotes
      notes={notes}
      doneNotes={doneNotes}
      isDoneExhausted={doneStatus === "Exhausted"}
      canLoadMoreDone={doneStatus === "CanLoadMore"}
      isLoadingMoreDone={doneStatus === "LoadingMore"}
      onLoadMoreDone={() => loadMoreDone(PAGE_SIZE)}
      onCreate={async (body) => {
        await create({ threadId, body });
      }}
      onUpdateBody={async (note, body) => {
        await updateBody({ id: note._id, body });
      }}
      onToggleDone={async (note) => {
        if (note.state === "done") await markOpen({ id: note._id });
        else await markDone({ id: note._id });
      }}
      onRemove={async (note) => {
        await remove({ id: note._id });
      }}
    />
  );
}
