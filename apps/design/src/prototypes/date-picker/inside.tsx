import type { Repeat } from "@vita-os/contracts";
import type { ReactNode } from "react";

import {
  CHIP_TIMES,
  timeSuggestions,
} from "@vita-os/application/internal/attention-list/quick-picks.ts";
import {
  repeatLabel,
  repeatPresets,
  sameRepeat,
} from "@vita-os/application/internal/attention-list/repeat.ts";
import { clock } from "@vita-os/application/internal/lib/clock.ts";
import { cn } from "@vita-os/ui/lib/utils";
import {
  Check,
  ChevronLeft,
  Clock,
  Repeat as RepeatIcon,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { DrawerParts, LayoutProps } from "./big";
import type { PickerProps } from "./parts";

import { BigPicker, Beside, CalendarPane, SummaryLine } from "./big";
import {
  chip,
  CustomRepeat,
  isCustom,
  presetDetail,
  timeLabel,
  timeOf,
} from "./parts";

interface TimeProps {
  disabled?: boolean;
  onPick: (time: string | undefined) => void;
  time: string | undefined;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** A part's name, and the way to remove it once it has a value. */
function PartHeader({
  clearLabel,
  icon,
  label,
  onClear,
}: {
  clearLabel: string;
  icon: ReactNode;
  label: string;
  onClear: (() => void) | undefined;
}) {
  return (
    <div className="flex h-7 shrink-0 items-center gap-2 px-2 text-xs font-medium text-muted-foreground [&_svg]:size-3.5">
      {icon}
      <span className="flex-1">{label}</span>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-normal hover:bg-muted hover:text-foreground [&_svg]:size-3"
        >
          <X />
          {clearLabel}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Repeat */

/** One word each, in the order of the presets they stand for. */
const SHORT = ["Daily", "Weekdays", "Weekly", "Biweekly", "Monthly"] as const;

/**
 * The Repeat as one word per choice, two rows of three: Daily, Weekdays,
 * Weekly, Biweekly, Monthly and Custom. Doesn't repeat is no choice at all:
 * the chosen one again, or Stop, removes it. Each says in full what it does
 * in its tooltip. Custom takes the grid's place.
 */
export function ShortRepeat({
  onCustomChange,
  onPick,
  value,
  when,
}: {
  onCustomChange?: (open: boolean) => void;
  onPick: (repeat: Repeat | null) => void;
  value: Repeat | undefined;
  when: number | undefined;
}) {
  const [custom, setCustomOpen] = useState(false);
  const setCustom = (open: boolean) => {
    setCustomOpen(open);
    onCustomChange?.(open);
  };

  if (custom && when !== undefined) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setCustom(false)}
          className="inline-flex items-center gap-1 self-start rounded-full px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3"
        >
          <ChevronLeft />
          Custom repeat
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

  // With no day yet the choices show, disabled, named as from today.
  const day = when ?? clock.now();
  const disabled = when === undefined;
  // The first preset is Doesn't repeat, which has no button.
  const presets = repeatPresets(day, value).slice(1);
  const customChosen = isCustom(day, value);

  return (
    <div className="grid grid-cols-3 gap-1 pb-1">
      {presets.map((preset, index) => {
        const chosen = sameRepeat(preset.repeat, value);
        return (
          <button
            key={preset.label}
            type="button"
            disabled={disabled}
            aria-pressed={chosen}
            aria-label={preset.label}
            title={
              chosen
                ? "Stop repeating"
                : presetTitle(preset.label, preset.repeat)
            }
            onClick={() => onPick(chosen ? null : preset.repeat)}
            className={cn(chip, "h-8 rounded-lg px-0")}
          >
            {SHORT[index]}
          </button>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        aria-pressed={customChosen}
        title={
          customChosen
            ? repeatLabel(value!)
            : "Every N days, or on chosen weekdays"
        }
        onClick={() => setCustom(true)}
        className={cn(chip, "h-8 rounded-lg px-0")}
      >
        Custom
      </button>
    </div>
  );

  function presetTitle(label: string, repeat: Repeat | null) {
    if (disabled) return "Pick a day first";
    const detail = repeat === null ? undefined : presetDetail(day, repeat);
    return detail === undefined ? label : `${label}, ${detail}`;
  }
}

/* -------------------------------------------------------------------- Time */

/** Every half hour from 6 AM to 11:30 PM, as `HH:mm`. */
const SLOTS = Array.from({ length: 36 }, (_, index) => {
  const minutes = 6 * 60 + index * 30;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
});

/**
 * A field over a list of every half hour, scrolled to the chosen time or to
 * 9 AM. Typing narrows the list to what the typed time could be ("7" is
 * 7 AM or 7 PM); Enter takes the first.
 */
export function TimeList({
  disabled,
  onPick,
  time,
  className,
}: TimeProps & { className?: string }) {
  const [text, setText] = useState("");
  const typed = text.trim() !== "";
  const list = useRef<HTMLDivElement>(null);
  const options = typed
    ? timeSuggestions(text)
    : [...new Set([...SLOTS, ...(time ? [time] : [])])].sort();
  const anchor = time ?? "09:00";

  useLayoutEffect(() => {
    const box = list.current;
    const row = box?.querySelector<HTMLElement>(`[data-time="${anchor}"]`);
    // The list is the rows' offset parent.
    if (box && row) box.scrollTop = row.offsetTop - 4;
  }, [anchor, typed]);

  function pick(next: string) {
    setText("");
    onPick(next);
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-1", className)}>
      <input
        disabled={disabled}
        aria-label="Type a time"
        placeholder={
          disabled ? "Pick a day first" : "Type a time: 7, 7:45, 3pm"
        }
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || !options[0] || !typed) return;
          event.preventDefault();
          pick(options[0]);
        }}
        className="h-8 w-full shrink-0 rounded-lg bg-muted px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
      />
      <div
        ref={list}
        role="listbox"
        aria-label="Times"
        className={cn(
          "relative min-h-0 flex-1 overflow-y-auto",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {typed && options.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            That isn’t a time. Try 7, 7:45 or 3pm.
          </p>
        )}
        {options.map((value, index) => (
          <button
            key={value}
            type="button"
            role="option"
            data-time={value}
            aria-selected={value === time}
            onClick={() => pick(value)}
            className={cn(
              "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm tabular-nums hover:bg-muted",
              typed && index === 0 && "bg-muted",
              value === time && "font-medium",
            )}
          >
            <span className="flex-1">{timeLabel(value)}</span>
            {typed && index === 0 && (
              <span className="text-xs text-muted-foreground">↵</span>
            )}
            {value === time && <Check className="size-3.5" />}
          </button>
        ))}
      </div>
    </div>
  );
}

const HOUR_ROWS = [
  { label: "AM", hours: [6, 7, 8, 9, 10, 11] },
  { label: "PM", hours: [12, 13, 14, 15, 16, 17] },
  { label: "", hours: [18, 19, 20, 21, 22, 23] },
] as const;
const MINUTES = [0, 15, 30, 45] as const;

/**
 * The hours from 6 AM to 11 PM as a grid, one tap each, and the quarter
 * hours under it to move within the chosen hour. No typing.
 */
export function TimeGrid({ disabled, onPick, time }: TimeProps) {
  const [hour, minute] =
    time === undefined ? [undefined, 0] : time.split(":").map(Number);

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <div className="grid grid-cols-[1.75rem_repeat(6,1fr)] gap-1">
        {HOUR_ROWS.map((row) => (
          <HourRow
            key={row.hours[0]}
            hour={hour}
            label={row.label}
            hours={row.hours}
            onPick={(next) => onPick(`${pad(next)}:${pad(minute ?? 0)}`)}
          />
        ))}
      </div>
      <div className="grid grid-cols-[1.75rem_repeat(4,1fr)] gap-1">
        <span />
        {MINUTES.map((value) => (
          <button
            key={value}
            type="button"
            disabled={hour === undefined}
            aria-pressed={hour !== undefined && minute === value}
            onClick={() => onPick(`${pad(hour!)}:${pad(value)}`)}
            className={cn(chip, "h-7 rounded-lg px-0")}
          >
            :{pad(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

function HourRow({
  hour,
  hours,
  label,
  onPick,
}: {
  hour: number | undefined;
  hours: readonly number[];
  label: string;
  onPick: (hour: number) => void;
}) {
  return (
    <>
      <span className="flex items-center text-[0.65rem] font-medium text-muted-foreground">
        {label}
      </span>
      {hours.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={hour === value}
          aria-label={timeLabel(`${pad(value)}:00`)}
          onClick={() => onPick(value)}
          className={cn(chip, "h-7 rounded-lg px-0")}
        >
          {value % 12 === 0 ? 12 : value % 12}
        </button>
      ))}
    </>
  );
}

/**
 * One time field, as the browser draws it: hour, minutes and AM/PM to type
 * into or step with ↑ and ↓, and the system's own wheel on a phone, with
 * the four common times under it, one tap each. Empty until a time is set;
 * Remove, over it, takes the time away. A typed time saves a moment after
 * the typing stops, or at once on Enter.
 */
export function TimeField({ disabled, onPick, time }: TimeProps) {
  const [draft, setDraft] = useState(time ?? "");

  // Removing the time, from the heading, or a preset, sets the field.
  useEffect(() => setDraft(time ?? ""), [time]);
  useEffect(() => {
    // The field reads empty until hour, minutes and AM/PM are all there.
    if (draft === "" || draft === "00:00" || draft === time) return;
    const timer = setTimeout(() => onPick(draft), 700);
    return () => clearTimeout(timer);
  }, [draft]); // oxlint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="time"
        step={300}
        disabled={disabled}
        aria-label="Time"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || draft === "" || draft === "00:00")
            return;
          event.preventDefault();
          onPick(draft);
        }}
        className={cn(
          "h-8 w-full rounded-lg bg-muted px-2.5 text-sm font-medium tabular-nums outline-none [color-scheme:dark] focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
          draft === "" && "text-muted-foreground",
        )}
      />
      <div
        role="group"
        aria-label="Preset times"
        className="grid grid-cols-4 gap-1"
      >
        {CHIP_TIMES.map((value) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            aria-pressed={time === value}
            onClick={() => {
              if (time !== value) onPick(value);
            }}
            className={cn(chip, "h-7 rounded-lg px-0")}
          >
            {timeLabel(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Layout */

/**
 * Calendar only, with its insides redone: the calendar on the left; on the
 * right the time, drawn by `Time`, and the Repeat in one word per choice.
 * Custom takes the whole column while it is open.
 */
function insideLayout(Time: (props: TimeProps) => ReactNode, fills: boolean) {
  return function InsideLayout(props: LayoutProps) {
    const { choices, repeat, when } = props;
    const [custom, setCustom] = useState(false);
    const time = timeOf(when);

    return (
      <div className="flex">
        <CalendarPane {...props} />
        <Beside>
          <SummaryLine {...props} />
          {!custom && (
            <div className={cn("flex flex-col", fills && "min-h-0 flex-1")}>
              <PartHeader
                icon={<Clock />}
                label="Time"
                clearLabel="Remove"
                onClear={
                  time === undefined ? undefined : () => choices.time(undefined)
                }
              />
              <div
                className={cn(
                  "flex flex-col px-1 pb-2",
                  fills && "min-h-0 flex-1",
                )}
              >
                <Time
                  disabled={when === undefined}
                  time={time}
                  onPick={choices.time}
                />
              </div>
            </div>
          )}
          {repeat !== undefined && (
            <div className="flex shrink-0 flex-col">
              {!custom && (
                <PartHeader
                  icon={<RepeatIcon />}
                  label="Repeat"
                  clearLabel="Stop"
                  onClear={
                    repeat.value === undefined
                      ? undefined
                      : () => choices.repeat(null)
                  }
                />
              )}
              <div className="px-1">
                <ShortRepeat
                  when={when}
                  value={repeat.value}
                  onPick={choices.repeat}
                  onCustomChange={setCustom}
                />
              </div>
            </div>
          )}
        </Beside>
      </div>
    );
  };
}

function insidePicker(
  Time: (props: TimeProps) => ReactNode,
  {
    fills = false,
    timeClassName,
    timeStaysOpen = false,
  }: {
    /** Saved while still being typed, so a time leaves the picker open, even on a card. */
    timeStaysOpen?: boolean;
    fills?: boolean;
    timeClassName?: string;
  } = {},
) {
  const layout = insideLayout(Time, fills);
  const parts: DrawerParts = {
    time: ({ onPick, time }) => (
      <div className={timeClassName}>
        <Time time={time} onPick={onPick} />
      </div>
    ),
    repeat: ({ onPick, value, when }) => (
      <ShortRepeat when={when} value={value} onPick={onPick} />
    ),
  };
  return function InsidePicker(props: PickerProps) {
    return (
      <BigPicker
        calendarOnly
        drawerParts={parts}
        layout={layout}
        props={props}
        timeStaysOpen={timeStaysOpen}
      />
    );
  };
}

export const TimeListPicker = insidePicker(TimeList, {
  fills: true,
  timeClassName: "flex h-52 flex-col",
});
export const TimeGridPicker = insidePicker(TimeGrid);
export const TimeFieldPicker = insidePicker(TimeField, { timeStaysOpen: true });
