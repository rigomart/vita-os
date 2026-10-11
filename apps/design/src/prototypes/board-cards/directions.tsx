import type { ReactNode } from "react";

import { cn } from "@vita-os/ui/lib/utils";
import { Spool, StickyNote } from "lucide-react";

import type { CardSet } from "./board";

import {
  footerText,
  NoteControls,
  ThreadControls,
  useNoteCard,
  useThreadCard,
  type NoteCardProps,
  type ThreadCard,
  type ThreadCardProps,
} from "./parts";

/* Shared looks */

/** The shipped card's frame: none, filled on hover. */
const frameless =
  "group/card relative rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/60 has-focus-visible:bg-muted/60";

/** The shipped late tint, which a card on Late's fill drops. */
function tint(late: boolean, onLateFill: boolean) {
  return late && !onLateFill && "bg-condition-attention/[0.06]";
}

/** A card standing on the fill as a sheet of its own. */
const sheet =
  "group/card relative rounded-xl border border-border/80 bg-card px-3 py-2.5 transition-colors hover:border-foreground/15 has-focus-visible:border-ring/50";

function sheetTint(late: boolean, onLateFill: boolean) {
  return (
    late &&
    !onLateFill &&
    "bg-[color-mix(in_oklab,var(--color-condition-attention)_7%,var(--color-card))]"
  );
}

/** The task slot: its marker, then its words. */
function TaskLine({ card }: { card: ThreadCard }) {
  return (
    <div className="flex items-start gap-1.5 text-[13px] leading-snug">
      <Glyph className="h-[1.1rem] w-3">{card.marker}</Glyph>
      <span className="line-clamp-3 min-w-0 flex-1">{card.taskText}</span>
    </div>
  );
}

function Glyph({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center", className)}
    >
      {children}
    </span>
  );
}

/** The shipped footer: date, placed date and Area left, controls right. */
function ThreadFooter({ card }: { card: ThreadCard }) {
  return (
    <div className={cn(footerText, "mt-0.5")}>
      {card.showsDate && card.date}
      {card.placedDate}
      {card.tag}
      <ThreadControls card={card} />
    </div>
  );
}

function NoteFooter({ card }: { card: ReturnType<typeof useNoteCard> }) {
  return (
    <div className={cn(footerText, "mt-0.5")}>
      {card.showsDate && card.date}
      <NoteControls card={card} />
    </div>
  );
}

/* A. Kind gutter */

/**
 * Both cards keep the shipped frame and rows, with a narrow gutter on the
 * left that says what each one is: a spool for a Thread, a sticky note for a
 * Note. The task marker drops into the same gutter, so the words above and
 * below share one left edge.
 */
export const gutter: CardSet = {
  Thread: (props: ThreadCardProps) => {
    const card = useThreadCard(props);
    return (
      <div
        className={cn(
          frameless,
          "grid grid-cols-[0.875rem_minmax(0,1fr)] gap-x-2.5 gap-y-1",
          tint(card.late, props.onLateFill),
        )}
      >
        <Glyph className="h-[1.2rem]">
          <Spool className="size-3.5 text-foreground/55" />
        </Glyph>
        {card.title()}
        {card.hasTasks && (
          <>
            <Glyph className="h-[1.1rem]">{card.marker}</Glyph>
            <span className="line-clamp-3 min-w-0 text-[13px] leading-snug">
              {card.taskText}
            </span>
          </>
        )}
        <div className="col-start-2">
          <ThreadFooter card={card} />
        </div>
      </div>
    );
  },
  Note: (props: NoteCardProps) => {
    const card = useNoteCard(props);
    return (
      <div
        className={cn(
          frameless,
          "grid grid-cols-[0.875rem_minmax(0,1fr)] gap-x-2.5 gap-y-1",
          tint(card.late, props.onLateFill),
        )}
      >
        <Glyph className="h-[1.2rem]">
          <StickyNote className="size-3.5 text-muted-foreground/80" />
        </Glyph>
        {card.body()}
        <div className="col-start-2">
          <NoteFooter card={card} />
        </div>
      </div>
    );
  },
  mark: (kind) =>
    kind === "note" ? (
      <StickyNote
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground/80"
      />
    ) : (
      <Spool aria-hidden className="size-3.5 shrink-0 text-foreground/55" />
    ),
};

/* B. Eyebrow */

/**
 * Every card opens on a small eyebrow: a Thread's Area, or the word Note —
 * only the exception is named, since most of the board is Threads — with the
 * date flush right and the controls appearing beside it. Below it the words
 * have the card to themselves: the title then the task slot, or a Note's
 * body over three lines.
 */
