import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";

import { conditionLabels } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Check } from "lucide-react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { conditionTextClassName } from "@/features/areas/condition-presentation";
import { WhenPopover } from "@/features/attention-list";
import { useCompleteNextMove } from "@/features/threads/use-complete-next-move";
import { useUpdateThread } from "@/features/threads/use-update-thread";
import { cn } from "@/lib/utils";

import { dateToken, dateToneClassName, dayDelta } from "./dashboard-model";

/**
 * A Thread on the board.
 *
 * The **Next Move leads**: it is the most relevant thing the Thread can say,
 * so it takes the headline and the Thread's own name drops to a second line.
 * When there is no move the title takes the headline instead — and then there
 * is no second line at all, because the Area name in that slot reads as a
 * title and would sit exactly where the neighbouring card's title sits. The
 * Area is always the glyph, never a word.
 *
 * The card is inert until pointed at: the actions fade in on hover or keyboard
 * focus, so a still board is only its content.
 */
export function AttentionCard({
  area,
  currentDate,
  thread,
}: {
  area?: ProjectedArea;
  currentDate: number;
  thread: ProjectedThread;
}) {
  const completeNextMove = useCompleteNextMove(thread);
  const updateThread = useUpdateThread(thread);

  const move = thread.nextMove?.trim();
  const followUp = thread.followUp ?? undefined;
  const late = followUp !== undefined && dayDelta(followUp, currentDate) < 0;

  return (
    <div
      className={cn(
        "group relative rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60",
        late && "bg-condition-attention/[0.06]",
      )}
    >
      <div className="flex items-start gap-2">
        {/* With no second line, the glyph rides the headline instead. */}
        {!move && <AreaGlyph area={area} className="mt-1" />}

        <Link
          to="."
          search={(previous) => ({ ...previous, thread: thread.slug })}
          className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {move ?? thread.title}
        </Link>

        {followUp !== undefined && (
          <time
            dateTime={new Date(followUp).toISOString()}
            className={cn(
              "mt-0.5 shrink-0 text-[11px] tabular-nums transition-opacity group-hover:opacity-0 group-focus-within:opacity-0",
              dateToneClassName(followUp, currentDate),
            )}
          >
            {dateToken(followUp, currentDate)}
          </time>
        )}
      </div>

      {move && (
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-snug text-muted-foreground/75">
          <AreaGlyph area={area} />
          <span className="truncate">{thread.title}</span>
        </p>
      )}

      <div className="pointer-events-none absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
        {move && (
          <RailButton
            label="Complete Next Move"
            onClick={() => void completeNextMove()}
          >
            <Check className="size-3.5" />
          </RailButton>
        )}
        <WhenPopover
          when={followUp}
          onSetWhen={(when) =>
            void updateThread({ id: thread._id, followUp: when ?? null })
          }
          trigger={
            <RailButton
              label={
                followUp === undefined ? "Set Follow-up" : "Change Follow-up"
              }
            >
              <CalendarClock className="size-3.5" />
            </RailButton>
          }
        />
      </div>
    </div>
  );
}

function RailButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-6 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border/60 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {children}
    </button>
  );
}

function AreaGlyph({
  area,
  className,
}: {
  area?: ProjectedArea;
  className?: string;
}) {
  if (!area) return null;
  return (
    <span
      title={`${area.name} — ${conditionLabels[area.condition]}`}
      className={cn(
        "inline-flex shrink-0",
        conditionTextClassName[area.condition],
        className,
      )}
    >
      <AreaIcon icon={area.icon} className="size-3.5" />
    </span>
  );
}
