import { useCaptureNote } from "./hooks";

export type CreateNoteValue = {
  body: string;
  when?: number;
};

/**
 * Capture a Standalone Note.
 *
 * The shared application owns the command, the optimistic change to the Open
 * Notes, and their count; this is the call shape the capture surfaces already
 * use.
 */
export function useCreateNote() {
  const capture = useCaptureNote();

  return (value: CreateNoteValue) =>
    capture.mutateAsync({
      body: value.body,
      ...(value.when === undefined ? {} : { attentionDate: value.when }),
    });
}
