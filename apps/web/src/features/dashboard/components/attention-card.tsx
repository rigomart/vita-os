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
 * **Each line means one thing on every card.** The first line is the Next
 * Move and only ever the Next Move; the second is the Thread it belongs to.
 * Letting the title climb into the headline when there was no move meant the
 * strongest line on the card said "here is what to do" on one card and "here
 * is a Thread" on the next, with nothing to tell them apart — so a Thread that
 * has decided nothing looked exactly like one with a crisp move. When there is
 * no move the slot holds an em dash instead: the table convention for *nothing
 * here*, quiet enough to scan past and unmistakably not a sentence to act on.
 * The Area is always the glyph, never a word.
 *
 * **The controls hold real space.** They live in a reserved rail down the
 * right rather than floating over the text, so nothing is ever covered and the
 * date never has to fade out to make room for them. The rail is a fixed 24px —
 * about a word of the column's width — and rests at low contrast until the
 * card is pointed at, so a still board is only its content.
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
        "group relative flex gap-1.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60",
        late && "bg-condition-attention/[0.06]",
      )}
    >
      <div className="min-w-0 flex-1">
        <Link
          to="."
          search={(previous) => ({ ...previous, thread: thread.slug })}
          className={cn(
            "block min-w-0 text-sm leading-snug outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/40",
            move ? "line-clamp-2 font-medium" : "text-muted-foreground/40",
          )}
        >
          {move ?? (
            <>
              <span aria-hidden>—</span>
              <span className="sr-only">No Next Move</span>
            </>
          )}
        </Link>

        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-snug text-muted-foreground/75">
          <AreaGlyph area={area} />
          <span className="truncate">{thread.title}</span>
          {followUp !== undefined && (
            <time
              dateTime={new Date(followUp).toISOString()}
              className={cn(
                "ml-auto shrink-0 pl-1 tabular-nums",
                dateToneClassName(followUp, currentDate),
              )}
            >
              {dateToken(followUp, currentDate)}
            </time>
          )}
        </p>
      </div>

      <div className="flex w-6 shrink-0 flex-col items-center gap-0.5 opacity-35 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
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
      className="relative z-10 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
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
