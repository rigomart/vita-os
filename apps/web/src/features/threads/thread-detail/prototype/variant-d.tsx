// PROTOTYPE(thread-view) — throwaway.
import type { ProjectedThread } from "@convex/lib/validators";
import type { ReactNode } from "react";

import { conditionLabels } from "@convex/lib/condition";
import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import { DatePicker } from "@vita-os/ui/components/date-picker";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowUp, Check, CircleCheck, X } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { conditionTextClassName } from "@/features/areas/condition-presentation";
import { ThreadAreaSectionSection } from "@/features/threads/components/thread-area-section-section";
import { ThreadDefinitionSection } from "@/features/threads/components/thread-definition-section";
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

export function VariantD({ thread, area }: ThreadVariantProps) {
  const { logs, canLoadMore, isLoadingMore, loadMore, addNote } =
    useThreadActivity(thread._id);
  const isResolved = thread.state === "resolved";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* The single scroll region: identity, ledger and timeline all run
          under the pinned composer, which masks the bottom edge. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 [mask-image:linear-gradient(to_bottom,#000_calc(100%_-_3.5rem),transparent)]">
        <header aria-label="Thread identity" className="pb-4">
          <div className="pr-24">
            <ThreadHeaderSection thread={thread} areaSlug={area.slug} />
          </div>
          <div className="pt-0.5 text-[13px]">
            <ThreadDefinitionSection thread={thread} />
          </div>
        </header>

        <dl
          aria-label="Thread properties"
          className="divide-y divide-border border-y border-border"
        >
          <LedgerRow label="State">
            {isResolved ? (
              <Badge
                variant="secondary"
                className="h-5 gap-1 px-2 text-[11px] font-medium"
              >
                <CircleCheck className="size-3" />
                Resolved
              </Badge>
            ) : (
              <span className="flex items-center gap-1.5 text-[13px] text-foreground">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-(--brand-gold-strong)"
                />
                Open
              </span>
            )}
          </LedgerRow>

          <LedgerRow label="Area">
            <div className="-ml-1.5 flex items-center gap-2">
              <ThreadAreaSectionSection thread={thread} area={area} />
              <span
                className={cn(
                  "flex items-center gap-1.5 text-[11px]",
                  conditionTextClassName[area.condition],
                )}
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-current"
                />
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

          <LedgerRow label="Last activity">
            {thread.lastActivityAt ? (
              <Stamp
                value={thread.lastActivityAt}
                display={formatDistanceToNow(new Date(thread.lastActivityAt), {
                  addSuffix: true,
                })}
              />
            ) : (
              <span className="text-[13px] text-muted-foreground/60">—</span>
            )}
          </LedgerRow>

          <LedgerRow label="Created">
            <Stamp
              value={thread.createdAt}
              display={format(new Date(thread.createdAt), "MMM d, yyyy")}
            />
          </LedgerRow>
        </dl>

        <section aria-label="Activity">
          <div className="sticky top-0 z-10 flex items-center gap-2.5 bg-popover/90 py-2.5 backdrop-blur-sm">
            <h2 className="text-[10px] font-medium tracking-[0.09em] text-muted-foreground/70 uppercase">
              Activity
            </h2>
            <span aria-hidden className="h-px flex-1 bg-border" />
            {logs && logs.length > 0 && (
              <span className="text-[10px] tabular-nums text-muted-foreground/60">
                {logs.length}
              </span>
            )}
          </div>

          <div className="relative pb-6">
            <div
              aria-hidden
              className={cn(
                "absolute top-1 bottom-0 w-px",
                RAIL_LEFT,
                "bg-gradient-to-b from-transparent via-border to-transparent",
              )}
            />

            {/* The rail's origin marker; the composer no longer sits here. */}
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
              <p className="text-[10px] font-medium tracking-[0.09em] text-muted-foreground/60 uppercase">
                Now
              </p>
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

      <NoteComposer onAddNote={addNote} />
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
    <div className="grid min-h-9 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 py-1">
      <dt className="text-[10px] font-medium tracking-[0.09em] text-muted-foreground/70 uppercase">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Stamp({ value, display }: { value: number; display: string }) {
  const date = new Date(value);

  return (
    <time
      dateTime={date.toISOString()}
      title={format(date, "PPpp")}
      className="text-[13px] text-muted-foreground"
    >
      {display}
    </time>
  );
}

/** Next move as a ledger cell: complete / edit in place / clear, no header. */
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

  const inputClassName =
    "min-w-0 flex-1 rounded-sm bg-transparent px-1 py-0.5 text-[13px] outline-none ring-1 ring-ring";

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
        placeholder="Set a next move…"
        className="-ml-1 w-full rounded-sm bg-transparent px-1 py-1 text-[13px] outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-ring"
      />
    );
  }

  return (
    <div className="group -ml-1 flex items-center gap-1.5">
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
          className={inputClassName}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(text);
            setEditing(true);
          }}
          disabled={isSetting}
          className="min-w-0 flex-1 cursor-text truncate rounded-sm px-1 py-0.5 text-left text-[13px] font-medium transition-colors hover:bg-muted/50"
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
        className="shrink-0 text-muted-foreground/40 opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X />
      </Button>
    </div>
  );
}

/** Follow-up as a ledger cell: the shared DatePicker, no header. */
function FollowUpCell({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);

  const { run: saveFollowUp, isPending } = useGuardedAsyncAction(
    async (followUp: number | null) => {
      await updateThread({ id: thread._id, followUp });
    },
    { errorToast: true },
  );

  return (
    <DatePicker
      className="-ml-2"
      value={thread.followUp ? new Date(thread.followUp) : undefined}
      onChange={(date) => void saveFollowUp(date ? date.getTime() : null)}
      placeholder="Set a follow-up…"
      disabled={isPending}
    />
  );
}

/** Floating pill pinned to the pane's bottom edge; content scrolls beneath. */
function NoteComposer({
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
    // The pane shell supplies the bottom (and safe-area) padding, so the pill
    // floats clear of the edge without adding its own inset.
    <form
      onSubmit={handleSubmit}
      className="absolute inset-x-0 bottom-0 z-20"
      aria-label="Add note"
    >
      <InputGroup
        data-disabled={isPending || undefined}
        className="rounded-4xl border-border bg-popover/80 shadow-lg backdrop-blur-md has-[textarea]:rounded-4xl"
      >
        <InputGroupTextarea
          id="variant-d-note"
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          aria-label="Activity log note"
          placeholder="Log what happened…"
          rows={1}
          className="min-h-10 py-2.5 pr-11 pl-4 text-[13px]"
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
  );
}
