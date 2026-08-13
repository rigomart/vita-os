// PROTOTYPE(thread-view) — throwaway.
import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedThread } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { conditionLabels } from "@convex/lib/condition";
import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import { DatePicker } from "@vita-os/ui/components/date-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { format } from "date-fns";
import { ArrowRight, ArrowUp, Bell, Check, History, X } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useState,
} from "react";

import { EditableField } from "@/components/ui/editable-field";
import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
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

/** Tiny uppercase label, same treatment as the activity log's day markers. */
const LABEL =
  "text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase";

export function VariantA({ thread, area }: ThreadVariantProps) {
  const { logs, canLoadMore, isLoadingMore, loadMore, addNote } =
    useThreadActivity(thread._id);
  const isResolved = thread.state === "resolved";

  return (
    <article aria-label="Thread" className="flex min-h-0 flex-1 flex-col">
      {/* One scroll region: the whole document moves, like a page. The x-bleed
          gives rows room for the app's hover backgrounds. */}
      <div className="-mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
        <RunningHead thread={thread} area={area} isResolved={isResolved} />

        <DossierTitle thread={thread} area={area} />
        <DossierLede thread={thread} />
        <Byline thread={thread} isResolved={isResolved} />

        <div className="pt-4 pb-1">
          {isResolved ? (
            <ResolvedLine />
          ) : (
            <>
              <NextMoveLine thread={thread} />
              <FollowUpLine thread={thread} />
            </>
          )}
        </div>

        <RecordHeading count={logs?.length} />

        <div className="relative pb-6">
          <div
            aria-hidden
            className={cn(
              "absolute top-1 bottom-0 w-px",
              RAIL_LEFT,
              "bg-gradient-to-b from-transparent via-border to-transparent",
            )}
          />
          <Composer onAddNote={addNote} />
          <ActivityLogTimeline
            logs={logs}
            canLoadMore={canLoadMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMore}
          />
        </div>
      </div>
    </article>
  );
}

/**
 * The document's running head: Area (with its condition) and lifecycle, always
 * legible. Sticky so it also shields scrolled text from the pane's floating
 * control cluster.
 */
