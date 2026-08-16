import { CircleCheck } from "lucide-react";

/**
 * What stands in for the attention bar once a Thread is resolved: no controls
 * to act on, just a plain statement of where the Thread now lives.
 */
export function ThreadResolvedNote() {
  return (
    <p
      data-slot="thread-resolved-note"
      className="flex min-h-9 shrink-0 items-center gap-2 text-sm text-muted-foreground"
    >
      <CircleCheck
        aria-hidden
        className="size-3.5 shrink-0 text-condition-healthy"
      />
      No next move or follow-up while resolved — the log below is the record.
    </p>
  );
}
