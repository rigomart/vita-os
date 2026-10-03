import type { Note } from "@vita-os/contracts";

import { useAreas } from "../../areas/hooks";
import { filteredAreaId } from "../../dashboard/components/dashboard-filter-model";
import { useDashboardFilterParams } from "../../navigation/use-dashboard-filter-params";
import { NewThreadDialog } from "../../threads/new-thread/new-thread-dialog";
import { useCreateThreadFromNote } from "./hooks";
import { suggestThreadTitle } from "./thread-title";

/**
 * The New thread dialog, started from a Note: the title is suggested from the
 * Note's first line, and the Area follows the usual rule — the one the
 * Dashboard is filtered to. Saving creates the Thread with the Note as its
 * first Thread Note and its Follow-up date.
 */
export function NewThreadFromNoteDialog({
  note,
  onOpenChange,
  onCreated,
}: {
  note: Note;
  onOpenChange: (open: boolean) => void;
  onCreated: (slug: string) => void;
}) {
  const areas = useAreas().data;
  const areaId = filteredAreaId(useDashboardFilterParams(), areas ?? []);
  const createThread = useCreateThreadFromNote();

  return (
    <NewThreadDialog
      open
      onOpenChange={onOpenChange}
      defaultTitle={suggestThreadTitle(note.body)}
      defaultAreaId={areaId}
      onSubmit={async (value) => {
        const added = await createThread.mutateAsync({ note, ...value });
        onCreated(added.thread.slug);
      }}
    />
  );
}
