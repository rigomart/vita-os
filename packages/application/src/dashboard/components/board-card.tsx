import type { ReactNode } from "react";

import { cn } from "@vita-os/ui/lib/utils";
import { CalendarClock, Check } from "lucide-react";

import {
  followUpDateLabels,
  timeToken,
  WhenPopover,
  withTimeToken,
} from "../../attention-list";
import { dateToken, dateToneClassName, dayDelta } from "./dashboard-model";

/** Held in place at rest, so the footer never reflows on hover. */
export const revealed =
  "opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100";

/** The other half of `revealed`: shown at rest, handing its place to controls. */
export const concealed =
  "transition-opacity group-focus-within/card:opacity-0 group-hover/card:opacity-0";

/**
 * The one shape every item on the board takes, Thread or Note: a quiet row
 * with no frame, filled only on hover, in three rows that never trade places.
 * The first two carry the words — the headline, then what is next — each with
 * the full width to itself. The third is the footer: when and where on the
 * left, the controls on the right.
 *
 * On the No date tray the row lifts to the page's surface instead of sinking
 * into the tray's fill.
 *
 * A `ruled` card carries a short margin rule inside its left padding: the mark
 * of a thing someone wrote, where a pill would read as one more Area.
 */
export function BoardCard({
  children,
  footer,
  late = false,
  onTray = false,
  ruled = false,
}: {
  children: ReactNode;
  footer: ReactNode;
  late?: boolean;
  onTray?: boolean;
  ruled?: boolean;
}) {
  return (
    <div
      className={cn(
        "group/card relative flex flex-col gap-1 rounded-xl px-3 py-2.5 transition-colors",
        onTray
          ? "hover:bg-surface-2 has-focus-visible:bg-surface-2"
          : "hover:bg-muted/60 has-focus-visible:bg-muted/60",
        late && "bg-condition-attention/[0.06]",
        ruled &&
          "before:absolute before:inset-y-3 before:left-1 before:w-0.5 before:rounded-full before:bg-muted-foreground/45",
      )}
    >
      {children}
      <div className="mt-0.5 flex min-h-6 items-center gap-1.5 text-[12px] leading-snug text-muted-foreground/75">
        {footer}
      </div>
    </div>
  );
}

/** Which Area, as a small muted pill in the footer. */
export function BoardTag({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span
      title={label}
      className="inline-flex max-w-40 min-w-0 items-center gap-1 rounded-full bg-muted/70 px-1.5 py-px text-[11px] text-muted-foreground"
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * The item's date as a token that opens the picker. Undated — or dated under
 * a heading that already names its day, with no time to add — it is only a
 * revealed control, so `BoardCard` footers place it with the other controls.
 * Under such a heading a time is all the token says.
 */
export function BoardDate({
  currentDate,
  inHeading = false,
  onSetWhen,
  when,
}: {
  currentDate: number;
  inHeading?: boolean;
  onSetWhen: (when: number | undefined) => void;
  when?: number;
}) {
  return (
    <WhenPopover
      when={when}
      onSetWhen={onSetWhen}
      trigger={
        when === undefined || !showsBoardDate(when, inHeading) ? (
          <BoardControl
            className={revealed}
            label={
              when === undefined
                ? followUpDateLabels.set
                : followUpDateLabels.change
            }
          >
            <CalendarClock className="size-3.5" />
          </BoardControl>
        ) : (
          <button
            type="button"
            aria-label={followUpDateLabels.change}
            className={cn(
              "relative z-10 -mx-1 -my-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-1 py-0.5 tabular-nums transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40",
              dateToneClassName(when, currentDate),
            )}
          >
            <CalendarClock aria-hidden className="size-3" />
            {inHeading
              ? timeToken(when)
              : withTimeToken(dateToken(when, currentDate), when)}
          </button>
        )
      }
    />
  );
}

/**
 * Whether a card's date reads as a token at the left of its footer: a dated
 * item does unless its heading already names the day and it has no time.
 */
export function showsBoardDate(
  when: number | undefined,
  inHeading: boolean,
): when is number {
  if (when === undefined) return false;
  return !inHeading || timeToken(when) !== undefined;
}

/**
 * The control that takes an item off the board: completing a Thread's Move,
 * or archiving a Note.
 */
export function BoardCompleteButton({
  icon: Icon = Check,
  label,
  onClick,
}: {
  icon?: typeof Check;
  label: string;
  onClick: () => void;
}) {
  return (
    <BoardControl
      label={label}
      onClick={onClick}
      className={cn(
        revealed,
        "bg-muted hover:bg-condition-healthy/15 hover:text-condition-healthy",
      )}
    >
      <Icon className="size-3.5" />
    </BoardControl>
  );
}

export function BoardControl({
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
        "relative z-10 -my-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[color,background-color,transform,opacity] hover:bg-muted hover:text-foreground active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function isLate(when: number | undefined, currentDate: number) {
  return when !== undefined && dayDelta(when, currentDate) < 0;
}
