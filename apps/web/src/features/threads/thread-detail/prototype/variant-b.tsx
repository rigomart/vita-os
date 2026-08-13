// PROTOTYPE(thread-view) — throwaway. Variant B, "Command deck": the Next
// Move is the hero; identity and definition are demoted to a compact strip.
import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedThread } from "@convex/lib/validators";

import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { DatePicker } from "@vita-os/ui/components/date-picker";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { isToday } from "date-fns";
import {
  ArrowUp,
  Bell,
  Check,
  ChevronDown,
  CircleCheck,
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
import { ThreadDefinitionSection } from "@/features/threads/components/thread-definition-section";
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

const EYEBROW = "text-[10px] font-medium tracking-[0.09em] uppercase";

export function VariantB({ thread, area }: ThreadVariantProps) {
  const isResolved = thread.state === "resolved";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <IdentityStrip thread={thread} area={area} />

      {isResolved ? (
        <ResolvedHero />
      ) : (
        <>
          <NextMoveHero thread={thread} />
          <FollowUpStrip thread={thread} />
        </>
      )}

      <DeckLog threadId={thread._id} />
    </div>
  );
}

/* ------------------------------------------------------------------ hero */

function NextMoveHero({ thread }: { thread: ProjectedThread }) {
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(move);
  }, [move]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!move) {
    return (
      <EmptyNextMoveHero
        onSet={(text) => setNextMove(text)}
        isPending={isSetting}
      />
    );
  }

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

  return (
    <section
      aria-label="Next move"
      className="shrink-0 rounded-3xl border border-(--brand-gold-strong)/30 bg-gradient-to-b from-(--brand-gold)/15 to-transparent px-4 pt-3 pb-3.5"
    >
      <div className="flex items-center gap-1.5">
        <MoveRight className="size-3.5 shrink-0 text-brand-accent-foreground" />
        <h2 className={cn(EYEBROW, "text-brand-accent-foreground")}>
          Next move
        </h2>
      </div>

      <div className="mt-1.5">
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
            className="-mx-1 w-full rounded-md bg-transparent px-1 py-0.5 font-heading text-[17px] font-semibold leading-snug tracking-tight text-foreground outline-none ring-1 ring-ring"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="-mx-1 w-full cursor-text rounded-md px-1 py-0.5 text-left font-heading text-[17px] font-semibold leading-snug tracking-tight text-balance text-foreground transition-colors hover:bg-foreground/5"
          >
            {move}
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1">
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
    </section>
  );
}

function EmptyNextMoveHero({
  onSet,
  isPending,
}: {
  onSet: (text: string) => Promise<{ ok: boolean }>;
  isPending: boolean;
}) {
  const [text, setText] = useState("");

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;
    const result = await onSet(trimmed);
    if (result.ok) setText("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  return (
    <section
      aria-label="Next move"
      className="shrink-0 rounded-3xl border border-dashed border-border bg-muted/25 px-4 pt-3 pb-3.5"
    >
      <div className="flex items-center gap-1.5">
        <MoveRight className="size-3.5 shrink-0 text-muted-foreground" />
        <h2 className={cn(EYEBROW, "text-muted-foreground")}>Next move</h2>
      </div>

      <form onSubmit={handleSubmit} className="mt-1.5">
        <input
          type="text"
          value={text}
          aria-label="Next move"
          disabled={isPending}
          placeholder="What moves this forward?"
          onChange={(event) => setText(event.target.value)}
          className="-mx-1 w-full rounded-md bg-transparent px-1 py-0.5 font-heading text-[17px] font-semibold leading-snug tracking-tight text-foreground outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-ring"
        />
        <div className="mt-3 flex items-center gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={!text.trim() || isPending}
            aria-busy={isPending}
          >
            <Plus data-icon="inline-start" />
            Set next move
          </Button>
          <span className="text-[11px] text-muted-foreground">
            One concrete step — nothing else.
          </span>
        </div>
      </form>
    </section>
  );
}

function ResolvedHero() {
  return (
    <section
      aria-label="Thread resolved"
      className="shrink-0 rounded-3xl border border-border bg-muted/30 px-4 py-3.5"
    >
      <div className="flex items-center gap-2">
        <CircleCheck className="size-4 shrink-0 text-condition-healthy" />
        <h2 className="font-heading text-[15px] font-semibold tracking-tight">
          Resolved
        </h2>
      </div>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
        Nothing is pending here. What's below is the record of how it closed.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------- follow-up */

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
      className="flex shrink-0 items-center gap-2 rounded-2xl border border-border/70 bg-muted/25 py-1 pr-1 pl-3"
    >
      <Bell className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-[11px] font-medium text-muted-foreground">
        Follow-up
      </span>
      {overdue && (
        <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
          Overdue
        </Badge>
      )}
      {dueToday && (
        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
          Today
        </Badge>
      )}
      <div className="ml-auto">
        <DatePicker
          value={date}
          onChange={(next) => void saveFollowUp(next ? next.getTime() : null)}
          placeholder="Set a date"
          disabled={isPending}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- identity */

function IdentityStrip({
  thread,
  area,
}: {
  thread: ProjectedThread;
  area: ThreadVariantProps["area"];
}) {
  const { onThreadLocationChange } = useThreadPaneNav();
  const updateThread = useUpdateThread(thread);
  const [aboutOpen, setAboutOpen] = useState(false);

  const handleTitleSave = async (title: string) => {
    if (!title) return;
    const result = await updateThread({ id: thread._id, title });
    if (result?.slug && result.slug !== thread.slug) {
      onThreadLocationChange({ areaSlug: area.slug, threadSlug: result.slug });
    }
  };

  return (
    <Collapsible
      open={aboutOpen}
      onOpenChange={setAboutOpen}
      className="shrink-0"
    >
      {/* Row one keeps the pane's floating lifecycle/close cluster clear. */}
      <div className="flex min-h-7 items-center gap-2 pr-24">
        <ThreadAreaSectionSection thread={thread} area={area} />
      </div>

      <div className="mt-1.5 flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1">
          <EditableField
            value={thread.title}
            onSave={handleTitleSave}
            inputAriaLabel="Thread title"
            className="font-heading text-[14px] font-semibold tracking-tight"
            displayClassName="truncate border-b-0"
          />
        </div>
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className="shrink-0 text-[11px] font-normal text-muted-foreground"
            />
          }
        >
          About
          <ChevronDown
            data-icon="inline-end"
            className={cn("transition-transform", aboutOpen && "rotate-180")}
          />
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="pt-1 pb-0.5">
          <ThreadDefinitionSection thread={thread} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ------------------------------------------------------------------- log */

function DeckLog({ threadId }: { threadId: Id<"threads"> }) {
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
      className="flex min-h-0 flex-1 flex-col gap-2.5"
    >
      <div className="flex shrink-0 items-center gap-2">
        <h2 className={cn(EYEBROW, "text-muted-foreground")}>Log</h2>
        {logs && logs.length > 0 && (
          <span className="text-[10px] text-muted-foreground/60">
            {logs.length}
          </span>
        )}
        <span aria-hidden className="h-px flex-1 bg-border/70" />
      </div>

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
              <InputGroup className="border-border/70 bg-muted/25">
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
