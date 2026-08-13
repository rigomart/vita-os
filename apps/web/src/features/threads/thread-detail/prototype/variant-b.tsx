// PROTOTYPE(thread-view) — throwaway. Variant B, "Command deck": the Next
// Move is the hero. Everything else stays readable without a single click —
// identity, full definition, state and follow-up are all on the surface.
import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedThread } from "@convex/lib/validators";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@vita-os/ui/components/button";
import { DatePicker } from "@vita-os/ui/components/date-picker";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { format, isToday } from "date-fns";
import {
  ArrowUp,
  Bell,
  Check,
  CircleCheck,
  History,
  Loader2,
  MoveRight,
  Plus,
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
import { ThreadAreaSectionSection } from "@/features/threads/components/thread-area-section-section";
import {
  ActivityLogTimeline,
  ENTRY_PAD,
  NODE_LEFT,
  RAIL_LEFT,
} from "@/features/threads/components/thread-log";
import { useThreadPaneNav } from "@/features/threads/thread-detail/thread-pane-nav";
import { useCompleteNextMove } from "@/features/threads/use-complete-next-move";
import { useUpdateThread } from "@/features/threads/use-update-thread";
import { cn } from "@/lib/utils";

import type { ThreadVariantProps } from "./prototype-gate";

import { useThreadActivity } from "./use-thread-activity";

/** The app's micro-label and count-pill vocabulary (AttentionLane, PlanAxis). */
const CAPS =
  "font-heading text-[11px] font-semibold tracking-[0.08em] uppercase";
const PILL = "rounded-full px-2 py-0.5 text-[11px] font-medium";

export function VariantB({ thread, area }: ThreadVariantProps) {
  const isResolved = thread.state === "resolved";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <IdentityBlock thread={thread} area={area} isResolved={isResolved} />

      {isResolved ? (
        <ResolvedDeck thread={thread} />
      ) : (
        <div className="flex shrink-0 flex-col gap-3">
          <NextMoveDeck thread={thread} />
          <FollowUpStrip thread={thread} />
        </div>
      )}

      <ActivityDeck threadId={thread._id} />
    </div>
  );
}

/* --------------------------------------------------------------- shared */

/** Label + hairline rule: the same heading row the Area lanes use. */
function DeckHeading({
  icon: Icon,
  label,
  tone = "muted",
  children,
}: {
  icon: LucideIcon;
  label: string;
  tone?: "muted" | "accent" | "healthy";
  children?: ReactNode;
}) {
  const textClassName = {
    muted: "text-muted-foreground",
    accent: "text-brand-accent-foreground",
    healthy: "text-condition-healthy",
  }[tone];
  const ruleClassName = {
    muted: "bg-border/50",
    accent: "bg-(--brand-gold-strong)/30",
    healthy: "bg-condition-healthy/25",
  }[tone];

  return (
    <div className="flex items-center gap-2">
      <Icon aria-hidden className={cn("size-3.5 shrink-0", textClassName)} />
      <h2 className={cn(CAPS, textClassName)}>{label}</h2>
      {children}
      <span aria-hidden className={cn("h-px flex-1", ruleClassName)} />
    </div>
  );
}

/* ------------------------------------------------------------- identity */

/**
 * Everything that names the Thread, all of it visible: Area, state, title and
 * the definition in full. Clicks are only ever needed to edit.
 */
function IdentityBlock({
  thread,
  area,
  isResolved,
}: {
  thread: ProjectedThread;
  area: ThreadVariantProps["area"];
  isResolved: boolean;
}) {
  const { onThreadLocationChange } = useThreadPaneNav();
  const updateThread = useUpdateThread(thread);

  const handleTitleSave = async (title: string) => {
    if (!title) return;
    const result = await updateThread({ id: thread._id, title });
    if (result?.slug && result.slug !== thread.slug) {
      onThreadLocationChange({ areaSlug: area.slug, threadSlug: result.slug });
    }
  };

  const handleSummarySave = (summary: string) => {
    void updateThread({ id: thread._id, summary: summary || null });
  };

  return (
    <header
      aria-label="Thread identity"
      className="flex shrink-0 flex-col gap-1.5"
    >
      {/* Clears the pane's floating lifecycle + close cluster. */}
      <div className="flex min-h-7 items-center gap-2 pr-24">
        <ThreadAreaSectionSection thread={thread} area={area} />
        <span
          className={cn(
            PILL,
            "shrink-0",
            isResolved
              ? "bg-condition-healthy-fill text-condition-healthy-fill-foreground"
              : "bg-surface-3 text-muted-foreground",
          )}
        >
          {isResolved ? "Resolved" : "Open"}
        </span>
      </div>

      <EditableField
        value={thread.title}
        onSave={handleTitleSave}
        inputAriaLabel="Thread title"
        className="min-h-0 py-0 font-heading text-[15px] font-semibold tracking-tight"
        displayClassName="block border-transparent"
      />

      {/* The definition in full — never clamped, never behind a disclosure. */}
      <EditableField
        value={thread.summary ?? ""}
        onSave={handleSummarySave}
        variant="textarea"
        textareaRows={2}
        inputAriaLabel="Thread definition"
        placeholder="Add a definition…"
        className="min-h-0 py-0.5 text-[13px] leading-relaxed text-muted-foreground"
        displayClassName="border-transparent whitespace-pre-wrap"
        editorClassName="rounded-md bg-muted/30 px-1.5"
      />
    </header>
  );
}

