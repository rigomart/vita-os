import type { ProjectedThreadNote } from "@convex/lib/validators";

import { Button } from "@vita-os/ui/components/button";
import { Textarea } from "@vita-os/ui/components/textarea";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { cn } from "@vita-os/ui/lib/utils";
import { format, isThisYear } from "date-fns";
import { Check, Loader2, Undo2 } from "lucide-react";
import { useState } from "react";

import { EditableField } from "@/components/ui/editable-field";
import { AttentionCollapsed, RowDeleteAction } from "@/features/attention-list";

interface ThreadNotesProps {
  notes: ProjectedThreadNote[] | undefined;
  doneNotes?: ProjectedThreadNote[];
  isDoneExhausted?: boolean;
  canLoadMoreDone?: boolean;
  isLoadingMoreDone?: boolean;
  onLoadMoreDone?: () => void;
  onCreate: (body: string) => Promise<void> | void;
  onUpdateBody: (
    note: ProjectedThreadNote,
    body: string,
  ) => Promise<void> | void;
  onToggleDone: (note: ProjectedThreadNote) => Promise<void> | void;
  onRemove: (note: ProjectedThreadNote) => Promise<void> | void;
}

export function ThreadNotes({
  notes,
  doneNotes = [],
  isDoneExhausted = true,
  canLoadMoreDone = false,
  isLoadingMoreDone = false,
  onLoadMoreDone,
  onCreate,
  onUpdateBody,
  onToggleDone,
  onRemove,
}: ThreadNotesProps) {
  const showCompleted = doneNotes.length > 0 || !isDoneExhausted;

  return (
    <section aria-label="Thread Notes" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Notes
        </h2>
        {notes && notes.length > 0 && (
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {notes.length}
          </span>
        )}
        <span aria-hidden className="ml-1 h-px flex-1 bg-border/50" />
      </div>

      <ThreadNoteComposer onCreate={onCreate} />

      {notes === undefined ? (
        <p className="text-sm text-muted-foreground">Loading Notes…</p>
      ) : notes.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          No open Notes on this Thread.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {notes.map((note) => (
            <ThreadNoteCard
              key={note._id}
              note={note}
              onUpdateBody={onUpdateBody}
              onToggleDone={onToggleDone}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}

      {showCompleted && (
        <AttentionCollapsed title="Completed" count={doneNotes.length}>
          <div className="flex flex-col gap-2.5 pt-1">
            {doneNotes.map((note) => (
              <ThreadNoteCard
                key={note._id}
                note={note}
                onUpdateBody={onUpdateBody}
                onToggleDone={onToggleDone}
                onRemove={onRemove}
              />
            ))}
          </div>
          {(canLoadMoreDone || isLoadingMoreDone) && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isLoadingMoreDone}
                aria-busy={isLoadingMoreDone || undefined}
                onClick={onLoadMoreDone}
              >
                {isLoadingMoreDone ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </AttentionCollapsed>
      )}
    </section>
  );
}

function ThreadNoteComposer({
  onCreate,
}: {
  onCreate: (body: string) => Promise<void> | void;
}) {
  const [body, setBody] = useState("");
  const { run: createNote, isPending } = useGuardedAsyncAction(onCreate, {
    successMessage: "Note added",
    errorToast: true,
  });

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed || isPending) return;
    const result = await createNote(trimmed);
    if (result.ok) setBody("");
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="rounded-3xl border-2 border-border/70 bg-surface-2 p-3 transition-colors focus-within:border-ring/50"
    >
      <Textarea
        variant="inline"
        aria-label="New Thread Note"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add a note to this Thread…"
        rows={2}
        disabled={isPending}
        className="min-h-16 py-1 text-sm leading-relaxed caret-ring disabled:opacity-100"
      />
      <div className="mt-2 flex justify-end">
        <Button
          type="submit"
          size="sm"
          className="rounded-full px-4"
          disabled={!body.trim() || isPending}
          aria-busy={isPending}
        >
          Add note
        </Button>
      </div>
    </form>
  );
}

function ThreadNoteCard({
  note,
  onUpdateBody,
  onToggleDone,
  onRemove,
}: {
  note: ProjectedThreadNote;
  onUpdateBody: (
    note: ProjectedThreadNote,
    body: string,
  ) => Promise<void> | void;
  onToggleDone: (note: ProjectedThreadNote) => Promise<void> | void;
  onRemove: (note: ProjectedThreadNote) => Promise<void> | void;
}) {
  const done = note.state === "done";
  const { run: updateBody, isPending: isSaving } = useGuardedAsyncAction(
    (body: string) => onUpdateBody(note, body),
    { errorToast: true },
  );
  const { run: toggleDone, isPending: isToggling } = useGuardedAsyncAction(
    () => onToggleDone(note),
    { errorToast: true },
  );
  const { run: remove, isPending: isRemoving } = useGuardedAsyncAction(
    () => onRemove(note),
    { successMessage: "Note deleted", errorToast: true },
  );

  return (
    <article
      className={cn(
        "group/card flex flex-col rounded-3xl border-2 border-border/70 bg-surface-2 p-4",
        "transition-colors hover:border-border has-focus-visible:border-ring/50",
        done && "border-border/40 bg-transparent opacity-70",
      )}
    >
      <EditableField
        value={note.body}
        variant="textarea"
        onSave={(body) => {
          if (body && !isSaving) void updateBody(body);
        }}
        disabled={isSaving}
        inputAriaLabel="Edit note body"
        editOnFocus
        textareaRows={1}
        chromeless
        className={cn(
          "min-h-0 py-0 text-left text-sm leading-relaxed whitespace-pre-wrap wrap-anywhere caret-ring",
          done && "text-muted-foreground/60",
        )}
      />

      <div className="mt-3 flex items-center gap-1">
        <ThreadNoteTimestamp note={note} />
        <span className="ml-auto opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-within/card:opacity-100">
          <RowDeleteAction
            label="Delete note"
            title="Delete note?"
            description="This note will be permanently removed from this Thread. This action cannot be undone."
            confirmLabel="Delete"
            busy={isRemoving}
            onConfirm={() => {
              void remove();
            }}
          />
        </span>
        <Button
          variant="secondary"
          size="icon-sm"
          className={cn(
            "group/toggle shrink-0 rounded-full",
            done && "bg-transparent text-brand-accent-foreground",
          )}
          disabled={isToggling}
          aria-busy={isToggling}
          aria-label={done ? "Mark note open" : "Mark note done"}
          onClick={() => {
            void toggleDone();
          }}
        >
          {done ? (
            <>
              <Check className="group-hover/toggle:hidden" />
              <Undo2 className="hidden group-hover/toggle:block" />
            </>
          ) : (
            <Check />
          )}
        </Button>
      </div>
    </article>
  );
}

function ThreadNoteTimestamp({ note }: { note: ProjectedThreadNote }) {
  const stamp =
    note.state === "done" && note.completedAt !== undefined
      ? note.completedAt
      : note.updatedAt;
  const prefix =
    note.state === "done"
      ? "Done"
      : note.updatedAt > note.createdAt
        ? "Edited"
        : "Added";
  const date = new Date(stamp);

  return (
    <time
      dateTime={date.toISOString()}
      title={format(date, "PPpp")}
      className="pr-1 text-2xs text-muted-foreground/60"
    >
      {prefix} {format(date, isThisYear(date) ? "MMM d" : "MMM d, yyyy")}
    </time>
  );
}
