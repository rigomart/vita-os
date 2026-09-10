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

/** Held in place at rest, so the meta line never reflows on hover. */
const revealed =
  "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100";

/**
 * A Thread on the board.
 *
 * Each line means one thing on every card: the first is the Next Move, the
 * second the Thread it belongs to. A Thread with no move holds an em dash in
 * the first slot rather than promoting its title into it, so "nothing decided
 * here" stays legible at a glance. The Area is always the glyph, never a word.
 *
 * The controls live in the meta line beside the date, in `DashboardNote`'s
 * grammar — a row that already exists, so they cost the card no height. The
 * date is not one of them: it is the button that changes it.
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
          <WhenPopover
            when={followUp}
            onSetWhen={(when) =>
              void updateThread({ id: thread._id, followUp: when ?? null })
            }
            trigger={
              followUp === undefined ? (
                <ControlButton className={revealed} label="Set Follow-up">
                  <CalendarClock className="size-3.5" />
                </ControlButton>
              ) : (
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
              )
            }
          />

          {move && (
            <ControlButton
              label="Complete Next Move"
              onClick={() => void completeNextMove()}
              className={cn(
                revealed,
                "bg-muted hover:bg-condition-healthy/15 hover:text-condition-healthy",
              )}
            >
              <Check className="size-3.5" />
            </ControlButton>
          )}
        </span>
      </div>
    </div>
  );
}

/** The negative margin lets it stand taller than the meta text it sits on. */
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
        "relative z-10 -my-1 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-[color,background-color,transform,opacity] hover:bg-muted hover:text-foreground active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

function AreaGlyph({ area }: { area?: ProjectedArea }) {
  if (!area) return null;
  return (
    <span
      title={`${area.name} — ${conditionLabels[area.condition]}`}
      className={cn(
        "inline-flex shrink-0",
        conditionTextClassName[area.condition],
      )}
    >
      <AreaIcon icon={area.icon} className="size-3.5" />
    </span>
  );
}