/* ----------------------------------------------------------- next move */

function NextMoveDeck({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);
  const completeNextMove = useCompleteNextMove(thread);

  const { run: setNextMove, isPending: isSetting } = useGuardedAsyncAction(
    async (text: string) => {
      await updateThread({ id: thread._id, nextMove: text });
    },
    { errorToast: true },
  );

  const { run: clearNextMove, isPending: isClearing } = useGuardedAsyncAction(
    async () => {
      await updateThread({ id: thread._id, nextMove: null });
    },
    { errorToast: true },
  );

  const { run: completeMove, isPending: isCompleting } = useGuardedAsyncAction(
    async () => {
      await completeNextMove();
    },
    { errorToast: true },
  );

  const move = thread.nextMove ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(move);
  const [newMove, setNewMove] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(move);
  }, [move]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    if (isSetting) return;
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== move) {
      void setNextMove(trimmed);
    } else {
      setDraft(move);
    }
  };

  const submitNew = async () => {
    const trimmed = newMove.trim();
    if (!trimmed || isSetting) return;
    const result = await setNextMove(trimmed);
    if (result.ok) setNewMove("");
  };

  return (
    <section aria-label="Next move" className="flex flex-col gap-2">
      <DeckHeading
        icon={MoveRight}
        label="Next move"
        tone={move ? "accent" : "muted"}
      />

      {move ? (
        // Gold reads as a single accent edge, not a wash: the app's surfaces
        // stay flat and the emphasis comes from the rule, the bar and the CTA.
        <div className="rounded-lg border-l-2 border-(--brand-gold-strong) bg-surface-3/70 py-2.5 pr-2 pl-3">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={draft}
              aria-label="Next move"
              disabled={isSetting}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit();
                }
                if (event.key === "Escape") {
                  setEditing(false);
                  setDraft(move);
                }
              }}
              className="-mx-1 w-full rounded-md bg-transparent px-1 py-0.5 font-heading text-[17px] font-semibold tracking-tight text-foreground outline-none ring-1 ring-ring"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="-mx-1 w-full cursor-text rounded-md px-1 py-0.5 text-left font-heading text-[17px] leading-snug font-semibold tracking-tight text-balance text-foreground transition-colors hover:bg-muted/60"
            >
              {move}
            </button>
          )}

          <div className="mt-2.5 flex items-center gap-1">
            <Button
              size="sm"
              onClick={() => void completeMove()}
              disabled={isCompleting}
              aria-busy={isCompleting}
            >
              {isCompleting ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Check data-icon="inline-start" />
              )}
              Mark it done
            </Button>
            {!editing && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto text-muted-foreground/50 hover:text-destructive"
              onClick={() => void clearNextMove()}
              disabled={isClearing}
              aria-busy={isClearing}
              aria-label="Clear next move"
            >
              <X />
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitNew();
          }}
          className="rounded-lg border border-dashed border-border py-2.5 pr-2 pl-3"
        >
          <input
            type="text"
            value={newMove}
            aria-label="Next move"
            disabled={isSetting}
            placeholder="What moves this forward?"
            onChange={(event) => setNewMove(event.target.value)}
            className="-mx-1 w-full rounded-md bg-transparent px-1 py-0.5 font-heading text-[17px] font-semibold tracking-tight text-foreground outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="mt-2.5 flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={!newMove.trim() || isSetting}
              aria-busy={isSetting}
            >
              <Plus data-icon="inline-start" />
              Set next move
            </Button>
            <span className="text-[11px] text-muted-foreground">
              One concrete step — nothing else.
            </span>
          </div>
        </form>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ follow-up */