export const eyebrow: CardSet = {
  Thread: (props: ThreadCardProps) => {
    const card = useThreadCard(props);
    return (
      <div
        className={cn(
          frameless,
          "flex flex-col gap-1 pt-2",
          tint(card.late, props.onLateFill),
        )}
      >
        <div className={footerText}>
          {card.tag}
          <span className="ml-auto flex items-center gap-1.5">
            <ThreadControls card={card} />
            {card.showsDate && card.date}
            {card.placedDate}
          </span>
        </div>
        {card.title("text-[15px] font-semibold tracking-[-0.005em]")}
        {card.hasTasks && <TaskLine card={card} />}
      </div>
    );
  },
  Note: (props: NoteCardProps) => {
    const card = useNoteCard(props);
    return (
      <div
        className={cn(
          frameless,
          "flex flex-col gap-1 pt-2",
          tint(card.late, props.onLateFill),
        )}
      >
        <div className={footerText}>
          <Kind icon={<StickyNote className="size-3" />} label="Note" />
          <span className="ml-auto flex items-center gap-1.5">
            <NoteControls card={card} />
            {card.showsDate && card.date}
          </span>
        </div>
        {card.body("line-clamp-3 text-[14px]")}
      </div>
    );
  },
};

function Kind({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold tracking-wide text-muted-foreground/80 uppercase">
      {icon}
      {label}
    </span>
  );
}

/* C. Sheets in the folder */

/**
 * The file tabs become folders and every item a sheet filed in one: both
 * cards stand on the fill with an edge of their own. A Note's sheet is
 * dog-eared at the top right, the one mark of a scrap of paper.
 */
export const sheets: CardSet = {
  gap: "gap-1.5",
  Thread: (props: ThreadCardProps) => {
    const card = useThreadCard(props);
    return (
      <div
        className={cn(
          sheet,
          "flex flex-col gap-1",
          sheetTint(card.late, props.onLateFill),
        )}
      >
        {card.title()}
        {card.hasTasks && <TaskLine card={card} />}
        <ThreadFooter card={card} />
      </div>
    );
  },
  Note: (props: NoteCardProps) => {
    const card = useNoteCard(props);
    return (
      <div
        className={cn(
          sheet,
          "flex flex-col gap-1 [clip-path:polygon(0_0,calc(100%-18px)_0,100%_18px,100%_100%,0_100%)]",
          sheetTint(card.late, props.onLateFill),
        )}
      >
        <span
          aria-hidden
          className="absolute top-0 right-0 size-[18px] rounded-bl-[4px] bg-[linear-gradient(to_bottom_left,transparent_calc(50%-0.5px),var(--color-border)_50%,var(--color-surface-3)_calc(50%+0.5px))]"
        />
        {card.body("pr-4")}
        <NoteFooter card={card} />
      </div>
    );
  },
};

/* D. Kept and loose */

/**
 * A Thread is something held, a Note something caught: the Thread stands as
 * a solid sheet, the Note as a dashed outline with nothing filled in, until
 * it is hovered.
 */
export const keptAndLoose: CardSet = {
  gap: "gap-1.5",
  Thread: sheets.Thread,
  Note: (props: NoteCardProps) => {
    const card = useNoteCard(props);
    return (
      <div
        className={cn(
          frameless,
          "flex flex-col gap-1 border border-dashed border-muted-foreground/35 hover:border-muted-foreground/50",
          tint(card.late, props.onLateFill),
        )}
      >
        {card.body()}
        <NoteFooter card={card} />
      </div>
    );
  },
};

/* E. Threaded */

/**
 * A Thread draws its name: a knot at the title, and a line from it down to
 * the task it leads to. A Note has no thread to draw, so it sits on a quiet
 * slip of its own instead, flat and filled.
 */
export const threaded: CardSet = {
  Thread: (props: ThreadCardProps) => {
    const card = useThreadCard(props);
    return (
      <div
        className={cn(
          frameless,
          "grid grid-cols-[0.75rem_minmax(0,1fr)] gap-x-2.5 gap-y-1",
          tint(card.late, props.onLateFill),
        )}
      >
        <span aria-hidden className="relative flex h-[1.2rem] justify-center">
          <span className="mt-[0.4rem] size-1.5 rounded-full bg-foreground/55" />
          {card.hasTasks && (
            <span className="absolute top-[calc(0.4rem+9px)] -bottom-1 left-1/2 w-px -translate-x-1/2 bg-foreground/20" />
          )}
        </span>
        {card.title()}
        {card.hasTasks && (
          <>
            <span
              aria-hidden
              className="relative flex h-[1.1rem] items-center justify-center before:absolute before:top-0 before:bottom-[calc(50%+7px)] before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-foreground/20"
            >
              <span className="relative flex">{card.marker}</span>
            </span>
            <span className="line-clamp-3 min-w-0 text-[13px] leading-snug">
              {card.taskText}
            </span>
          </>
        )}
        <div className="col-start-2">
          <ThreadFooter card={card} />
        </div>
      </div>
    );
  },
  Note: (props: NoteCardProps) => {
    const card = useNoteCard(props);
    return (
      <div
        className={cn(
          "group/card relative flex flex-col gap-1 rounded-xl bg-muted/55 px-3 py-2.5 transition-colors hover:bg-muted has-focus-visible:bg-muted",
          card.late &&
            !props.onLateFill &&
            "bg-[color-mix(in_oklab,var(--color-condition-attention)_10%,var(--color-muted))]",
        )}
      >
        {card.body()}
        <NoteFooter card={card} />
      </div>
    );
  },
  mark: (kind) =>
    kind === "note" ? (
      <span
        aria-hidden
        className="h-2 w-2.5 shrink-0 rounded-[2px] bg-muted-foreground/35"
      />
    ) : (
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-foreground/55"
      />
    ),
};