function RunningHead({
  thread,
  area,
  isResolved,
}: ThreadVariantProps & { isResolved: boolean }) {
  const areas = useQuery(api.areas.list);
  const { onThreadLocationChange } = useThreadPaneNav();
  const updateThread = useUpdateThread(thread, { areas: areas ?? [] });
  const [open, setOpen] = useState(false);
  const ConditionIcon = conditionIcons[area.condition];

  const { run: moveThread, isPending: isMoving } = useGuardedAsyncAction(
    async (areaId: Id<"areas">) => {
      if (!areas || areaId === thread.areaId) return null;
      await updateThread({ id: thread._id, areaId });
      return areas.find((candidate) => candidate._id === areaId) ?? null;
    },
    { successMessage: "Thread moved", errorToast: true },
  );

  const handleSelect = (areaId: Id<"areas">) => {
    setOpen(false);
    if (areaId === thread.areaId) return;

    void moveThread(areaId).then((result) => {
      if (!result.ok || !result.value) return;
      if (result.value.slug !== area.slug) {
        onThreadLocationChange({
          areaSlug: result.value.slug,
          threadSlug: thread.slug,
        });
      }
    });
  };

  const areaLabel = (
    <>
      <AreaIcon icon={area.icon} className="size-3 shrink-0" />
      <span className="truncate">{area.name}</span>
      <ConditionIcon
        aria-hidden
        className={cn(
          "size-3 shrink-0",
          conditionTextClassName[area.condition],
        )}
      />
    </>
  );

  return (
    <div className="sticky top-0 z-10 -mx-2 flex items-center gap-2 bg-popover pr-24 pb-3 pl-2">
      {areas ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                disabled={isMoving}
                aria-label={`Area: ${area.name}, ${conditionLabels[area.condition]}. Move Thread`}
                className="-ml-1.5 inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
              />
            }
          >
            {areaLabel}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 gap-0 p-1">
            {areas.map((candidate) => (
              <button
                key={candidate._id}
                type="button"
                onClick={() => handleSelect(candidate._id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-2xl px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-muted",
                  candidate._id === thread.areaId && "font-medium",
                )}
              >
                <AreaIcon icon={candidate.icon} className="size-3.5 shrink-0" />
                <span className="truncate">{candidate.name}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      ) : (
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          {areaLabel}
        </span>
      )}

      {isResolved && <Badge variant="secondary">Resolved</Badge>}
    </div>
  );
}

function DossierTitle({ thread, area }: ThreadVariantProps) {
  const { onThreadLocationChange } = useThreadPaneNav();
  const updateThread = useUpdateThread(thread);

  const handleSave = async (title: string) => {
    if (!title) return;
    const result = await updateThread({ id: thread._id, title });
    if (result?.slug && result.slug !== thread.slug) {
      onThreadLocationChange({ areaSlug: area.slug, threadSlug: result.slug });
    }
  };

  return (
    <div>
      <EditableField
        value={thread.title}
        onSave={(title) => void handleSave(title)}
        inputAriaLabel="Thread title"
        className="min-h-0 py-0.5 font-heading text-2xl leading-tight font-semibold tracking-tight"
        displayClassName="rounded-md border-transparent"
      />
    </div>
  );
}

/** The definition, set as the document's lede paragraph — always in full. */
function DossierLede({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);

  return (
    <div className="pt-1">
      <EditableField
        value={thread.summary ?? ""}
        onSave={(summary) =>
          void updateThread({ id: thread._id, summary: summary || null })
        }
        variant="textarea"
        textareaRows={2}
        placeholder="Add a summary…"
        inputAriaLabel="Thread summary"
        className="min-h-0 py-0.5 text-sm leading-relaxed text-muted-foreground"
        displayClassName="rounded-md border-transparent"
      />
    </div>
  );
}

/** Byline in the census idiom used on Area pages. */
function Byline({
  thread,
  isResolved,
}: {
  thread: ProjectedThread;
  isResolved: boolean;
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 pt-2 text-[11px] tabular-nums text-muted-foreground">
      <span className={cn(isResolved && conditionTextClassName.healthy)}>
        {isResolved ? "Resolved" : "Open"}
      </span>
      <Dot />
      <span>Opened {format(new Date(thread.createdAt), "MMM d, yyyy")}</span>
      {thread.lastActivityAt !== undefined && (
        <>
          <Dot />
          <span>
            Last entry{" "}
            <time dateTime={new Date(thread.lastActivityAt).toISOString()}>
              {format(new Date(thread.lastActivityAt), "MMM d, yyyy")}
            </time>
          </span>
        </>
      )}
    </p>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-muted-foreground/40">
      ·
    </span>
  );
}

/**
 * A line in the document flow with its glyph out in the left margin, on the
 * same axis as the activity log's rail.
 */
function ActionLine({
  glyph,
  label,
  children,
}: {
  glyph: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("group relative py-1.5", ENTRY_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/60",
          NODE_LEFT,
        )}
      >
        {glyph}
      </span>
      <div className="flex items-center gap-2">
        <span className={cn(LABEL, "w-[4.75rem] shrink-0")}>{label}</span>
        {children}
      </div>
    </div>
  );
}

function NextMoveLine({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);
  const completeNextMove = useCompleteNextMove(thread);
  const nextMove = thread.nextMove ?? "";

  const { run: save, isPending: isSaving } = useGuardedAsyncAction(
    async (value: string | null) => {
      await updateThread({ id: thread._id, nextMove: value });
    },
    { errorToast: true },
  );

  const { run: complete, isPending: isCompleting } = useGuardedAsyncAction(
    async () => {
      await completeNextMove();
    },
    { errorToast: true },
  );

  const busy = isSaving || isCompleting;

  return (
    <ActionLine glyph={<ArrowRight className="size-3.5" />} label="Next move">
      <span className="min-w-0 flex-1">
        <EditableField
          value={nextMove}
          onSave={(text) => void save(text || null)}
          disabled={busy}
          placeholder="Add a next move…"
          inputAriaLabel="Next move"
          className="min-h-0 py-0 text-[13px] leading-relaxed"
          displayClassName="border-transparent text-left"
        />
      </span>
      {nextMove !== "" && (
        <span className="flex shrink-0 items-center gap-0.5 self-center">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => void complete()}
            disabled={busy}
            aria-busy={isCompleting}
            aria-label="Complete next move"
            className="rounded-full border border-condition-healthy/40 text-condition-healthy hover:bg-condition-healthy/10 hover:text-condition-healthy"
          >
            <Check />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => void save(null)}
            disabled={busy}
            aria-busy={isSaving}
            aria-label="Clear next move"
            className="text-muted-foreground/40 opacity-0 hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <X />
          </Button>
        </span>
      )}
    </ActionLine>
  );
}

