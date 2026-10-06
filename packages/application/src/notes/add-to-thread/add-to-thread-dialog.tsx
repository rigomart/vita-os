import type { Note, TaskId, Thread } from "@vita-os/contracts";

import { decideAddNoteToThread, soonestTaskDate } from "@vita-os/core";
import { format } from "date-fns";
import { MessageSquare } from "lucide-react";
import { useMemo } from "react";

import { useAreas } from "../../areas/hooks";
import { withTimeToken } from "../../attention-list/date-parts";
import { useOpenThreads } from "../../threads/hooks";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../ui/command";

/**
 * The date adding this Note would bring the Thread back at, if it changes: a
 * dated Note adds a dated Task, and the Thread comes back at its soonest.
 */
export function broughtBackAt(thread: Thread, note: Note): number | undefined {
  const tasks = decideAddNoteToThread(thread, note, "preview" as TaskId).patch
    .tasks;
  const after = soonestTaskDate(tasks);
  return after === soonestTaskDate(thread.tasks) ? undefined : after;
}

/**
 * Choose the Open Thread a Note joins. Rows read as the palette's Threads do —
 * title and Area — and a row whose Thread would come back earlier says so
 * before the person chooses it.
 */
export function AddToThreadDialog({
  note,
  onOpenChange,
  onChoose,
}: {
  note: Note;
  onOpenChange: (open: boolean) => void;
  onChoose: (thread: Thread) => void;
}) {
  const threads = useOpenThreads().data;
  const areas = useAreas().data;
  const areaById = useMemo(
    () => new Map((areas ?? []).map((area) => [area._id, area])),
    [areas],
  );

  return (
    <CommandDialog
      open
      onOpenChange={onOpenChange}
      title="Add to thread"
      description="Choose the open thread this note belongs to"
      showCloseButton={false}
      className="top-[15%] translate-y-0"
    >
      <CommandInput placeholder="Add to thread…" />
      <CommandList>
        <CommandEmpty>
          {threads === undefined ? "Loading threads…" : "No open threads."}
        </CommandEmpty>
        <CommandGroup heading="Threads">
          {(threads ?? []).map((thread) => {
            const area =
              thread.areaId === undefined
                ? undefined
                : areaById.get(thread.areaId);
            const when = broughtBackAt(thread, note);
            return (
              <CommandItem
                key={thread._id}
                value={`thread-${thread._id}`}
                keywords={area ? [thread.title, area.name] : [thread.title]}
                onSelect={() => onChoose(thread)}
              >
                <MessageSquare />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{thread.title}</span>
                  {when === undefined ? null : (
                    <span className="truncate text-xs text-brand-accent-text">
                      Brings this thread back{" "}
                      {withTimeToken(format(when, "EEE MMM d"), when)}
                    </span>
                  )}
                </span>
                {area && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {area.name}
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
