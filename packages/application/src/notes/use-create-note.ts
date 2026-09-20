import { useCaptureNote } from "./hooks";

export type CreateNoteValue = {
  body: string;
  when?: number;
};

/**
 * Capture a Standalone Note.
 *
 * The shared application owns the command, its optimistic Inbox change, and the
 * Open Note count; this is the call shape the capture surfaces already use.
 */
export function useCreateNote() {
  const capture = useCaptureNote();

  return (value: CreateNoteValue) => capture.mutateAsync(value);
}
