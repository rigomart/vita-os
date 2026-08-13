// PROTOTYPE(thread-view) — throwaway.
// Variant E "Journal dock": a fully-visible header block (area, state, title,
// definition) over a slim always-on attention line, then the Activity Log owns
// the rest of the pane and the note composer is docked at the bottom.
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";

import { conditionLabels } from "@convex/lib/condition";
import { Button } from "@vita-os/ui/components/button";
import { DatePicker } from "@vita-os/ui/components/date-picker";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import {
  ArrowRight,
  ArrowUp,
  Check,
  CircleCheck,
  CircleDashed,
  Loader2,
  X,
} from "lucide-react";
import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";

import { EditableField } from "@/components/ui/editable-field";
import { whenTone } from "@/features/attention-list/date-parts";
import { ThreadAreaSectionSection } from "@/features/threads/components/thread-area-section-section";
import { ThreadDefinitionSection } from "@/features/threads/components/thread-definition-section";
import { ThreadHeaderSection } from "@/features/threads/components/thread-header-section";
import {
  ActivityLogTimeline,
  RAIL_LEFT,
} from "@/features/threads/components/thread-log";
import { useCompleteNextMove } from "@/features/threads/use-complete-next-move";
import { useUpdateThread } from "@/features/threads/use-update-thread";
import { cn } from "@/lib/utils";

import type { ThreadVariantProps } from "./prototype-gate";

import { useThreadActivity } from "./use-thread-activity";

const CONDITION_DOT: Record<ProjectedArea["condition"], string> = {
  healthy: "bg-condition-healthy-fill",
  needs_attention: "bg-condition-attention-fill",
  critical: "bg-condition-critical-fill",
};

export function VariantE({ thread, area }: ThreadVariantProps) {
  const { logs, canLoadMore, isLoadingMore, loadMore, addNote } =
    useThreadActivity(thread._id);
  const logRef = useRef<HTMLDivElement>(null);
  const isResolved = thread.state === "resolved";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Everything about the Thread is readable here — nothing is folded
          away behind a disclosure; interaction is only ever for editing. */}
      <header
        role="banner"
        aria-label="Thread header"
        className="flex shrink-0 flex-col gap-3"
      >
        <div className="flex items-center gap-2 pr-24">
          <span
            aria-hidden
            title={conditionLabels[area.condition]}
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              CONDITION_DOT[area.condition],
            )}
          />
          <ThreadAreaSectionSection thread={thread} area={area} />
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 text-[11px]",
              isResolved ? "text-condition-healthy" : "text-muted-foreground",
            )}
          >
            {isResolved ? (
              <CircleCheck aria-hidden className="size-3" />
            ) : (
              <CircleDashed aria-hidden className="size-3" />
            )}
            {isResolved ? "Resolved" : "Open"}
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <ThreadHeaderSection thread={thread} areaSlug={area.slug} />
          <ThreadDefinitionSection thread={thread} />
        </div>
      </header>

      {isResolved ? (
        <p className="flex min-h-8 shrink-0 items-center gap-2 text-[13px] text-muted-foreground">
          <CircleCheck
            aria-hidden
            className="size-3.5 shrink-0 text-condition-healthy"
          />
          No next move or follow-up while resolved — the log below is the
          record.
        </p>
      ) : (
        <AttentionLine thread={thread} />
      )}

      <section
        aria-label="Activity log"
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="mb-2 flex shrink-0 items-center gap-2">
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            Log
          </h2>
          {logs && logs.length > 0 && (
            <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {logs.length}
            </span>
          )}
          <span aria-hidden className="ml-1 h-px flex-1 bg-border/50" />
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground/60 uppercase">
            Newest first
          </span>
        </div>

        {/* The only scroll region in the pane. */}
        <div
          ref={logRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="relative pb-6">
            <div
              aria-hidden
              className={cn(
                "absolute top-1 bottom-0 w-px",
                RAIL_LEFT,
                "bg-gradient-to-b from-transparent via-border to-transparent",
              )}
            />
            <ActivityLogTimeline
              logs={logs}
              canLoadMore={canLoadMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={loadMore}
            />
          </div>
        </div>
      </section>

      <NoteDock
        onAddNote={addNote}
        onPosted={() =>
          logRef.current?.scrollTo({ top: 0, behavior: "smooth" })
        }
        placeholder={
          isResolved ? "Add a closing note…" : "Write what happened…"
        }
      />
    </div>
  );
}

/**
 * One quiet line: the next move (with its complete affordance) and the
 * follow-up date. Both are legible without touching anything.
 */
