// PROTOTYPE(thread-view) — throwaway.
import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";

import { api } from "@convex/_generated/api";
import { Calendar } from "@vita-os/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { format } from "date-fns";
import { Bell, Check, CircleCheck, MoveRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EditableField } from "@/components/ui/editable-field";
import { AreaIcon } from "@/features/areas/components/area-icon";
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

const CONDITION_DOT: Record<ProjectedArea["condition"], string> = {
  healthy: "bg-condition-healthy",
  needs_attention: "bg-condition-attention",
  critical: "bg-condition-critical",
};

const SMALL_CAPS =
  "text-[10px] font-medium tracking-[0.16em] uppercase text-muted-foreground";

/** The document's left margin: glyphs sit on the same axis as the log rail. */
const MARGIN_PAD = ENTRY_PAD;

export function VariantA({ thread, area }: ThreadVariantProps) {
  const { logs, canLoadMore, isLoadingMore, loadMore, addNote } =
    useThreadActivity(thread._id);
  const isResolved = thread.state === "resolved";

  return (
    <article
      aria-label="Thread dossier"
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* One scroll region: the whole document moves, like a page. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <RunningHead thread={thread} area={area} />

        <DossierTitle thread={thread} area={area} />
        <DossierLede thread={thread} />
        <Byline thread={thread} isResolved={isResolved} />

        <div className="pt-5">
          {isResolved ? (
            <ActionLine
              glyph={
                <CircleCheck className="size-3.5 text-condition-healthy" />
              }
            >
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Resolved — nothing is pending. The record below stands as the
                account of this Thread.
              </p>
            </ActionLine>
          ) : (
            <>
              <NextMoveLine thread={thread} />
              <FollowUpLine thread={thread} />
            </>
          )}
        </div>

        <div className="pt-7">
          <div
            aria-hidden
            className="h-px w-full bg-gradient-to-r from-border via-border/50 to-transparent"
          />
          <h2 className={cn(SMALL_CAPS, "pt-4 pb-3", MARGIN_PAD)}>
            The record
            {logs && logs.length > 0 ? ` · ${logs.length}` : ""}
          </h2>
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

/** Printed-brief running head: names the section, shields scrolled content
 *  from the pane's floating control cluster. */
function RunningHead({ thread, area }: ThreadVariantProps) {
  const areas = useQuery(api.areas.list);
  const { onThreadLocationChange } = useThreadPaneNav();
  const updateThread = useUpdateThread(thread, { areas: areas ?? [] });
  const [open, setOpen] = useState(false);

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

  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 bg-popover pr-24 pb-4">
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          CONDITION_DOT[area.condition],
        )}
      />
      {areas ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                disabled={isMoving}
                className={cn(
                  SMALL_CAPS,
                  "inline-flex min-w-0 items-center gap-1.5 rounded-sm transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none disabled:opacity-50",
                )}
              />
            }
          >
            <AreaIcon icon={area.icon} className="size-3 shrink-0" />
            <span className="truncate">{area.name}</span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 gap-0 p-1">
            {areas.map((candidate) => (
              <button
                key={candidate._id}
                type="button"
                onClick={() => handleSelect(candidate._id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-2xl px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-muted",
                  candidate._id === thread.areaId && "text-(--brand-gold)",
                )}
              >
                <AreaIcon icon={candidate.icon} className="size-3.5 shrink-0" />
                <span className="truncate">{candidate.name}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      ) : (
        <span className={cn(SMALL_CAPS, "inline-flex items-center gap-1.5")}>
          <AreaIcon icon={area.icon} className="size-3 shrink-0" />
          {area.name}
        </span>
      )}
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
    <EditableField
      value={thread.title}
      onSave={(title) => void handleSave(title)}
      inputAriaLabel="Thread title"
      className="font-heading text-[26px] leading-[1.15] font-semibold tracking-tight text-balance"
      displayClassName="rounded-md border-b-0"
      editorClassName="border-b border-border/50"
    />
  );
}

/** The definition, set as the document's lede paragraph. */
function DossierLede({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);

  return (
    <EditableField
      value={thread.summary ?? ""}
      onSave={(summary) =>
        void updateThread({ id: thread._id, summary: summary || null })
      }
      variant="textarea"
      textareaRows={2}
      placeholder="Write the definition — what this Thread is really about."
      inputAriaLabel="Thread definition"
      className="min-h-0 py-1 text-[14px] leading-relaxed text-muted-foreground"
      displayClassName="rounded-md border-b-0"
      editorClassName="border-b border-border/50"
    />
  );
}

function Byline({
  thread,
  isResolved,
}: {
  thread: ProjectedThread;
  isResolved: boolean;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-2.5 text-[11px] text-muted-foreground/80">
      <span
        className={cn(
          SMALL_CAPS,
          isResolved ? "text-condition-healthy" : "text-foreground/70",
        )}
      >
        {isResolved ? "Resolved" : "Open"}
      </span>
      <Divider />
      <span>Opened {format(new Date(thread.createdAt), "MMMM d, yyyy")}</span>
      {thread.lastActivityAt !== undefined && (
        <>
          <Divider />
          <span>
            Last entry{" "}
            <time dateTime={new Date(thread.lastActivityAt).toISOString()}>
              {format(new Date(thread.lastActivityAt), "MMMM d, yyyy")}
            </time>
          </span>
        </>
      )}
    </p>
  );
}

function Divider() {
  return (
    <span aria-hidden className="text-border">
      ·
    </span>
  );
}

