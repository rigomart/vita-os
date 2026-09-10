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
 * **The controls sit in the footer beside the date**, in the same grammar as
 * `DashboardNote`: the meta line already exists on every card, so the buttons
 * cost the card no height, and they hold their space whether shown or not, so
 * nothing is covered and nothing shifts when the pointer arrives. A rail down
 * the side was two buttons tall — taller than the two lines of text it stood
 * next to — and stretched every card with a move to fit its own chrome. The
 * date is not one of those controls: it *is* its own button, because a date
 * shown beside a button that changes it says the same thing twice.
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

      <div className="mt-1 flex items-center gap-1.5 text-[12px] leading-snug text-muted-foreground/75">
        <AreaGlyph area={area} />
        <span className="truncate">{thread.title}</span>

        <span className="ml-auto flex shrink-0 items-center gap-1 pl-1">
          {/* The date is the button that changes it — showing it and then
              offering a separate control for it says the same thing twice. */}
          {followUp !== undefined && (
            <WhenPopover
              when={followUp}
              onSetWhen={(when) =>
                void updateThread({ id: thread._id, followUp: when ?? null })
              }
              trigger={
                <button
                  type="button"
                  aria-label="Change Follow-up"
                  className={cn(
                    "relative z-10 -my-0.5 rounded-full px-1 py-0.5 tabular-nums transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40",
                    dateToneClassName(followUp, currentDate),
                  )}
                >
                  {dateToken(followUp, currentDate)}
                </button>
              }
            />
          )}

          {/* The controls keep their space at rest, so the meta line neither
              reflows nor grows when the card is pointed at. */}
          <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            {followUp === undefined && (
              <WhenPopover
                when={followUp}
                onSetWhen={(when) =>
                  void updateThread({ id: thread._id, followUp: when ?? null })
                }
                trigger={
                  <ControlButton label="Set Follow-up">
                    <CalendarClock className="size-3.5" />
                  </ControlButton>
                }
              />
            )}
            {move && (
              <ControlButton
                label="Complete Next Move"
                onClick={() => void completeNextMove()}
                className="bg-muted hover:bg-condition-healthy/15 hover:text-condition-healthy"
              >
                <Check className="size-3.5" />
              </ControlButton>
            )}
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * A control on the card's footer, in `DashboardNote`'s shape: a round target
 * that fills on hover. The negative margin lets it stand taller than the meta
 * text it sits on without pushing the line open.
 */
function ControlButton({
  children,
  className,
  label,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "relative z-10 -my-1 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-[color,background-color,transform] hover:bg-muted hover:text-foreground active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
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