function FollowUpLine({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);

  const { run: save, isPending } = useGuardedAsyncAction(
    async (followUp: number | null) => {
      await updateThread({ id: thread._id, followUp });
    },
    { errorToast: true },
  );

  return (
    <ActionLine glyph={<Bell className="size-3.5" />} label="Follow-up">
      {/* -ml-2 cancels the trigger's own padding so its text sits on the same
          column as the next move's. */}
      <DatePicker
        className="-ml-2 min-w-0 flex-1"
        value={
          thread.followUp === undefined ? undefined : new Date(thread.followUp)
        }
        onChange={(date) => void save(date ? date.getTime() : null)}
        placeholder="Add a follow-up…"
        disabled={isPending}
      />
    </ActionLine>
  );
}

function ResolvedLine() {
  const ResolvedIcon = conditionIcons.healthy;

  return (
    <div className={cn("relative py-1.5", ENTRY_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 -translate-x-1/2 -translate-y-1/2",
          NODE_LEFT,
          conditionTextClassName.healthy,
        )}
      >
        <ResolvedIcon className="size-3.5" />
      </span>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Nothing pending. The record below stands as the account of this Thread.
      </p>
    </div>
  );
}

/** Section heading in the Area page's lane idiom: the rule is the divider. */
function RecordHeading({ count }: { count: number | undefined }) {
  return (
    <div className="flex items-center gap-2 pt-5 pb-2">
      <History aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <h2 className="font-heading text-sm font-semibold tracking-tight">
        Record
      </h2>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
      <span aria-hidden className="ml-1 h-px flex-1 bg-border/50" />
    </div>
  );
}

/** Writing the next line of the document: no box, just a rule under the text. */
function Composer({
  onAddNote,
}: {
  onAddNote: (content: string) => Promise<void>;
}) {
  const [noteText, setNoteText] = useState("");
  const { run: addNote, isPending } = useGuardedAsyncAction(onAddNote, {
    errorToast: true,
  });

  const submit = async () => {
    const text = noteText.trim();
    if (!text || isPending) return;
    const result = await addNote(text);
    if (result.ok) setNoteText("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const hasDraft = noteText.trim().length > 0;

  return (
    <div className={cn("relative pb-5", ENTRY_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-[5px] size-2.5 -translate-x-1/2 rounded-full",
          NODE_LEFT,
          "border border-(--brand-gold) bg-background",
        )}
      >
        <span className="absolute inset-[3px] rounded-full bg-(--brand-gold)" />
      </span>
      <form onSubmit={handleSubmit}>
        <label htmlFor="dossier-note" className="sr-only">
          Add a note
        </label>
        <textarea
          id="dossier-note"
          rows={1}
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          placeholder="Add a note about what happened…"
          className="field-sizing-content w-full resize-none border-b border-border/30 bg-transparent pb-1.5 text-[13px] leading-relaxed transition-colors outline-none placeholder:text-muted-foreground hover:border-border/70 focus:border-foreground disabled:opacity-50"
        />
        {(hasDraft || isPending) && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <span className="text-[11px] text-muted-foreground">
              Enter to add · Shift + Enter for a new line
            </span>
            <Button
              type="submit"
              size="xs"
              variant="secondary"
              disabled={!hasDraft || isPending}
              aria-busy={isPending || undefined}
            >
              <ArrowUp data-icon="inline-start" />
              Add note
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
