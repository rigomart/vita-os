import type { RepeatControl } from "@vita-os/application/internal/attention-list/when-popover.tsx";
import type { Repeat } from "@vita-os/contracts";
import type { ReactElement, ReactNode } from "react";

import { timeToken } from "@vita-os/application/internal/attention-list/date-parts.ts";
import {
  CHIP_TIMES,
  onDay,
  quickPicks,
  timeSuggestions,
} from "@vita-os/application/internal/attention-list/quick-picks.ts";
import {
  draftRepeat,
  MAX_REPEAT_DAYS,
  repeatDraft,
  type RepeatDraft,
  repeatPresets,
  repeatShortLabel,
  repeatSummary,
  sameRepeat,
  WEEKDAYS,
} from "@vita-os/application/internal/attention-list/repeat.ts";
import { clock } from "@vita-os/application/internal/lib/clock.ts";
import { browserTimeZone } from "@vita-os/application/internal/lib/time-zone.ts";
import {
  snapTaskDate,
  startOfLocalDay,
  timeOfDay,
  withTimeOfDay,
} from "@vita-os/core";
import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import { cn } from "@vita-os/ui/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react";
import { useState } from "react";

/** What every direction takes: the shipped picker's props, and the item's words for a title. */
export interface PickerProps {
  when: number | undefined;
  onSetWhen: (when: number | undefined) => unknown;
  repeat?: RepeatControl;
  clearLabel?: string;
  keepOpenOnPick?: boolean;
  trigger: ReactElement;
  /** What the item says, for a direction that names it. */
  title: string;
}

export const dayName = (when: number) =>
  new Date(when).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export const weekdayName = (when: number) =>
  new Date(when).toLocaleDateString("en-US", { weekday: "short" });

/** `HH:mm` as a card writes it: 9 AM, 7:45 PM. */
export const timeLabel = (time: string) =>
  timeToken(withTimeOfDay(clock.now(), time)) ?? time;

/** The whole When in one line: Tue, Oct 21 · 9 AM · Every Tue. */
export function whenSummary(
  when: number | undefined,
  repeat: Repeat | undefined,
): string {
  if (when === undefined) return "No date";
  const time = timeToken(when);
  return [
    dayName(when),
    time,
    repeat === undefined ? undefined : repeatShortLabel(repeat),
  ]
    .filter(Boolean)
    .join(" · ");
}

export const chip =
  "h-7 rounded-full border border-border px-2.5 text-xs font-medium whitespace-nowrap tabular-nums text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground";

export function Section({
  children,
  className,
  icon,
  label,
  trailing,
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  label: string;
  trailing?: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-3.5">
        {icon}
        <span className="flex-1">{label}</span>
        {trailing}
      </div>
      {children}
    </section>
  );
}

/** A row that chooses: its label, what it lands on, and a check when chosen. */
export function ChoiceRow({
  chosen,
  detail,
  disabled,
  icon,
  label,
  muted,
  onClick,
}: {
  chosen?: boolean;
  detail?: string;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={chosen ?? false}
      onClick={onClick}
      className={cn(
        "flex h-8 w-full shrink-0 items-center gap-2 rounded-lg px-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        muted && "text-muted-foreground",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail !== undefined && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {detail}
        </span>
      )}
      {chosen && <Check aria-hidden />}
    </button>
  );
}

/** The quick picks as rows, each with the day it lands on. */
export function QuickPickRows({
  onPick,
  when,
}: {
  onPick: (day: number) => void;
  when: number | undefined;
}) {
  return quickPicks(clock.now()).map((pick) => (
    <ChoiceRow
      key={pick.label}
      label={pick.label}
      detail={dayName(pick.day)}
      chosen={when !== undefined && startOfLocalDay(when) === pick.day}
      onClick={() => onPick(pick.day)}
    />
  ));
}

/** The first `count` quick picks as chips, the day each lands on in its tooltip. */
export function QuickPickChips({
  count = 3,
  onPick,
  when,
}: {
  count?: number;
  onPick: (day: number) => void;
  when: number | undefined;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {quickPicks(clock.now())
        .slice(0, count)
        .map((pick) => (
          <button
            key={pick.label}
            type="button"
            title={dayName(pick.day)}
            aria-pressed={
              when !== undefined && startOfLocalDay(when) === pick.day
            }
            onClick={() => onPick(pick.day)}
            className={chip}
          >
            {pick.label}
          </button>
        ))}
    </div>
  );
}

export function MonthCalendar({
  className,
  fixedWeeks,
  onPick,
  when,
}: {
  className?: string;
  /** Always six weeks, so the calendar keeps one height from month to month. */
  fixedWeeks?: boolean;
  onPick: (day: number) => void;
  when: number | undefined;
}) {
  return (
    <Calendar
      mode="single"
      fixedWeeks={fixedWeeks}
      selected={when === undefined ? undefined : new Date(when)}
      defaultMonth={when === undefined ? undefined : new Date(when)}
      today={new Date(clock.now())}
      onSelect={(date) => date && onPick(date.getTime())}
      // The calendar draws its own surface, which shows as a darker block in a drawer.
      className={cn("bg-transparent p-0", className)}
    />
  );
}

