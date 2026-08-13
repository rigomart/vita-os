// PROTOTYPE(thread-view) — throwaway.
import type { ProjectedThread } from "@convex/lib/validators";
import type { ReactNode } from "react";

import { conditionLabels } from "@convex/lib/condition";
import { Button } from "@vita-os/ui/components/button";
import { DatePicker } from "@vita-os/ui/components/date-picker";
import { Textarea } from "@vita-os/ui/components/textarea";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
  ArrowUp,
  Check,
  CircleCheck,
  CircleDashed,
  History,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { EditableField } from "@/components/ui/editable-field";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { ThreadAreaSectionSection } from "@/features/threads/components/thread-area-section-section";
import { ThreadHeaderSection } from "@/features/threads/components/thread-header-section";
import {
  ActivityLogTimeline,
  ENTRY_PAD,
  NODE_LEFT,
  RAIL_LEFT,
} from "@/features/threads/components/thread-log";
import { useCompleteNextMove } from "@/features/threads/use-complete-next-move";
import { useUpdateThread } from "@/features/threads/use-update-thread";
import { cn } from "@/lib/utils";

import type { ThreadVariantProps } from "./prototype-gate";

import { useThreadActivity } from "./use-thread-activity";

/** Small-caps label, same recipe as the Activity log's day markers. */
const LABEL_CLASS =
  "text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase";

export function VariantD({ thread, area }: ThreadVariantProps) {
  const { logs, canLoadMore, isLoadingMore, loadMore, addNote } =
    useThreadActivity(thread._id);
  const isResolved = thread.state === "resolved";
  const ConditionIcon = conditionIcons[area.condition];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* One scroll region: identity, ledger and timeline. The note dock is
          pinned below it, on the app's bar chrome (a hairline + surface). */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <header aria-label="Thread identity" className="pb-3">
          <div className="pr-24">
            <ThreadHeaderSection thread={thread} areaSlug={area.slug} />
          </div>
          {/* Full definition, always readable — no clamp, no disclosure. */}
          <DefinitionCell thread={thread} />
        </header>

        <dl
          aria-label="Thread properties"
          className="divide-y divide-border/50 border-y border-border/50"
        >
          <LedgerRow label="State">
            {isResolved ? (
              <span className="flex items-center gap-1.5 text-condition-healthy">
                <CircleCheck aria-hidden className="size-3.5" />
                Resolved
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CircleDashed
                  aria-hidden
                  className="size-3.5 text-muted-foreground"
                />
                Open
              </span>
            )}
          </LedgerRow>

          <LedgerRow label="Area">
            <div className="-ml-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <ThreadAreaSectionSection thread={thread} area={area} />
              <span
                className={cn(
                  "flex items-center gap-1.5 text-[11px]",
                  conditionTextClassName[area.condition],
                )}
              >
                <ConditionIcon aria-hidden className="size-3.5" />
                {conditionLabels[area.condition]}
              </span>
            </div>
          </LedgerRow>

          {!isResolved && (
            <>
              <LedgerRow label="Next move">
                <NextMoveCell thread={thread} />
              </LedgerRow>
              <LedgerRow label="Follow-up">
                <FollowUpCell thread={thread} />
              </LedgerRow>
            </>
          )}

          <LedgerRow label="Last touch">
            {thread.lastActivityAt ? (
              <Stamp
                value={thread.lastActivityAt}
                display={formatDistanceToNow(new Date(thread.lastActivityAt), {
                  addSuffix: true,
                })}
              />
            ) : (
              <span className="text-muted-foreground/60">Nothing logged</span>
            )}
          </LedgerRow>

          <LedgerRow label="Opened">
            <Stamp
              value={thread.createdAt}
              display={format(new Date(thread.createdAt), "MMM d, yyyy")}
            />
          </LedgerRow>
        </dl>

        <section aria-label="Activity" className="pt-4">
          {/* Lane-heading vocabulary: icon, heading, count pill, hairline. */}
          <h2 className="sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-popover px-1 py-2">
            <History aria-hidden className="size-4 text-muted-foreground" />
            <span className="font-heading text-sm font-semibold tracking-tight">
              Activity
            </span>
            {logs && logs.length > 0 && (
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {logs.length}
              </span>
            )}
            <span aria-hidden className="ml-1 h-px flex-1 bg-border/50" />
          </h2>

          <div className="relative pt-2 pb-6">
            <div
              aria-hidden
              className={cn(
                "absolute top-1 bottom-0 w-px",
                RAIL_LEFT,
                "bg-gradient-to-b from-transparent via-border to-transparent",
              )}
            />

            {/* The rail keeps its "now" origin even though the composer moved
                down to the dock. */}
            <div className={cn("relative pb-3", ENTRY_PAD)}>
              <span
                aria-hidden
                className={cn(
                  "absolute top-0.5 size-2.5 -translate-x-1/2 rounded-full",
                  NODE_LEFT,
                  "border border-(--brand-gold) bg-background",
                )}
              >
                <span className="absolute inset-[3px] rounded-full bg-(--brand-gold)" />
              </span>
              <p className={LABEL_CLASS}>Now</p>
            </div>

            <ActivityLogTimeline
              logs={logs}
              canLoadMore={canLoadMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={loadMore}
            />
          </div>
        </section>
      </div>

      <NoteDock onAddNote={addNote} />
    </div>
  );
}

function LedgerRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-9 grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 py-1">
      <dt className={LABEL_CLASS}>{label}</dt>
      <dd className="min-w-0 text-[13px]">{children}</dd>
    </div>
  );
}