function AttentionLine({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);
  const completeNextMove = useCompleteNextMove(thread);

  const { run: setNextMove, isPending: isSaving } = useGuardedAsyncAction(
    async (text: string | null) => {
      await updateThread({ id: thread._id, nextMove: text });
    },
    { errorToast: true },
  );
  const { run: complete, isPending: isCompleting } = useGuardedAsyncAction(
    async () => {
      await completeNextMove();
    },
    { errorToast: true },
  );

  const nextMove = thread.nextMove;

  return (
    <div className="group/next flex min-h-8 shrink-0 items-center gap-2">
      <ArrowRight
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground/70"
      />

      {nextMove ? (
        <>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => void complete()}
            disabled={isCompleting}
            aria-busy={isCompleting || undefined}
            aria-label="Complete next move"
            className="rounded-full border border-condition-healthy/40 text-condition-healthy hover:bg-condition-healthy/10 hover:text-condition-healthy"
          >
            <Check />
          </Button>
          {/* EditableField fills its parent, so the line constrains it. */}
          <span className="min-w-0 flex-1">
            <EditableField
              value={nextMove}
              onSave={(text) => {
                if (!text || isSaving) return;
                void setNextMove(text);
              }}
              disabled={isSaving}
              inputAriaLabel="Next move"
              className="min-h-0 py-0 text-[13px] font-medium"
              displayClassName="block truncate border-transparent text-left"
            />
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => void setNextMove(null)}
            disabled={isSaving}
            aria-label="Clear next move"
            className="shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover/next:opacity-100 group-focus-within/next:opacity-100"
          >
            <X />
          </Button>
        </>
      ) : (
        <NextMoveInput
          disabled={isSaving}
          onCommit={(text) => void setNextMove(text)}
        />
      )}

      <span aria-hidden className="h-3.5 w-px shrink-0 bg-border/60" />
      <FollowUpChip thread={thread} />
    </div>
  );
}

function NextMoveInput({
  disabled,
  onCommit,
}: {
  disabled: boolean;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const text = draft.trim();
    if (!text || disabled) return;
    setDraft("");
    onCommit(text);
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
      disabled={disabled}
      aria-label="Next move"
      placeholder="Set the next move…"
      className="min-w-0 flex-1 rounded bg-transparent px-1 py-1 text-[13px] outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-ring"
    />
  );
}

function FollowUpChip({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);
  const { run: saveFollowUp, isPending } = useGuardedAsyncAction(
    async (followUp: number | null) => {
      await updateThread({ id: thread._id, followUp });
    },
    { errorToast: true },
  );

  const tone = whenTone(thread.followUp, Date.now());
  const value =
    thread.followUp === undefined ? undefined : new Date(thread.followUp);

  return (
    <DatePicker
      value={value}
      onChange={(date) => void saveFollowUp(date ? date.getTime() : null)}
      placeholder="Follow-up…"
      disabled={isPending}
      className={cn(
        "shrink-0",
        tone === "overdue" && "[&_button]:text-condition-critical",
        tone === "due" && "[&_button]:text-condition-attention",
      )}
    />
  );
}

/** Docked composer: notes are the primary act, so this is the loudest thing. */
function NoteDock({
  onAddNote,
  onPosted,
  placeholder,
}: {
  onAddNote: (content: string) => Promise<void>;
  onPosted: () => void;
  placeholder: string;
}) {
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
      onPosted();
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
    <form
      onSubmit={handleSubmit}
      aria-label="Add a note"
      className="shrink-0 border-t border-border/50 pt-3"
    >
      <InputGroup
        data-disabled={isPending || undefined}
        className="shadow-sm transition-shadow focus-within:shadow-md"
      >
        <InputGroupTextarea
          id="journal-dock-note"
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          rows={1}
          placeholder={placeholder}
          aria-label="Activity log note"
          className="max-h-40 min-h-11 px-4 pt-3 pb-1 text-[13px] leading-relaxed"
        />
        <InputGroupAddon
          align="block-end"
          className="items-center justify-between gap-2 px-3 pt-0 pb-2.5"
        >
          <span className="min-w-0 truncate text-[10px] text-muted-foreground/70">
            {noteText
              ? "Enter to save · Shift+Enter for a new line"
              : "Notes are this Thread's record"}
          </span>
          <InputGroupButton
            type="submit"
            size="icon-sm"
            variant="ghost"
            disabled={!noteText.trim() || isPending}
            aria-label="Add note"
            aria-busy={isPending || undefined}
            className="rounded-full bg-brand-gold text-brand-ink hover:bg-brand-gold-strong hover:text-brand-ink"
          >
            {isPending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