/** The day picked, at the time the When already carries. */
export const landOn = (day: number, when: number | undefined) =>
  onDay(day, when);

export const timeOf = (when: number | undefined) =>
  when === undefined ? undefined : timeOfDay(when);

/**
 * The time in one place: a field to type into, with the four common times
 * as chips under it while it is empty, and what a typed time could be once
 * something is in it. Enter takes the first. The chosen chip again removes
 * the time.
 */
export function TimeInput({
  autoFocus,
  disabled,
  onPick,
  time,
}: {
  autoFocus?: boolean;
  disabled?: boolean;
  onPick: (time: string | undefined) => void;
  time: string | undefined;
}) {
  const [text, setText] = useState("");
  const typed = text.trim() !== "";
  const suggestions = timeSuggestions(text);
  const other =
    time !== undefined && !(CHIP_TIMES as readonly string[]).includes(time);
  const offered = typed
    ? suggestions
    : [...CHIP_TIMES, ...(other ? [time] : [])];

  function pick(next: string | undefined) {
    setText("");
    onPick(next);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label="Time"
        placeholder={
          disabled ? "Pick a day first" : "Type a time: 7, 7:45, 3pm"
        }
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const first = suggestions[0];
          if (first) pick(first);
        }}
        className="h-8 w-full shrink-0 rounded-lg bg-muted px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
      />
      {typed && suggestions.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">
          That isn’t a time. Try 7, 7:45 or 3pm.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {offered.map((value, index) => (
            <button
              key={value}
              type="button"
              disabled={disabled}
              aria-pressed={time === value}
              title={time === value ? "Remove time" : undefined}
              onClick={() => pick(time === value ? undefined : value)}
              className={cn(
                chip,
                typed && index === 0 && time !== value && "text-foreground",
              )}
            >
              {timeLabel(value)}
              {typed && index === 0 && (
                <span className="ml-1 text-muted-foreground">↵</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A preset that would move the date says where to: "from Mon". */
export function presetDetail(when: number, repeat: Repeat | null) {
  if (repeat === null) return undefined;
  const lands = snapTaskDate(when, repeat, browserTimeZone());
  return startOfLocalDay(lands) === startOfLocalDay(when)
    ? undefined
    : `from ${weekdayName(lands)}`;
}

export const isCustom = (when: number, value: Repeat | undefined) =>
  value !== undefined &&
  !repeatPresets(when, value).some((preset) =>
    sameRepeat(preset.repeat, value),
  );

/**
 * The Repeat's presets and Custom, all in view: as rows or as chips. Custom
 * opens its editor in place, under the choices, rather than on a page.
 */
export function RepeatChoices({
  customReplaces,
  layout,
  onPick,
  value,
  when,
}: {
  /** Custom's editor takes the presets' place, with a way back, where height is short. */
  customReplaces?: boolean;
  layout: "rows" | "chips";
  onPick: (repeat: Repeat | null) => void;
  value: Repeat | undefined;
  when: number | undefined;
}) {
  const [custom, setCustom] = useState(false);

  if (when === undefined) {
    return (
      <p className="px-1 text-xs text-muted-foreground">
        A repeat needs a day first.
      </p>
    );
  }

  const presets = repeatPresets(when, value);
  const customChosen = isCustom(when, value);

  if (custom && customReplaces) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setCustom(false)}
          className="inline-flex items-center gap-1 self-start rounded-full px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3"
        >
          <ChevronLeft />
          Presets
        </button>
        <CustomRepeat
          value={value}
          when={when}
          onSave={(next) => {
            setCustom(false);
            onPick(next);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {layout === "rows" ? (
        <div className="flex flex-col">
          {presets.map((preset) => (
            <ChoiceRow
              key={preset.label}
              label={preset.label}
              detail={presetDetail(when, preset.repeat)}
              chosen={!custom && sameRepeat(preset.repeat, value)}
              onClick={() => {
                setCustom(false);
                onPick(preset.repeat);
              }}
            />
          ))}
          <ChoiceRow
            label={
              customChosen && !custom
                ? `Custom: ${repeatShortLabel(value)}`
                : "Custom…"
            }
            chosen={custom || customChosen}
            onClick={() => setCustom(!custom)}
          />
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => {
            const detail = presetDetail(when, preset.repeat);
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={!custom && sameRepeat(preset.repeat, value)}
                title={detail}
                onClick={() => {
                  setCustom(false);
                  onPick(preset.repeat);
                }}
                className={chip}
              >
                {preset.label === "Doesn't repeat" ? "Never" : preset.label}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={custom || customChosen}
            onClick={() => setCustom(!custom)}
            className={chip}
          >
            {customChosen && !custom ? repeatShortLabel(value) : "Custom…"}
          </button>
        </div>
      )}
      {custom && (
        <CustomRepeat
          value={value}
          when={when}
          onSave={(next) => {
            setCustom(false);
            onPick(next);
          }}
        />
      )}
    </div>
  );
}

/**
 * Every N days with a stepper, or weekly on chosen weekdays, with the line
 * saying what it will do, before Save. The shipped editor without its page.
 */
export function CustomRepeat({
  onSave,
  value,
  when,
}: {
  onSave: (repeat: Repeat) => void;
  value: Repeat | undefined;
  when: number;
}) {
  const initial = repeatDraft(value?.kind === "monthly" ? undefined : value);
  const [draft, setDraft] = useState<RepeatDraft>(
    initial.mode === "never"
      ? { mode: "everyN", every: 2 }
      : initial.mode === "daily"
        ? { mode: "everyN", every: 1 }
        : initial,
  );
  const chosen = draftRepeat(draft);

  return (
    <div
      role="group"
      aria-label="Custom repeat"
      className="flex flex-col gap-2.5 rounded-xl bg-muted/50 p-2"
    >
      <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-muted p-0.5">
        {(
          [
            ["everyN", "Every N days"],
            ["weekly", "Weekly"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={draft.mode === mode}
            onClick={() => {
              if (draft.mode === mode) return;
              setDraft(
                mode === "everyN"
                  ? { mode, every: 2 }
                  : { mode, weekdays: [new Date(when).getDay()] },
              );
            }}
            className={cn(
              "h-7 rounded-md text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
              draft.mode === mode && "bg-background text-foreground shadow-xs",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {draft.mode === "everyN" && (
        <div className="flex items-center justify-center gap-2 text-sm">
          Every
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label="Fewer days"
            disabled={draft.every <= 1}
            onClick={() => setDraft({ mode: "everyN", every: draft.every - 1 })}
          >
            <Minus />
          </Button>
          <span className="min-w-6 text-center font-medium tabular-nums">
            {draft.every}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label="More days"
            disabled={draft.every >= MAX_REPEAT_DAYS}
            onClick={() => setDraft({ mode: "everyN", every: draft.every + 1 })}
          >
            <Plus />
          </Button>
          {draft.every === 1 ? "day" : "days"}
        </div>
      )}

      {draft.mode === "weekly" && (
        <div className="flex items-center justify-between gap-1">
          {WEEKDAYS.map(({ day, letter, name }) => {
            const on = draft.weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={name}
                title={name}
                onClick={() =>
                  setDraft({
                    mode: "weekly",
                    weekdays: on
                      ? draft.weekdays.filter((other) => other !== day)
                      : [...draft.weekdays, day],
                  })
                }
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}

      <p
        aria-live="polite"
        className="px-1 text-xs leading-snug text-muted-foreground"
      >
        {repeatSummary(when, draft, browserTimeZone())}
      </p>
      <Button
        type="button"
        size="sm"
        disabled={!chosen}
        onClick={() => chosen && onSave(chosen)}
      >
        Save repeat
      </Button>
    </div>
  );
}

/**
 * A row that names a part of the When and its value, and opens it: in place
 * (`chevron="down"`, turning while open) or onto a page (`chevron="right"`).
 */
export function DisclosureRow({
  chevron = "down",
  disabled,
  expanded,
  icon,
  label,
  onClick,
  value,
}: {
  chevron?: "down" | "right";
  disabled?: boolean;
  expanded?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  value: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-expanded={chevron === "down" ? (expanded ?? false) : undefined}
      onClick={onClick}
      className={cn(
        "flex h-8 w-full shrink-0 items-center gap-2 rounded-lg px-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        expanded && "font-medium",
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <span
        className={cn(
          "truncate text-xs text-muted-foreground tabular-nums",
          expanded && "invisible",
        )}
      >
        {value}
      </span>
      {chevron === "down" ? (
        <ChevronDown
          aria-hidden
          className={cn("transition-transform", expanded && "rotate-180")}
        />
      ) : (
        <ChevronRight aria-hidden />
      )}
    </button>
  );
}

/** The quick picks as small cards: what it is over the day it lands on. */
export function QuickPickGrid({
  columns = 2,
  onPick,
  when,
}: {
  columns?: 2 | 3;
  onPick: (day: number) => void;
  when: number | undefined;
}) {
  return (
    <div
      className={cn(
        "grid gap-1",
        columns === 2 ? "grid-cols-2" : "grid-cols-3",
      )}
    >
      {quickPicks(clock.now()).map((pick) => (
        <button
          key={pick.label}
          type="button"
          aria-pressed={
            when !== undefined && startOfLocalDay(when) === pick.day
          }
          onClick={() => onPick(pick.day)}
          className={cn(
            chip,
            "flex h-auto flex-col items-start rounded-xl px-2.5 py-1 text-left",
          )}
        >
          <span className="text-xs">{pick.label}</span>
          <span className="text-[0.65rem] font-normal opacity-70">
            {dayName(pick.day)}
          </span>
        </button>
      ))}
    </div>
  );
}
