// PROTOTYPE(thread-view) — throwaway.
// Variant E "Journal dock": the pane is one continuous log you write into.
// One header row, everything else behind a Details disclosure, composer docked
// at the bottom like a chat app.
import type { ProjectedArea } from "@convex/lib/validators";

import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import { Separator } from "@vita-os/ui/components/separator";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { ArrowUp, ChevronDown, Loader2, PenLine } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { FollowUpSection } from "@/features/threads/components/follow-up-section";
import { NextMoveSection } from "@/features/threads/components/next-move-section";
import { ThreadAreaSectionSection } from "@/features/threads/components/thread-area-section-section";
import { ThreadDefinitionSection } from "@/features/threads/components/thread-definition-section";
import { ThreadHeaderSection } from "@/features/threads/components/thread-header-section";
import {
  ActivityLogTimeline,
  ENTRY_PAD,
  NODE_LEFT,
  RAIL_LEFT,
} from "@/features/threads/components/thread-log";
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
  const [detailsOpen, setDetailsOpen] = useState(false);

  const isResolved = thread.state === "resolved";
  const hasAttention =
    Boolean(thread.nextMove) || thread.followUp !== undefined;

  return (
    <Collapsible
      open={detailsOpen}
      onOpenChange={setDetailsOpen}
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* The only fixed chrome: one row. Area, title, state, Details. */}
      <div className="flex shrink-0 items-center gap-2 pr-24">
        <span
          className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
          title={`Area: ${area.name}`}
        >
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              CONDITION_DOT[area.condition],
            )}
          />
          <AreaIcon icon={area.icon} className="size-3" />
          <span className="max-w-28 truncate">{area.name}</span>
        </span>

        <span aria-hidden className="h-3 w-px shrink-0 bg-border" />

        <h2
          className={cn(
            "min-w-0 flex-1 truncate font-heading text-[15px] font-semibold tracking-tight",
            isResolved ? "text-muted-foreground" : "text-foreground",
          )}
          title={thread.title}
        >
          {thread.title}
        </h2>

        {isResolved && (
          <Badge
            variant="secondary"
            className="h-5 shrink-0 px-2 text-[10px] tracking-wide uppercase"
          >
            Resolved
          </Badge>
        )}

        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            />
          }
        >
          Details
          {!isResolved && hasAttention && !detailsOpen && (
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-(--brand-gold-strong)"
            />
          )}
          <ChevronDown
            data-icon="inline-end"
            className={cn(
              "transition-transform duration-150",
              detailsOpen && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
      </div>

      {/* Secondary surface: definition, area, next move, follow-up. Expands
          in place so the log keeps its column instead of being covered. */}
      <CollapsibleContent
        className={cn(
          "shrink-0 h-[var(--collapsible-panel-height)] overflow-hidden",
          "transition-[height] duration-200 ease-out",
          "data-starting-style:h-0 data-ending-style:h-0",
        )}
      >
        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/30 px-3.5 py-3">
          <div className="flex flex-col gap-0.5">
            <ThreadHeaderSection thread={thread} areaSlug={area.slug} />
            <ThreadDefinitionSection thread={thread} />
          </div>

          <Separator className="opacity-60" />

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              Area
            </span>
            <ThreadAreaSectionSection thread={thread} area={area} />
          </div>

          {isResolved ? (
            <p className="text-[13px] leading-snug text-muted-foreground">
              This Thread is resolved — reopen it from the menu above to set a
              next move or follow-up again.
            </p>
          ) : (
            <>
              <Separator className="opacity-60" />
              <NextMoveSection thread={thread} />
              <FollowUpSection thread={thread} />
            </>
          )}
        </div>
      </CollapsibleContent>

      {/* The log owns the rest of the pane and is the only scroll region. It
          fades under the header row and into the docked composer. */}
      <section
        aria-label="Activity log"
        className={cn(
          "mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain",
          "[mask-image:linear-gradient(to_bottom,transparent,black_0.75rem,black_calc(100%_-_1.25rem),transparent)]",
        )}
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

          {/* "Now" cap: the log reads newest-first, the composer sits at the
              bottom, so the direction of time is stated once, here. */}
          <div className={cn("relative pb-3", ENTRY_PAD)}>
            <span
              aria-hidden
              className={cn(
                "absolute top-1 size-2 -translate-x-1/2 rounded-full border border-(--brand-gold) bg-background",
                NODE_LEFT,
              )}
            />
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
              Now · newest first
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

      <NoteDock
        onAddNote={addNote}
        placeholder={
          isResolved ? "Add a closing note…" : "Write what happened…"
        }
      />
    </Collapsible>
  );
}

function NoteDock({
  onAddNote,
  placeholder,
}: {
  onAddNote: (content: string) => Promise<void>;
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
      aria-label="Add a note"
      className="shrink-0 pt-3"
    >
      <InputGroup
        data-disabled={isPending || undefined}
        className="rounded-3xl border-border/60 shadow-sm transition-shadow focus-within:shadow-md data-disabled:opacity-70"
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
          <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground/70">
            {noteText ? (
              "Enter to save · Shift+Enter for a new line"
            ) : (
              <>
                <PenLine className="size-3" />
                Notes are this Thread's record
              </>
            )}
          </span>
          <InputGroupButton
            type="submit"
            size="icon-sm"
            variant="ghost"
            disabled={!noteText.trim() || isPending}
            aria-label="Add note"
            aria-busy={isPending || undefined}
            className="rounded-full bg-(--brand-gold) text-(--brand-ink) hover:bg-(--brand-gold-strong) hover:text-(--brand-ink)"
          >
            {isPending ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
