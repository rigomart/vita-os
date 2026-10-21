import type { ReactNode } from "react";

import { cn } from "@vita-os/ui/lib/utils";
import { CalendarClock, Check, Repeat as RepeatIcon } from "lucide-react";

import {
  followUpDateLabels,
  type RepeatControl,
  repeatLabel,
  timeToken,
  WhenPopover,
  withTimeToken,
} from "../../attention-list";
import { dateToken, dateToneClassName, dayDelta } from "./dashboard-model";

/** Inset, so it never meets the outer ring that marks every copy of a Thread. */
export const focusRing =
  "has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-inset";

/** Held in place at rest, so the line never reflows on hover. */
export const revealed =
  "opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100";

/**
 * The item's date as a token that opens the picker. Undated — or dated under
 * a heading that already names its day, with no time to add — it is only a
 * revealed control, so a line places it with the other controls. Under such
 * a heading a time is all the token says.
 *
 * With `showsRepeat`, a repeating date wears the repeat glyph in place of the
 * calendar, and is always a token, so the rhythm shows under any heading. A
 * Task's line marks its repeat beside the Task instead.
 */
export function BoardDate({
  busy,
  currentDate,
  inHeading = false,
  labels = followUpDateLabels,
  onSetWhen,
  repeat,
  showsRepeat = false,
  when,
}: {
  busy?: boolean;
  currentDate: number;
  inHeading?: boolean;
  /** What the control is called: a Note's Follow-up date, or a Task's date. */
  labels?: { set: string; change: string; clear: string };
  onSetWhen: (when: number | undefined) => unknown;
  /** The Repeat, held in the same picker. */
  repeat?: RepeatControl;
  /** The token wears the Repeat's glyph. */
  showsRepeat?: boolean;
  when?: number;
}) {
  const glyph = showsRepeat ? repeat?.value : undefined;
  return (
    <WhenPopover
      busy={busy}
      when={when}
      {...(repeat === undefined ? {} : { repeat })}
      clearLabel={labels.clear}
      onSetWhen={onSetWhen}
      trigger={
        when === undefined ||
        (glyph === undefined && !showsBoardDate(when, inHeading)) ? (
          <BoardControl
            disabled={busy}
            className={revealed}
            label={when === undefined ? labels.set : labels.change}
          >
            <CalendarClock className="size-3.5" />
          </BoardControl>
        ) : (
          <button
            disabled={busy}
            type="button"
            aria-label={labels.change}
            className={cn(
              "relative z-10 -mx-1 -my-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-1 py-0.5 tabular-nums transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40",
              dateToneClassName(when, currentDate),
            )}
          >
            {glyph === undefined ? (
              <CalendarClock aria-hidden className="size-3" />
            ) : (
              <span
                role="img"
                aria-label={repeatLabel(glyph)}
                data-slot="repeat-glyph"
                className="flex shrink-0 items-center"
              >
                <RepeatIcon aria-hidden className="size-3" />
              </span>
            )}
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
 * Whether a line's date reads as a token before its controls: a dated item
 * does unless its heading already names the day and it has no time.
 */
export function showsBoardDate(
  when: number | undefined,
  inHeading: boolean,
): when is number {
  if (when === undefined) return false;
  return !inHeading || timeToken(when) !== undefined;
}

/**
 * The control that takes an item off the board: completing a Thread's Task,
 * or archiving a Note.
 */
export function BoardCompleteButton({
  icon: Icon = Check,
  label,
  onClick,
  disabled,
}: {
  icon?: typeof Check;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <BoardControl
      label={label}
      disabled={disabled}
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
  disabled,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
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
