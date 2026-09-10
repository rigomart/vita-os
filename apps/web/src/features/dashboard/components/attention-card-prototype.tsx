/**
 * PROTOTYPE — throwaway. Delete with the rest of this branch.
 *
 * Two questions, one card:
 *
 * 1. Today the headline slot means *the Next Move* on one card and *the
 *    Thread title* on the next, with no mark to tell them apart — so a Thread
 *    that has decided nothing looks exactly like one with a crisp move.
 * 2. The complete/reschedule buttons float over the text on hover, and the
 *    date has to fade out to get out of their way. The controls should hold
 *    real space without eating the column's width.
 *
 * Four cards, switchable via `?card=A|B|C|D`:
 *
 *   A — Today          baseline, unchanged
 *   B — Marked         a checkbox marks a move; the date token *is* the date
 *                      button. No overlay, no hover-only chrome.
 *   C — Fixed slots    line 1 is always the move (or a prompt to set one),
 *                      line 2 always the Thread; controls in a reserved rail
 *   D — Title-led      the Thread always leads; the move is a second line
 *                      with its control inline at the end of it
 */
import type { ProjectedArea, ProjectedThread } from "@convex/lib/validators";

import { conditionLabels } from "@convex/lib/condition";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Check, Circle } from "lucide-react";
import { createContext, use } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { conditionTextClassName } from "@/features/areas/condition-presentation";
import { WhenPopover } from "@/features/attention-list";
import { useCompleteNextMove } from "@/features/threads/use-complete-next-move";
import { useUpdateThread } from "@/features/threads/use-update-thread";
import { cn } from "@/lib/utils";

import { dateToken, dateToneClassName, dayDelta } from "./dashboard-model";

export const CARDS = ["A", "B", "C", "D"] as const;
export type Card = (typeof CARDS)[number];

export const CARD_NAMES: Record<Card, string> = {
  A: "Today",
  B: "Marked",
  C: "Fixed slots",
  D: "Title-led",
};

const CardVariantContext = createContext<Card>("A");
export const CardVariantProvider = CardVariantContext.Provider;

interface CardProps {
  area?: ProjectedArea;
  currentDate: number;
  thread: ProjectedThread;
}

/** Dispatches to the selected variant so the board can stay variant-blind. */
export function AttentionCard(props: CardProps) {
  const variant = use(CardVariantContext);
  const Card = { A: CardA, B: CardB, C: CardC, D: CardD }[variant];
  return <Card {...props} />;
}

/** Everything the four cards share: the data, not the layout. */
function useCard({ currentDate, thread }: CardProps) {
  const completeNextMove = useCompleteNextMove(thread);
  const updateThread = useUpdateThread(thread);

  const move = thread.nextMove?.trim();
  const followUp = thread.followUp ?? undefined;

  return {
    complete: () => void completeNextMove(),
    followUp,
    late: followUp !== undefined && dayDelta(followUp, currentDate) < 0,
    move,
    setWhen: (when: number | undefined) =>
      void updateThread({ id: thread._id, followUp: when ?? null }),
  };
}

