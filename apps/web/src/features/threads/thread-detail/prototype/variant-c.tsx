// PROTOTYPE(thread-view) — throwaway. Variant C "Briefing band": identity and
// definition read straight off the pane, then ONE attention band carries the
// next move (primary line) with the follow-up as an inline segment inside it.
// Nothing is behind a tab or a disclosure; the timeline owns the rest.
import type { ProjectedThread } from "@convex/lib/validators";

import { Badge } from "@vita-os/ui/components/badge";
import { DatePicker } from "@vita-os/ui/components/date-picker";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { differenceInCalendarDays, formatDistanceToNow } from "date-fns";
import { ArrowUp, Bell, CircleCheck } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";

import { EditableField } from "@/components/ui/editable-field";
import { NextMoveSection } from "@/features/threads/components/next-move-section";
import { ThreadAreaSectionSection } from "@/features/threads/components/thread-area-section-section";
import { ThreadHeaderSection } from "@/features/threads/components/thread-header-section";
import {
  ActivityLogTimeline,
  ENTRY_PAD,
  NODE_LEFT,
  RAIL_LEFT,
} from "@/features/threads/components/thread-log";
import { useUpdateThread } from "@/features/threads/use-update-thread";
import { useAttentionClock } from "@/hooks/use-attention-clock";
import { cn } from "@/lib/utils";

import type { ThreadVariantProps } from "./prototype-gate";

import { useThreadActivity } from "./use-thread-activity";

