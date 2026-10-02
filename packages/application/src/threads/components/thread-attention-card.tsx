import type { AreaSummary, Move, MoveId, Thread } from "@vita-os/contracts";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { leadMove } from "@vita-os/core";
import { cn } from "@vita-os/ui/lib/utils";
import { ListTodo } from "lucide-react";

import type { ProductSearch } from "../../navigation/search-params";

import { AreaIcon } from "../../areas/components/area-icon";
import {
  BoardCard,
  BoardCompleteButton,
  BoardDate,
  BoardTag,
  concealed,
  isLate,
  revealed,
  showsBoardDate,
} from "../../dashboard/components/board-card";
import { useCompleteMove } from "../use-moves";
import { useUpdateThread } from "../use-update-thread";

/** Past this many Moves the pips stop growing and a count takes over. */
const MAX_PIPS = 6;

/**
 * One Thread on the board, in the three rows every `BoardCard` keeps.
 *
 * The first is always the Thread's title, so a card reads the same whether or
 * not a Move is focused. The second is the move slot: the Focused Move, else
 * the only Move, else — with several Moves and none focused — just how many
 * there are, because the card must not invent a headline the person never
 * chose. A Thread with no Moves has no second row. The footer holds the
 * Follow-up and Area, so neither crowds the words above it.
 *
 * The footer completes only the Move the slot shows. Focusing, removing, and
 * choosing among Moves happen in Thread detail, where every Move is in view.
 */
export function ThreadAttentionCard({
  actions,
  area,
  currentDate,
  dateInHeading = false,
  onCompleteMove,
  onSetFollowUp,
  onTray,
  thread,
}: {
  actions?: ReactNode;
  area?: AreaSummary;
  currentDate: number;
  /** The group heading above already names this Thread's day. */
  dateInHeading?: boolean;
  onCompleteMove: (moveId: MoveId) => void;
  onSetFollowUp: (when: number | undefined) => void;
  onTray?: boolean;
  thread: Thread;
}) {
  const moves = thread.moves ?? [];
  const lead = leadMove(thread);
  const focused = lead !== undefined && lead._id === thread.focusedMoveId;
  const followUp = thread.followUp ?? undefined;
  const showsDate = showsBoardDate(followUp, dateInHeading);
  const followUpDate = (
    <BoardDate
      currentDate={currentDate}
      inHeading={dateInHeading}
      onSetWhen={onSetFollowUp}
      when={followUp}
    />
  );

  return (
    <BoardCard
      late={isLate(followUp, currentDate)}
      onTray={onTray}
      footer={
        <>
          {showsDate && followUpDate}
          {area && (
            <BoardTag
              icon={<AreaIcon icon={area.icon} className="size-3 shrink-0" />}
              label={area.name}
            />
          )}

          {/* The pips and the controls share one slot, both flush right: the
              pips hold it at rest and hand it to the controls on hover, so
              neither floats in the space the other keeps. Pips only follow a
              Move the card shows; with none focused, the move slot already
              says how many there are. */}
          <span className="ml-auto grid shrink-0 justify-items-end pl-1 *:col-start-1 *:row-start-1">
            {moves.length > 1 && focused && (
              <MovePips
                className={cn("self-center", concealed)}
                moves={moves}
                focusedMoveId={lead._id}
              />
            )}
            <span className="flex items-center gap-1.5">
              {!showsDate && followUpDate}
              {lead !== undefined && (
                <BoardCompleteButton
                  label={`Complete “${lead.text}”`}
                  onClick={() => onCompleteMove(lead._id)}
                />
              )}
              {actions && (
                <span className={cn("relative z-10 flex", revealed)}>
                  {actions}
                </span>
              )}
            </span>
          </span>
        </>
      }
    >
      <Link
        to="."
        search={(previous: ProductSearch): ProductSearch => ({
          ...previous,
          thread: thread.slug,
        })}
        className="line-clamp-2 min-w-0 text-sm leading-snug font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {thread.title}
      </Link>

      {moves.length > 0 && (
        <div className="flex items-start gap-1.5 text-[13px] leading-snug">
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
            <span className="line-clamp-3 min-w-0 flex-1 text-foreground/75">
              <span className="sr-only">
                {focused ? "Focused Move: " : "Move: "}
              </span>
              {lead.text}
            </span>
          )}
        </div>
      )}
    </BoardCard>
  );
}

export function ConnectedThreadAttentionCard({
  area,
  currentDate,
  dateInHeading,
  onTray,
  thread,
}: {
  area?: AreaSummary;
  currentDate: number;
  dateInHeading?: boolean;
  onTray?: boolean;
  thread: Thread;
}) {
  const completeMove = useCompleteMove(thread);
  const updateThread = useUpdateThread(thread);

  return (
    <ThreadAttentionCard
      area={area}
      currentDate={currentDate}
      dateInHeading={dateInHeading}
      onTray={onTray}
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
 * It says there is more to the Thread than the Focused Move the card shows,
 * without listing any of it.
 */
function MovePips({
  className,
  focusedMoveId,
  moves,
}: {
  className?: string;
  focusedMoveId: MoveId;
  moves: readonly Move[];
}) {
  const label = `${moves.length} moves, one focused`;
  const overflow = moves.length - MAX_PIPS;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("inline-flex items-center gap-[3px]", className)}
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