/** A sentence in the document flow with a glyph out in the margin. */
function ActionLine({
  glyph,
  children,
}: {
  glyph: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn("group relative py-1.5", MARGIN_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-[9px] -translate-x-1/2 text-muted-foreground/60",
          NODE_LEFT,
        )}
      >
        {glyph}
      </span>
      {children}
    </div>
  );
}

function NextMoveLine({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);
  const completeNextMove = useCompleteNextMove(thread);
  const current = thread.nextMove ?? "";
  const [draft, setDraft] = useState(current);
  const cancelledRef = useRef(false);

  useEffect(() => {
    setDraft(current);
  }, [current]);

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

  const commit = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraft(current);
      return;
    }
    const text = draft.trim();
    if (text === current) return;
    void save(text === "" ? null : text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      cancelledRef.current = true;
      event.currentTarget.blur();
    }
  };

  return (
    <ActionLine glyph={<MoveRight className="size-3.5" />}>
      <div className="flex items-baseline gap-2.5">
        <span className={cn(SMALL_CAPS, "shrink-0 pt-px")}>Next</span>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          disabled={isSaving || isCompleting}
          aria-label="Next move"
          placeholder="Name the next move…"
          className="min-w-0 flex-1 border-b border-transparent bg-transparent py-0.5 text-[13px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 hover:border-border/60 focus:border-(--brand-gold) disabled:opacity-50"
        />
        {current !== "" && (
          <span className="flex shrink-0 items-center gap-0.5 self-center">
            <LineAction
              label="Complete next move"
              busy={isCompleting}
              onClick={() => void complete()}
              className="border border-condition-healthy/50 text-condition-healthy hover:bg-condition-healthy/10"
            >
              <Check className="size-3" />
            </LineAction>
            <LineAction
              label="Clear next move"
              busy={isSaving}
              onClick={() => void save(null)}
            >
              <X className="size-3" />
            </LineAction>
          </span>
        )}
      </div>
    </ActionLine>
  );
}

function FollowUpLine({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);
  const [open, setOpen] = useState(false);

  const { run: save, isPending } = useGuardedAsyncAction(
    async (followUp: number | null) => {
      await updateThread({ id: thread._id, followUp });
    },
    { errorToast: true },
  );

  const followUp = thread.followUp;

  return (
    <ActionLine glyph={<Bell className="size-3.5" />}>
      <div className="flex items-baseline gap-2.5">
        <span className={cn(SMALL_CAPS, "shrink-0 pt-px")}>Then</span>
        <Popover open={open} onOpenChange={isPending ? undefined : setOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                disabled={isPending}
                aria-label="Follow-up date"
                className={cn(
                  "min-w-0 flex-1 truncate border-b border-transparent py-0.5 text-left text-[13px] leading-relaxed transition-colors hover:border-border/60 focus-visible:border-(--brand-gold) focus-visible:outline-none disabled:opacity-50",
                  followUp === undefined
                    ? "text-muted-foreground/50"
                    : "text-foreground",
                )}
              />
            }
          >
            {followUp === undefined
              ? "Come back to this on…"
              : `Come back to this on ${format(new Date(followUp), "EEEE, MMMM d")}`}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto gap-0 p-0">
            <Calendar
              mode="single"
              selected={followUp === undefined ? undefined : new Date(followUp)}
              onSelect={(date) => {
                setOpen(false);
                void save(date ? date.getTime() : null);
              }}
            />
          </PopoverContent>
        </Popover>
        {followUp !== undefined && (
          <span className="flex shrink-0 items-center self-center">
            <LineAction
              label="Clear follow-up"
              busy={isPending}
              onClick={() => void save(null)}
            >
              <X className="size-3" />
            </LineAction>
          </span>
        )}
      </div>
    </ActionLine>
  );
}

function LineAction({
  label,
  busy,
  onClick,
  className,
  children,
}: {
  label: string;
  busy?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      aria-busy={busy || undefined}
      className={cn(
        "flex size-5 items-center justify-center rounded-full text-muted-foreground/50 opacity-0 transition-[opacity,color,background-color] hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100 disabled:cursor-not-allowed",
        className,
      )}
    >
      {children}
    </button>
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
    <div className={cn("relative pb-5", MARGIN_PAD)}>
      <span
        aria-hidden
        className={cn(
          "absolute top-[7px] size-2.5 -translate-x-1/2 rounded-full",
          NODE_LEFT,
          "border border-(--brand-gold) bg-background",
        )}
      >
        <span className="absolute inset-[3px] rounded-full bg-(--brand-gold)" />
      </span>
      <form onSubmit={handleSubmit}>
        <label htmlFor="dossier-note" className="sr-only">
          Add to the record
        </label>
        <textarea
          id="dossier-note"
          rows={1}
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending}
          placeholder="Write the next line of the record…"
          className="field-sizing-content w-full resize-none border-b border-border/50 bg-transparent pb-1.5 text-[13px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 hover:border-border focus:border-(--brand-gold) disabled:opacity-50"
        />
        {(hasDraft || isPending) && (
          <div className="flex items-center justify-between gap-3 pt-1.5">
            <span className="text-[10px] text-muted-foreground/60">
              Enter to record · Shift + Enter for a new line
            </span>
            <button
              type="submit"
              disabled={!hasDraft || isPending}
              aria-busy={isPending || undefined}
              className={cn(
                SMALL_CAPS,
                "shrink-0 text-(--brand-gold-strong) transition-opacity hover:opacity-80 focus-visible:outline-none disabled:opacity-50",
              )}
            >
              {isPending ? "Recording…" : "Record"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
