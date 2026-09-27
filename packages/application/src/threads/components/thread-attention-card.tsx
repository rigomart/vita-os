import type { AreaSummary, Move, MoveId, Thread } from "@vita-os/contracts";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { leadMove } from "@vita-os/core";
import { cn } from "@vita-os/ui/lib/utils";
import { CalendarClock, Check, ListTodo } from "lucide-react";

import type { ProductSearch } from "../../navigation/search-params";

import { AreaIcon } from "../../areas/components/area-icon";
import { WhenPopover } from "../../attention-list";
import {
  dateToken,
  dateToneClassName,
  dayDelta,
} from "../../dashboard/components/dashboard-model";
import { useCompleteMove } from "../use-moves";
import { useUpdateThread } from "../use-update-thread";

const revealed =
  "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100";

/** Past this many Moves the pips stop growing and a count takes over. */
const MAX_PIPS = 6;

/**
 * One Thread on the board, in two fixed rows that never trade places.
 *
 * The first is always the Thread's title, so a card reads the same whether or
 * not a Move is focused. The second is the move slot: the Focused Move, else
 * the only Move, else — with several Moves and none focused — just how many
 * there are, because the card must not invent a headline the person never
 * chose. A Thread with no Moves is its title alone.
 *
 * The rail completes only the Move the slot shows. Focusing, removing, and
 * choosing among Moves happen in Thread detail, where every Move is in view.
 */
export function ThreadAttentionCard({
  actions,
  area,
  currentDate,
  onCompleteMove,
  onSetFollowUp,
  thread,
}: {
  actions?: ReactNode;
  area?: AreaSummary;
  currentDate: number;
  onCompleteMove: (moveId: MoveId) => void;
  onSetFollowUp: (when: number | undefined) => void;
  thread: Thread;
}) {
  const moves = thread.moves ?? [];
  const lead = leadMove(thread);
  const focused = lead !== undefined && lead._id === thread.focusedMoveId;
  const followUp = thread.followUp ?? undefined;
  const late = followUp !== undefined && dayDelta(followUp, currentDate) < 0;

  return (
    <div
      className={cn(
        "group relative rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60",
        late && "bg-condition-attention/[0.06]",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Link
          to="."
          search={(previous: ProductSearch): ProductSearch => ({
            ...previous,
            thread: thread.slug,
          })}
          className="min-w-0 flex-1 truncate text-sm leading-snug font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {thread.title}
        </Link>

        <span className="flex shrink-0 items-center gap-1 pl-1 text-[12px] leading-snug text-muted-foreground/75">
          <AreaTag area={area} />
          <WhenPopover
            when={followUp}
            onSetWhen={onSetFollowUp}
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
                    "relative z-10 -my-0.5 inline-flex items-center gap-1 rounded-full px-1 py-0.5 tabular-nums transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40",
                    dateToneClassName(followUp, currentDate),
                  )}
                >
                  <CalendarClock aria-hidden className="size-3" />
                  {dateToken(followUp, currentDate)}
                </button>
              )
            }
          />
          {actions && (
            <span className={cn("relative z-10 flex", revealed)}>
              {actions}
            </span>
          )}
        </span>
      </div>

      {moves.length > 0 && (
        <div className="mt-1 flex items-start gap-1.5 text-[13px] leading-snug">
          <span
            aria-hidden
            className="flex h-[1.1rem] w-3 shrink-0 items-center justify-center"
          >
            {lead === undefined ? (
              <ListTodo className="size-3 text-muted-foreground/60" />
            ) : (
              <MoveMarker focused={focused} />
            )}
          </span>

          {lead === undefined ? (
            <span className="min-w-0 flex-1 text-muted-foreground/80">
              {moves.length} moves · none focused
            </span>
          ) : (
            <span className="line-clamp-2 min-w-0 flex-1 text-foreground/75">
              <span className="sr-only">
                {focused ? "Focused Move: " : "Move: "}
              </span>
              {lead.text}
            </span>
          )}

          <span className="flex h-[1.1rem] shrink-0 items-center gap-1.5 pl-1">
            {moves.length > 1 && (
              <MovePips moves={moves} focusedMoveId={thread.focusedMoveId} />
            )}
            {lead !== undefined && (
              <ControlButton
                label={`Complete “${lead.text}”`}
                onClick={() => onCompleteMove(lead._id)}
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
      )}
    </div>
  );
}

export function ConnectedThreadAttentionCard({
  area,
  currentDate,
  thread,
}: {
  area?: AreaSummary;
  currentDate: number;
  thread: Thread;
}) {
  const completeMove = useCompleteMove(thread);
  const updateThread = useUpdateThread(thread);

  return (
    <ThreadAttentionCard
      area={area}
      currentDate={currentDate}
      thread={thread}
      onCompleteMove={(moveId) => void completeMove(moveId)}
      onSetFollowUp={(when) => void updateThread({ followUp: when ?? null })}
    />
  );
}

/** Filled for the Focused Move, hollow for an only Move nobody focused. */
function MoveMarker({ focused }: { focused: boolean }) {
  return (
    <span
      className={cn(
        "size-2 rounded-full",
        focused
          ? "bg-brand-accent-strong ring-2 ring-brand-accent/25"
          : "border border-muted-foreground/55",
      )}
    />
  );
}

/**
 * A quiet count of the Thread's Moves: one pip each, the focused one filled.
 * It says there is more to the Thread without listing any of it.
 */
function MovePips({
  focusedMoveId,
  moves,
}: {
  focusedMoveId?: MoveId;
  moves: readonly Move[];
}) {
  const focused = moves.some((move) => move._id === focusedMoveId);
  const label = `${moves.length} moves, ${focused ? "one focused" : "none focused"}`;
  const overflow = moves.length - MAX_PIPS;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-[3px]"
    >
      {moves.slice(0, MAX_PIPS).map((move) => (
        <span
          key={move._id}
          className={cn(
            "size-1.5 rounded-full",
            move._id === focusedMoveId
              ? "bg-brand-accent-strong"
              : "border border-muted-foreground/50",
          )}
        />
      ))}
      {overflow > 0 && (
        <span className="text-[11px] tabular-nums text-muted-foreground/70">
          +{overflow}
        </span>
      )}
    </span>
  );
}

function ControlButton({
  children,
  className,
  label,
  onClick,
}: {
  children: ReactNode;
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

/**
 * The Thread's Area as a quiet label: icon and name, in the card's own muted
 * ink. Colour on the board belongs to time, so the tag never carries any.
 * An unlabeled Thread shows nothing — a missing label is not a problem.
 */
function AreaTag({ area }: { area?: AreaSummary }) {
  if (!area) return null;
  return (
    <span
      title={area.name}
      className="inline-flex max-w-28 shrink-0 items-center gap-1 rounded-full bg-muted/70 px-1.5 py-px text-[11px] text-muted-foreground"
    >
      <AreaIcon icon={area.icon} className="size-3 shrink-0" />
      <span className="truncate">{area.name}</span>
    </span>
  );
}
