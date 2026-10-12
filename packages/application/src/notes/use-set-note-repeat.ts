import type { NoteId, Repeat } from "@vita-os/contracts";

import { browserTimeZone } from "../lib/time-zone";
import { useSetNoteRepeat as useSetNoteRepeatCommand } from "./hooks";

/** A Standalone Note's Repeat, set or (with `null`) cleared. */
export function useSetNoteRepeat() {
  const setRepeat = useSetNoteRepeatCommand();

  return (noteId: NoteId, repeat: Repeat | null) =>
    setRepeat.mutateAsync({ noteId, repeat, timeZone: browserTimeZone() });
}