function Shell({
  children,
  className,
  late,
}: {
  children: React.ReactNode;
  className?: string;
  late: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60",
        late && "bg-condition-attention/[0.06]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The whole-card click target. Sits under the controls, which lift above it. */
function ThreadLink({
  children,
  className,
  cover,
  thread,
}: {
  children: React.ReactNode;
  className?: string;
  cover?: boolean;
  thread: ProjectedThread;
}) {
  return (
    <Link
      to="."
      search={(previous) => ({ ...previous, thread: thread.slug })}
      className={cn(
        "min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        cover && "after:absolute after:inset-0 after:content-['']",
        className,
      )}
    >
      {children}
    </Link>
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

function RailButton({
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
        "relative z-10 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ─── A — Today ───────────────────────────────────────────────────────────
 * Unchanged. The move takes the headline; with no move the title takes it
 * instead, in the same weight. Controls float over the text on hover and the
 * date fades out under them.
 */

export function CardA({ area, currentDate, thread }: CardProps) {
  const { complete, followUp, late, move, setWhen } = useCard({
    area,
    currentDate,
    thread,
  });

  return (
    <Shell late={late}>
      <div className="flex items-start gap-2">
        {!move && <AreaGlyph area={area} className="mt-1" />}
        <ThreadLink
          cover
          thread={thread}
          className="line-clamp-2 flex-1 text-sm leading-snug font-medium"
        >
          {move ?? thread.title}
        </ThreadLink>
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
            onClick={complete}
            className="bg-background/90 shadow-sm ring-1 ring-border/60"
          >
            <Check className="size-3.5" />
          </RailButton>
        )}
        <WhenPopover
          when={followUp}
          onSetWhen={setWhen}
          trigger={
            <RailButton
              label={
                followUp === undefined ? "Set Follow-up" : "Change Follow-up"
              }
              className="bg-background/90 shadow-sm ring-1 ring-border/60"
            >
              <CalendarClock className="size-3.5" />
            </RailButton>
          }
        />
      </div>
    </Shell>
  );
}

/* ─── B — Marked ──────────────────────────────────────────────────────────
 * The move keeps the headline, but it no longer relies on *position* to say
 * so: a checkbox in front of it marks it as a thing you can do, and a Thread
 * with no move shows a hollow dashed ring in the same slot — visibly "nothing
 * decided here" rather than a differently-worded headline.
 *
 * Both controls stop floating. The checkbox is the complete button, and the
 * **date token itself is the reschedule button** — the thing it changes is
 * the thing you click, so nothing has to fade out to make room. An undated
 * Thread keeps the slot with a faint dash, so the right edge never jitters.
 */

export function CardB({ area, currentDate, thread }: CardProps) {
  const { complete, followUp, late, move, setWhen } = useCard({
    area,
    currentDate,
    thread,
  });

  return (
    <Shell late={late}>
      <div className="flex items-start gap-2">
        {move ? (
          <RailButton
            label="Complete Next Move"
            onClick={complete}
            className="-ml-1 size-5 shrink-0 text-muted-foreground/50 hover:text-condition-healthy"
          >
            <span className="flex size-3.5 items-center justify-center rounded-[4px] ring-1 ring-current transition-colors">
              <Check className="size-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
          </RailButton>
        ) : (
          <span
            aria-hidden
            title="No Next Move decided"
            className="-ml-1 flex size-5 shrink-0 items-center justify-center text-muted-foreground/30"
          >
            <Circle className="size-3 [stroke-dasharray:2_2]" />
          </span>
        )}

        <ThreadLink
          cover
          thread={thread}
          className={cn(
            "line-clamp-2 flex-1 text-sm leading-snug",
            move ? "font-medium" : "text-muted-foreground",
          )}
        >
          {move ?? thread.title}
        </ThreadLink>

        <WhenPopover
          when={followUp}
          onSetWhen={setWhen}
          trigger={
            <button
              type="button"
              aria-label={
                followUp === undefined ? "Set Follow-up" : "Change Follow-up"
              }
              className={cn(
                "relative z-10 -mr-1 shrink-0 rounded px-1 py-0.5 text-[11px] tabular-nums transition-colors hover:bg-background/80 focus-visible:ring-2 focus-visible:ring-ring/40",
                followUp === undefined
                  ? "text-muted-foreground/30 hover:text-muted-foreground"
                  : dateToneClassName(followUp, currentDate),
              )}
            >
              {followUp === undefined ? "–" : dateToken(followUp, currentDate)}
            </button>
          }
        />
      </div>

      {move && (
        <p className="mt-0.5 flex items-center gap-1.5 pl-6 text-[12px] leading-snug text-muted-foreground/75">
          <AreaGlyph area={area} />
          <span className="truncate">{thread.title}</span>
        </p>
      )}
      {!move && (
        <p className="mt-0.5 flex items-center gap-1.5 pl-6 text-[12px] leading-snug text-muted-foreground/50">
          <AreaGlyph area={area} />
          <span className="truncate italic">No Next Move</span>
        </p>
      )}
    </Shell>
  );
}

/* ─── C — Fixed slots ─────────────────────────────────────────────────────
 * Each line means one thing on every card, always. Line 1 is the Next Move —
 * and when there isn't one, it holds a button that says so and offers to set
 * it, rather than borrowing the title. Line 2 is always the Thread.
 *
 * The controls get a reserved rail down the right: a fixed 24px column that
 * always occupies space, holding two stacked buttons that sit at low contrast
 * until the card is pointed at. The date lives inline on line 2, so it never
 * has to move aside for them.
 */

export function CardC({ area, currentDate, thread }: CardProps) {
  const { complete, followUp, late, move, setWhen } = useCard({
    area,
    currentDate,
    thread,
  });

  return (
    <Shell late={late} className="flex gap-1.5">
      <div className="min-w-0 flex-1">
        {move ? (
          <ThreadLink
            cover
            thread={thread}
            className="line-clamp-2 block text-sm leading-snug font-medium"
          >
            {move}
          </ThreadLink>
        ) : (
          <ThreadLink
            cover
            thread={thread}
            className="block text-sm leading-snug text-muted-foreground/60 italic"
          >
            Decide a Next Move
          </ThreadLink>
        )}

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
          <RailButton label="Complete Next Move" onClick={complete}>
            <Check className="size-3.5" />
          </RailButton>
        )}
        <WhenPopover
          when={followUp}
          onSetWhen={setWhen}
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
    </Shell>
  );
}

/* ─── D — Title-led ───────────────────────────────────────────────────────
 * The opposite bet: the headline always answers *which Thread*, so the top
 * line never changes meaning. The move drops to the second line behind an
 * arrow, with its complete button inline at the end of that line — the
 * control belongs to the move, so it sits with the move rather than in the
 * card's corner. A Thread with no move simply has no second line, which is
 * itself the signal.
 */

export function CardD({ area, currentDate, thread }: CardProps) {
  const { complete, followUp, late, move, setWhen } = useCard({
    area,
    currentDate,
    thread,
  });

  return (
    <Shell late={late}>
      <div className="flex items-start gap-2">
        <AreaGlyph area={area} className="mt-0.5" />
        <ThreadLink
          cover
          thread={thread}
          className="line-clamp-2 flex-1 text-[13px] leading-snug font-medium"
        >
          {thread.title}
        </ThreadLink>
        <WhenPopover
          when={followUp}
          onSetWhen={setWhen}
          trigger={
            <button
              type="button"
              aria-label={
                followUp === undefined ? "Set Follow-up" : "Change Follow-up"
              }
              className={cn(
                "relative z-10 -mr-1 shrink-0 rounded px-1 text-[11px] tabular-nums transition-colors hover:bg-background/80 focus-visible:ring-2 focus-visible:ring-ring/40",
                followUp === undefined
                  ? "text-muted-foreground/30 hover:text-muted-foreground"
                  : dateToneClassName(followUp, currentDate),
              )}
            >
              {followUp === undefined ? "–" : dateToken(followUp, currentDate)}
            </button>
          }
        />
      </div>

      {move && (
        <div className="mt-1 flex items-start gap-1.5 pl-5.5">
          <span aria-hidden className="text-muted-foreground/40">
            →
          </span>
          <span className="min-w-0 flex-1 text-[13px] leading-snug">
            {move}
          </span>
          <RailButton
            label="Complete Next Move"
            onClick={complete}
            className="-my-0.5 size-5 shrink-0 opacity-40 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          >
            <Check className="size-3.5" />
          </RailButton>
        </div>
      )}
    </Shell>
  );
}
