import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { ArrowUp } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";

interface ActivityLogComposerProps {
  onAddNote: (text: string) => Promise<void> | void;
  /** Fired after a note lands, so the log can bring the new entry into view. */
  onPosted?: () => void;
}

/**
 * Pinned to the floor of the Thread pane: writing a note is the pane's primary
 * act, so the bar never scrolls away — the timeline scrolls out from under it.
 */
export function ActivityLogComposer({
  onAddNote,
  onPosted,
}: ActivityLogComposerProps) {
  const [noteText, setNoteText] = useState("");
  const { run: addNote, isPending } = useGuardedAsyncAction(onAddNote, {
    errorToast: true,
  });

  const submitNote = async () => {
    const text = noteText.trim();
    if (!text || isPending) return;

    const result = await addNote(text);
    if (result.ok) {
      setNoteText("");
      onPosted?.();
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitNote();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitNote();
    }
  };

  return (
    <div data-slot="activity-log-composer" className="relative shrink-0 pt-2">
      {/* Fade the scrolled timeline out from under the bar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-4 h-6 bg-gradient-to-t from-popover to-transparent"
      />
      <form onSubmit={handleSubmit}>
        <label htmlFor="activity-log-note" className="sr-only">
          Activity log note
        </label>
        <InputGroup
          className="bg-muted/50 has-[textarea]:rounded-3xl has-data-[align=block-end]:rounded-3xl"
          data-disabled={isPending || undefined}
        >
          <InputGroupTextarea
            id="activity-log-note"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isPending}
            aria-label="Activity log note"
            placeholder="Log what just happened…"
            rows={1}
            className="min-h-10 py-2.5 pr-11 pl-4 text-sm"
          />
          <InputGroupAddon
            align="block-end"
            className="absolute right-2 bottom-2 w-auto p-0"
          >
            <InputGroupButton
              type="submit"
              size="icon-xs"
              variant="secondary"
              disabled={!noteText.trim() || isPending}
              aria-label="Add note"
              aria-busy={isPending}
            >
              <ArrowUp data-icon="inline-start" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}