export function VariantC({ thread, area }: ThreadVariantProps) {
  const { logs, canLoadMore, isLoadingMore, loadMore, addNote } =
    useThreadActivity(thread._id);
  const isResolved = thread.state === "resolved";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header
        role="banner"
        aria-label="Thread header"
        className="flex shrink-0 flex-col gap-2"
      >
        <div className="flex items-center gap-2 pr-24">
          <ThreadAreaSectionSection thread={thread} area={area} />
          {isResolved ? (
            <Badge variant="secondary">
              <CircleCheck data-icon="inline-start" />
              Resolved
            </Badge>
          ) : (
            <Badge
              variant="ghost"
              className="bg-surface-3 text-[11px] text-muted-foreground"
            >
              Open
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <ThreadHeaderSection thread={thread} areaSlug={area.slug} />
          {/* The whole definition, never clamped — click only to edit it. */}
          <DefinitionField thread={thread} />
        </div>
      </header>

      {isResolved ? <ResolvedBand /> : <BriefingBand thread={thread} />}

      <section
        aria-label="Activity log"
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <div className="flex shrink-0 items-center gap-1">
          <h2 className="text-[11px] font-medium text-muted-foreground">
            Activity log
          </h2>
          {logs !== undefined && logs.length > 0 && (
            <Badge
              variant="ghost"
              className="h-4 px-1.5 text-[10px] tabular-nums text-muted-foreground"
            >
              {logs.length}
              {canLoadMore ? "+" : ""}
            </Badge>
          )}
        </div>

        {/* The pane's only scroll region. */}
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

            {/* The rail's origin is "now"; the newest entry sits right below. */}
            <div className={cn("relative pb-4", ENTRY_PAD)}>
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
              <p className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
                {thread.lastActivityAt
                  ? `Updated ${formatDistanceToNow(new Date(thread.lastActivityAt), { addSuffix: true })}`
                  : "No activity yet"}
              </p>
            </div>

            <ActivityLogTimeline
              logs={logs}
              canLoadMore={canLoadMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={loadMore}
            />
          </div>
        </div>

        <NoteComposer onAddNote={addNote} />
      </section>
    </div>
  );
}

/** Inline-editable definition with no clamp: the full text is always on screen. */
function DefinitionField({ thread }: { thread: ProjectedThread }) {
  const updateThread = useUpdateThread(thread);
  const summary = thread.summary ?? "";

  return (
    <EditableField
      value={summary}
      onSave={(next) => {
        updateThread({ id: thread._id, summary: next || null });
      }}
      variant="textarea"
      textareaRows={2}
      inputAriaLabel="Thread definition"
      placeholder="Add a definition…"
      className="min-h-0 py-1 text-[13px] leading-relaxed text-muted-foreground"
      displayClassName={cn(
        "border-b-0 whitespace-pre-wrap",
        summary
          ? "hover:bg-transparent"
          : "h-7 w-fit cursor-pointer items-center rounded-4xl bg-secondary px-2.5 py-0 text-xs font-medium text-secondary-foreground hover:bg-secondary/80",
      )}
      editorClassName="rounded-lg border border-border/60 bg-muted/20 px-2.5"
    />
  );
}

/**
 * The variant's signature: one strip, not two cards. The next move is the
 * primary line (complete / edit / clear all live here) and the follow-up is a
 * compact segment beneath the same hairline — both readable at a glance.
 */
function BriefingBand({ thread }: { thread: ProjectedThread }) {
  return (
    <section
      aria-label="Thread attention"
      className="shrink-0 overflow-hidden rounded-3xl border border-border bg-muted/35"
    >
      <div className="px-3.5 pt-2.5 pb-2">
        <NextMoveSection thread={thread} />
      </div>
      <div className="border-t border-border/60 px-3.5 py-1.5">
        <FollowUpSegment thread={thread} />
      </div>
    </section>
  );
}

/** Same band geometry, drained of urgency. */
function ResolvedBand() {
  return (
    <section
      aria-label="Thread attention"
      className="flex shrink-0 items-start gap-2.5 rounded-3xl border border-border bg-muted/35 px-4 py-3"
    >
      <CircleCheck
        aria-hidden
        className="mt-px size-4 shrink-0 text-condition-healthy"
      />
      <p className="text-[13px] leading-relaxed text-foreground">
        Resolved
        <span className="text-muted-foreground">
          {" "}
          — next move and follow-up are retired. Reopen from the menu above to
          plan again; the timeline below is untouched either way.
        </span>
      </p>
    </section>
  );
}

/** Label + date + lateness on one line, mirroring the Next Move label above. */
function FollowUpSegment({ thread }: { thread: ProjectedThread }) {
  const now = useAttentionClock();
  const updateThread = useUpdateThread(thread);
  const { run: saveFollowUp, isPending } = useGuardedAsyncAction(
    async (followUp: number | null) => {
      await updateThread({ id: thread._id, followUp });
    },
    { errorToast: true },
  );

  const lateness = getLateness(thread.followUp, now);

  return (
    <div className="flex items-center gap-2">
      <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
        <Bell className="size-3.5" />
        Follow-up
      </span>
      <DatePicker
        value={thread.followUp ? new Date(thread.followUp) : undefined}
        onChange={(date) => void saveFollowUp(date ? date.getTime() : null)}
        placeholder="Add a follow-up…"
        disabled={isPending}
        className="min-w-0"
      />
      {lateness && (
        <span
          className={cn(
            "ml-auto shrink-0 text-[11px] font-medium tabular-nums",
            lateness.tone,
          )}
        >
          {lateness.label}
        </span>
      )}
    </div>
  );
}

/** Day-grained lateness on the shared attention clock. */
function getLateness(followUp: number | undefined, now: number) {
  if (followUp == null) return undefined;

  const days = differenceInCalendarDays(new Date(followUp), new Date(now));

  if (days < 0) {
    const late = Math.abs(days);
    return {
      label: `${late} day${late === 1 ? "" : "s"} overdue`,
      tone: "text-condition-attention",
    };
  }

  if (days === 0) {
    return { label: "Due today", tone: "text-brand-accent-foreground" };
  }

  if (days <= 14) {
    return {
      label: `in ${days} day${days === 1 ? "" : "s"}`,
      tone: "text-muted-foreground",
    };
  }

  return undefined;
}

/** Pinned to the floor of the pane; the timeline scrolls out from under it. */
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
    <div className="relative shrink-0">
      {/* Fade the scrolled timeline out from under the bar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-popover to-transparent"
      />
      <form onSubmit={handleSubmit}>
        <label htmlFor="variant-c-note" className="sr-only">
          Activity log note
        </label>
        <InputGroup
          className="bg-muted/50 has-[textarea]:rounded-3xl has-data-[align=block-end]:rounded-3xl"
          data-disabled={isPending || undefined}
        >
          <InputGroupTextarea
            id="variant-c-note"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isPending}
            aria-label="Activity log note"
            placeholder="Log what just happened…"
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
    </div>
  );
}
