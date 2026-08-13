// PROTOTYPE(thread-view) — throwaway. Variant C "Segmented workspace": a tight
// identity header over two tabs, so the timeline never shares vertical space
// with the details and the composer can live pinned at the pane's floor.
import type { ProjectedArea } from "@convex/lib/validators";

import { Badge } from "@vita-os/ui/components/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@vita-os/ui/components/tabs";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowUp, CircleCheck } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useState,
} from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
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

export function VariantC({ thread, area }: ThreadVariantProps) {
  const { logs, canLoadMore, isLoadingMore, loadMore, addNote } =
    useThreadActivity(thread._id);
  const isResolved = thread.state === "resolved";
  // The one thing segmentation risks burying: an open Thread with no move.
  const detailsNeedsAttention = !isResolved && !thread.nextMove;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header
        role="banner"
        aria-label="Thread header"
        className="flex shrink-0 flex-col gap-2"
      >
        <div className="flex items-center gap-2 pr-24">
          <ThreadAreaSectionSection thread={thread} area={area} />
          {isResolved && (
            <Badge variant="secondary">
              <CircleCheck data-icon="inline-start" />
              Resolved
            </Badge>
          )}
        </div>
        <ThreadHeaderSection thread={thread} areaSlug={area.slug} />
      </header>

      <Tabs defaultValue="activity" className="min-h-0 flex-1 gap-0">
        <TabsList aria-label="Thread views" className="w-full shrink-0">
          <TabsTrigger value="activity" className="gap-1.5 text-[13px]">
            Activity
            {logs !== undefined && logs.length > 0 && (
              <span className="rounded-full bg-foreground/10 px-1.5 py-px text-[10px] tabular-nums text-muted-foreground">
                {logs.length}
                {canLoadMore ? "+" : ""}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-1.5 text-[13px]">
            Details
            {detailsNeedsAttention && (
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-(--brand-gold-strong)"
              />
            )}
          </TabsTrigger>
        </TabsList>

        {/* keepMounted: switching tabs keeps a half-typed note and any open
            inline editor alive. Panels hide via [data-hidden]. */}
        <TabsContent
          value="activity"
          keepMounted
          className="flex min-h-0 flex-1 flex-col pt-4 data-hidden:hidden"
        >
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

              {/* The rail's origin is "now"; newest entries sit right below. */}
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
                <p className="text-[11px] tracking-wide text-muted-foreground/80 uppercase">
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
        </TabsContent>

        <TabsContent
          value="details"
          keepMounted
          className="flex min-h-0 flex-1 flex-col pt-4 data-hidden:hidden"
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="flex flex-col gap-7 pb-8">
              <DetailBlock label="Definition">
                <ThreadDefinitionSection thread={thread} />
              </DetailBlock>

              {isResolved ? (
                <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
                  <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                    <CircleCheck className="size-4 text-condition-healthy" />
                    This Thread is resolved
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Next move and follow-up are retired. Reopen it from the menu
                    above to plan again — the timeline stays intact either way.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-border bg-muted/25 px-3.5 py-3">
                    <NextMoveSection thread={thread} />
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/25 px-3.5 py-3">
                    <FollowUpSection thread={thread} />
                  </div>
                </>
              )}

              <DetailBlock label="Area">
                <AreaContext area={area} />
              </DetailBlock>

              <p className="text-[11px] text-muted-foreground/70">
                Opened {format(new Date(thread.createdAt), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DetailBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </h2>
      {children}
    </section>
  );
}

/** Read-only context for the owning Area — the move control lives in the
 *  header chip, so this block carries the standard instead of a second picker. */
function AreaContext({ area }: { area: ProjectedArea }) {
  const ConditionIcon = conditionIcons[area.condition];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
        <AreaIcon icon={area.icon} className="size-3.5 text-muted-foreground" />
        {area.name}
        <ConditionIcon
          aria-hidden
          className={cn("size-3.5", conditionTextClassName[area.condition])}
        />
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {area.standard ?? "No standard set for this Area yet."}
      </p>
    </div>
  );
}

/** Pinned to the floor of the Activity tab rather than sitting at the rail's
 *  origin — the timeline scrolls behind it and the input never moves. */
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
    <div className="relative shrink-0 pt-2">
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
          className={cn(
            "bg-muted/60",
            "has-[textarea]:rounded-4xl has-data-[align=block-end]:rounded-4xl",
          )}
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