function FollowUpStrip({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);

  const { run: saveFollowUp, isPending } = useGuardedAsyncAction(
    async (followUp: number | null) => {
      await updateThread({ id: thread._id, followUp });
    },
    { errorToast: true },
  );

  const date = thread.followUp ? new Date(thread.followUp) : undefined;
  const dueToday = date !== undefined && isToday(date);
  const overdue =
    date !== undefined && !dueToday && date.getTime() < Date.now();

  return (
    <div
      role="group"
      aria-label="Follow-up"
      className="flex h-8 items-center gap-2 rounded-lg pr-1 pl-0.5 transition-colors hover:bg-muted/50"
    >
      <Bell
        aria-hidden
        className={cn(
          "size-3.5 shrink-0",
          overdue ? "text-condition-attention" : "text-muted-foreground",
        )}
      />
      <span
        className={cn(
          "text-[11px] font-medium",
          overdue ? "text-condition-attention" : "text-muted-foreground",
        )}
      >
        Follow-up
      </span>
      {(overdue || dueToday) && (
        <span
          className={cn(
            PILL,
            "shrink-0",
            overdue
              ? "bg-condition-attention-fill text-condition-attention-fill-foreground"
              : "bg-surface-3 text-brand-accent-foreground",
          )}
        >
          {overdue ? "Overdue" : "Today"}
        </span>
      )}
      <DatePicker
        value={date}
        onChange={(next) => void saveFollowUp(next ? next.getTime() : null)}
        placeholder="No date set"
        disabled={isPending}
        className="ml-auto"
      />
    </div>
  );
}

/* -------------------------------------------------------------- resolved */

/** The hero goes quiet: no pending work, but nothing is hidden either. */
function ResolvedDeck({ thread }: { thread: ProjectedThread }) {
  const followUp = thread.followUp ? new Date(thread.followUp) : undefined;

  return (
    <section aria-label="Resolved" className="flex shrink-0 flex-col gap-2">
      <DeckHeading icon={CircleCheck} label="Resolved" tone="healthy" />
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Nothing is pending on this Thread. What follows is the record of how it
        got here.
      </p>
      {(thread.nextMove || followUp) && (
        <dl className="flex flex-col gap-1 text-[13px] text-muted-foreground">
          {thread.nextMove && (
            <div className="flex items-baseline gap-1.5">
              <dt className="shrink-0 text-[11px] text-muted-foreground/70">
                Last next move
              </dt>
              <dd className="min-w-0 text-foreground/80">{thread.nextMove}</dd>
            </div>
          )}
          {followUp && (
            <div className="flex items-baseline gap-1.5">
              <dt className="shrink-0 text-[11px] text-muted-foreground/70">
                Follow-up
              </dt>
              <dd className="tabular-nums text-foreground/80">
                {format(followUp, "MMM d, yyyy")}
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- activity */

function ActivityDeck({ threadId }: { threadId: Id<"threads"> }) {
  const { logs, canLoadMore, isLoadingMore, loadMore, addNote } =
    useThreadActivity(threadId);

  const [noteText, setNoteText] = useState("");
  const { run: submitNote, isPending } = useGuardedAsyncAction(addNote, {
    errorToast: true,
  });

  const send = async () => {
    const text = noteText.trim();
    if (!text || isPending) return;
    const result = await submitNote(text);
    if (result.ok) setNoteText("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <section
      aria-label="Activity log"
      className="flex min-h-0 flex-1 flex-col gap-3"
    >
      <div className="shrink-0">
        <DeckHeading icon={History} label="Activity">
          {logs && logs.length > 0 && (
            <span
              className={cn(
                PILL,
                "bg-surface-3 tabular-nums text-muted-foreground",
              )}
            >
              {logs.length}
            </span>
          )}
        </DeckHeading>
      </div>

      {/* The one scrolling region in the pane. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative pb-6">
          <div
            aria-hidden
            className={cn(
              "absolute top-1 bottom-0 w-px",
              RAIL_LEFT,
              "bg-gradient-to-b from-transparent via-border to-transparent",
            )}
          />

          <div className={cn("relative pb-4", ENTRY_PAD)}>
            <span
              aria-hidden
              className={cn(
                "absolute top-[15px] size-2.5 -translate-x-1/2 rounded-full",
                NODE_LEFT,
                "border border-(--brand-gold) bg-background",
              )}
            >
              <span className="absolute inset-[3px] rounded-full bg-(--brand-gold)" />
            </span>

            <form onSubmit={handleSubmit}>
              <label htmlFor="deck-note" className="sr-only">
                Activity log note
              </label>
              <InputGroup className="border-border/60 bg-muted/40">
                <InputGroupTextarea
                  id="deck-note"
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  disabled={isPending}
                  aria-label="Activity log note"
                  placeholder="Log what just happened…"
                  className="min-h-9 py-2 pr-10 text-[13px]"
                  rows={1}
                  onKeyDown={handleKeyDown}
                />
                <InputGroupAddon
                  align="block-end"
                  className="absolute right-1.5 bottom-1.5 w-auto p-0"
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

          <ActivityLogTimeline
            logs={logs}
            canLoadMore={canLoadMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
          />
        </div>
      </div>
    </section>
  );
}