function Stamp({ value, display }: { value: number; display: string }) {
  const date = new Date(value);

  return (
    <time
      dateTime={date.toISOString()}
      title={format(date, "PPpp")}
      className="text-muted-foreground"
    >
      {display}
    </time>
  );
}

/** The definition in full: wraps, never clamps; click to edit in place. */
function DefinitionCell({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);

  return (
    <EditableField
      value={thread.summary ?? ""}
      onSave={(summary) => {
        void updateThread({ id: thread._id, summary: summary || null });
      }}
      variant="textarea"
      textareaRows={2}
      inputAriaLabel="Thread definition"
      placeholder="Add a definition…"
      className="min-h-0 py-1 text-[13px] leading-relaxed text-muted-foreground"
      displayClassName="border-b-0 whitespace-pre-wrap hover:bg-muted/50"
      editorClassName="rounded-lg border border-border/60 bg-muted/20 px-2.5 hover:bg-muted/20 focus-visible:bg-muted/20"
    />
  );
}

/** Next move in a ledger cell: readable at rest, complete / edit / clear. */
function NextMoveCell({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);
  const completeNextMove = useCompleteNextMove(thread);
  const text = thread.nextMove;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const { run: setNextMove, isPending: isSetting } = useGuardedAsyncAction(
    async (value: string) => {
      await updateThread({ id: thread._id, nextMove: value });
    },
    { errorToast: true },
  );

  const { run: clearNextMove, isPending: isClearing } = useGuardedAsyncAction(
    async () => {
      await updateThread({ id: thread._id, nextMove: null });
    },
    { errorToast: true },
  );

  const { run: complete, isPending: isCompleting } = useGuardedAsyncAction(
    async () => {
      await completeNextMove();
    },
    { errorToast: true },
  );

  const commit = () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed || trimmed === (text ?? "")) return;
    void setNextMove(trimmed).then((result) => {
      if (result.ok) setDraft("");
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      setEditing(false);
      setDraft("");
    }
  };

  if (!text) {
    return (
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        disabled={isSetting}
        aria-label="Next move"
        placeholder="Add a next move…"
        className="-mx-1 w-full rounded-md bg-transparent px-1 py-1 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/50 focus:bg-transparent focus:ring-1 focus:ring-ring"
      />
    );
  }

  return (
    <div className="group -ml-0.5 flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => void complete()}
        disabled={isCompleting}
        aria-busy={isCompleting}
        aria-label="Complete next move"
        className="shrink-0 rounded-full border border-condition-healthy/40 text-condition-healthy hover:bg-condition-healthy/10 hover:text-condition-healthy"
      >
        <Check />
      </Button>

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          disabled={isSetting}
          aria-label="Next move"
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-[13px] outline-none ring-1 ring-ring"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(text);
            setEditing(true);
          }}
          disabled={isSetting}
          className="min-w-0 flex-1 cursor-text rounded-md px-1 py-0.5 text-left text-[13px] font-medium break-words whitespace-pre-wrap transition-colors hover:bg-muted/50"
        >
          {text}
        </button>
      )}

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => void clearNextMove()}
        disabled={isClearing}
        aria-busy={isClearing}
        aria-label="Clear next move"
        className="shrink-0 text-muted-foreground/50 opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X />
      </Button>
    </div>
  );
}

/** Follow-up in a ledger cell: the date reads at rest, lateness is toned. */
function FollowUpCell({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);

  const { run: saveFollowUp, isPending } = useGuardedAsyncAction(
    async (followUp: number | null) => {
      await updateThread({ id: thread._id, followUp });
    },
    { errorToast: true },
  );

  const followUpDate =
    thread.followUp === undefined ? undefined : new Date(thread.followUp);
  const lateness = followUpDate
    ? isToday(followUpDate)
      ? "Due today"
      : isPast(followUpDate)
        ? "Overdue"
        : undefined
    : undefined;

  return (
    <div className="-ml-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <DatePicker
        value={followUpDate}
        onChange={(date) => void saveFollowUp(date ? date.getTime() : null)}
        placeholder="Add a follow-up…"
        disabled={isPending}
      />
      {lateness && (
        <span className="text-[11px] font-medium text-condition-attention">
          {lateness}
        </span>
      )}
    </div>
  );
}

/** Note dock at the pane floor — the app's bar chrome: hairline + surface. */
function NoteDock({
  onAddNote,
}: {
  onAddNote: (text: string) => Promise<void>;
}) {
  const [noteText, setNoteText] = useState("");
  const { run: addNote, isPending } = useGuardedAsyncAction(onAddNote, {
    errorToast: true,
  });

  const submitNote = async () => {
    const text = noteText.trim();
    if (!text || isPending) return;

    const result = await addNote(text);
    if (result.ok) setNoteText("");
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
      aria-label="Add note"
      className="mt-3 flex shrink-0 items-end gap-2 border-t border-border/60 pt-3"
    >
      <Textarea
        value={noteText}
        onChange={(event) => setNoteText(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isPending}
        aria-label="Activity log note"
        placeholder="Add a note about what happened…"
        rows={1}
        className="max-h-32 min-h-9 flex-1 px-3 py-2 text-[13px] md:text-[13px]"
      />
      <Button
        type="submit"
        size="icon-sm"
        disabled={!noteText.trim() || isPending}
        aria-busy={isPending}
        aria-label="Add note"
      >
        <ArrowUp />
      </Button>
    </form>
  );
}
