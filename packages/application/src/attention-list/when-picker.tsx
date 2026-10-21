import type { Repeat } from "@vita-os/contracts";
import type { ReactElement, ReactNode } from "react";

import {
  snapTaskDate,
  startOfLocalDay,
  timeOfDay,
  withTimeOfDay,
} from "@vita-os/core";
import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerNested,
  DrawerTitle,
  DrawerTrigger,
  useInsideDrawer,
} from "@vita-os/ui/components/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { useIsMobile } from "@vita-os/ui/hooks/use-mobile";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronLeft,
  Clock,
  Minus,
  Plus,
  Repeat as RepeatIcon,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { RepeatDraft } from "./repeat";

import { clock } from "../lib/clock";
import { browserTimeZone } from "../lib/time-zone";
import { onDay, timeToken, withTimeToken } from "./date-parts";
import { followUpDateLabels } from "./follow-up-date";
import {
  draftRepeat,
  MAX_REPEAT_DAYS,
  repeatDraft,
  repeatLabel,
  repeatPresets,
  repeatShortLabel,
  repeatSummary,
  sameRepeat,
  WEEKDAYS,
} from "./repeat";

/**
 * A Task's or Standalone Note's Repeat, edited in its date picker.
 * `onChange(null)` clears it.
 */
export interface RepeatControl {
  value: Repeat | undefined;
  onChange: (repeat: Repeat | null) => unknown;
}

/** The times one tap away, under the field. */
const PRESET_TIMES = ["09:00", "12:00", "15:00", "18:00"] as const;

/** `HH:mm` as a date token writes it: 9 AM, 7:45 PM. */
const timeLabel = (time: string) =>
  timeToken(withTimeOfDay(clock.now(), time)) ?? time;

/** What a choice does: save, and close or stay open as the place it opened from needs. */
interface Choices {
  busy: boolean;
  day: (day: number) => void;
  time: (time: string | undefined) => void;
  repeat: (repeat: Repeat | null) => void;
  clear: () => void;
}

interface PartsProps {
  choices: Choices;
  clearLabel: string;
  repeat: RepeatControl | undefined;
  when: number | undefined;
}

/**
 * The picker every When shares (ADR 0047): the calendar, with the time and,
 * for a Task or a Standalone Note, its Repeat beside it, all in view. On a
 * phone it is a drawer, the calendar over Time and Repeat rows that open in
 * place.
 *
 * Every choice saves as it is made; `busy` holds the controls while a write
 * is in flight, so one choice never overtakes another. A day or a Repeat
 * closes it unless `keepOpenOnPick`; a time never does, since it is saved
 * while still being typed. With no day yet, the time and the Repeat show,
 * disabled.
 */
export function WhenPicker({
  busy = false,
  clearLabel = followUpDateLabels.clear,
  keepOpenOnPick = false,
  onSetWhen,
  repeat,
  trigger,
  when,
}: {
  busy?: boolean;
  /** What the control that removes the date says. */
  clearLabel?: string;
  /**
   * A day or a Repeat leaves the picker open. Only where the trigger stays
   * put when the When changes: a Dashboard line moves to its new day's heading, out
   * from under an open picker.
   */
  keepOpenOnPick?: boolean;
  onSetWhen?: (when: number | undefined) => unknown;
  /** The date's Repeat; without it the picker holds a date and a time. */
  repeat?: RepeatControl;
  trigger: ReactElement;
  when?: number;
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const insideDrawer = useInsideDrawer();

  function moveOn() {
    if (!keepOpenOnPick) setOpen(false);
  }
  const choices: Choices = {
    busy,
    day(day) {
      if (busy) return;
      void onSetWhen?.(onDay(day, when));
      moveOn();
    },
    time(time) {
      if (busy || when === undefined || time === timeOfDay(when)) return;
      void onSetWhen?.(withTimeOfDay(when, time));
    },
    repeat(next) {
      if (busy || repeat === undefined) return;
      if (!sameRepeat(next, repeat.value)) void repeat.onChange(next);
      moveOn();
    },
    clear() {
      if (busy) return;
      void onSetWhen?.(undefined);
      setOpen(false);
    },
  };
  const parts = { choices, clearLabel, repeat, when };

  if (isMobile) {
    // From inside a drawer — the Thread drawer, a Note's — it has to be a nested root.
    const Root = insideDrawer ? DrawerNested : Drawer;
    return (
      <Root open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent data-when-picker="" aria-describedby={undefined}>
          <WhenSheet {...parts} />
        </DrawerContent>
      </Root>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        data-when-picker=""
        className="w-auto gap-0 p-0"
        align="end"
      >
        <WhenPanel {...parts} />
      </PopoverContent>
    </Popover>
  );
}

/** The When in one line: Fri, Oct 23 · 9 AM · Weekdays. */
function whenSummary(when: number | undefined, repeat: Repeat | undefined) {
  if (when === undefined) return "No date";
  const day = withTimeToken(format(when, "EEE, MMM d"), when);
  return repeat === undefined ? day : `${day} · ${repeatShortLabel(repeat)}`;
}

function MonthCalendar({
  choices,
  className,
  when,
}: {
  choices: Choices;
  className?: string;
  when: number | undefined;
}) {
  return (
    <Calendar
      mode="single"
      // Six weeks every month, so the column beside it keeps one height.
      fixedWeeks
      selected={when === undefined ? undefined : new Date(when)}
      defaultMonth={when === undefined ? undefined : new Date(when)}
      today={new Date(clock.now())}
      disabled={choices.busy}
      onSelect={(date) => date && choices.day(date.getTime())}
      className={cn("p-0", className)}
    />
  );
}

/** The wide screen's picker: the calendar, and beside it, as tall, the When's summary, its time and its Repeat. */
function WhenPanel(props: PartsProps) {
  const { choices, clearLabel, repeat, when } = props;
  const [custom, setCustom] = useState(false);
  const time = when === undefined ? undefined : timeOfDay(when);

  return (
    <div className="flex">
      <div className="border-r p-3">
        <MonthCalendar choices={choices} when={when} />
      </div>
      <div className="relative w-64">
        <div className="absolute inset-0 flex flex-col gap-0.5 overflow-y-auto p-2">
          <div className="flex h-7 shrink-0 items-center gap-1 pl-2">
            <span className="flex-1 truncate text-xs text-muted-foreground">
              {whenSummary(when, repeat?.value)}
            </span>
            {when !== undefined && (
              <button
                type="button"
                disabled={choices.busy}
                aria-label={clearLabel}
                title={clearLabel}
                onClick={choices.clear}
                className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 [&_svg]:size-3.5"
              >
                <X />
              </button>
            )}
          </div>
          {custom && repeat !== undefined && when !== undefined ? (
            <CustomRepeat
              value={repeat.value}
              when={when}
              onBack={() => setCustom(false)}
              onSave={(next) => {
                setCustom(false);
                choices.repeat(next);
              }}
            />
          ) : (
            <>
              <PartHeading
                icon={<Clock />}
                label="Time"
                {...(time === undefined
                  ? {}
                  : {
                      action: {
                        text: "Remove",
                        label: "Remove time",
                        onClick: () => choices.time(undefined),
                      },
                    })}
              />
              <div className="px-1 pb-2">
                <TimeField
                  choices={choices}
                  time={time}
                  disabled={when === undefined}
                />
              </div>
              {repeat !== undefined && (
                <>
                  <PartHeading
                    icon={<RepeatIcon />}
                    label="Repeat"
                    {...(repeat.value === undefined
                      ? {}
                      : {
                          action: {
                            text: "Stop",
                            label: "Stop repeating",
                            onClick: () => choices.repeat(null),
                          },
                        })}
                  />
                  <div className="px-1">
                    <RepeatChoices
                      choices={choices}
                      value={repeat.value}
                      when={when}
                      onCustom={() => setCustom(true)}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** A part's name, with the way to take its value away once it has one. */
function PartHeading({
  action,
  icon,
  label,
}: {
  action?: { text: string; label: string; onClick: () => void };
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="flex h-7 shrink-0 items-center gap-2 px-2 text-xs font-medium text-muted-foreground [&_svg]:size-3.5">
      {icon}
      <span className="flex-1">{label}</span>
      {action && <PartAction {...action} />}
    </div>
  );
}

function PartAction({
  className,
  label,
  onClick,
  text,
}: {
  className?: string;
  label: string;
  onClick: () => void;
  text: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-normal text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 [&_svg]:size-3",
        className,
      )}
    >
      <X />
      {text}
    </button>
  );
}

const chip =
  "h-7 rounded-lg border border-border text-xs font-medium whitespace-nowrap tabular-nums text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground";

/**
 * The time: one field, as the browser draws it, to type into or step with ↑
 * and ↓ (the system's own wheel on a phone), and the common times under it,
 * one tap each. A typed time saves a moment after the typing stops, at once
 * on Enter or on leaving the field, and when the picker closes.
 */
function TimeField({
  choices,
  disabled,
  time,
}: {
  choices: Choices;
  disabled: boolean;
  time: string | undefined;
}) {
  const [draft, setDraft] = useState(time ?? "");
  // The last time sent, so closing right after a save doesn't send it twice.
  const sent = useRef(time);
  const latest = useRef({ choices, draft });
  latest.current = { choices, draft };

  function commit() {
    const { choices, draft } = latest.current;
    // The field reads empty until hour, minutes and AM/PM are all there; midnight is no time (ADR 0027).
    if (draft === "" || draft === "00:00" || draft === sent.current) return;
    sent.current = draft;
    choices.time(draft);
  }

  useEffect(() => {
    sent.current = time;
    setDraft(time ?? "");
  }, [time]);
  useEffect(() => {
    if (choices.busy) return;
    const timer = setTimeout(commit, 700);
    return () => clearTimeout(timer);
  }, [draft, choices.busy]);
  useEffect(() => () => commit(), []);

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="time"
        step={300}
        disabled={disabled}
        aria-label="Time"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          commit();
        }}
        className={cn(
          "h-8 w-full rounded-lg bg-muted px-2.5 text-sm font-medium tabular-nums outline-none [color-scheme:light] focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50 dark:[color-scheme:dark]",
          draft === "" && "text-muted-foreground",
        )}
      />
      {draft === "00:00" && (
        <p role="status" className="px-1 text-xs text-muted-foreground">
          Midnight is no time. Pick another, or Remove.
        </p>
      )}
      <div
        role="group"
        aria-label="Preset times"
        className="grid grid-cols-4 gap-1"
      >
        {PRESET_TIMES.map((value) => (
          <button
            key={value}
            type="button"
            disabled={disabled || choices.busy}
            aria-pressed={time === value}
            onClick={() => choices.time(value)}
            className={chip}
          >
            {timeLabel(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The Repeat as one word per choice: Daily, Weekdays, Weekly, Biweekly,
 * Monthly and Custom, each saying in full what it does to a screen reader
 * and in its tooltip, and where a weekly one moves the date. The chosen one
 * again stops it. With no day yet they show, disabled.
 */
function RepeatChoices({
  choices,
  onCustom,
  value,
  when,
}: {
  choices: Choices;
  onCustom: () => void;
  value: Repeat | undefined;
  when: number | undefined;
}) {
  const disabled = when === undefined || choices.busy;
  const presets = repeatPresets(when ?? clock.now(), value);
  const custom =
    value !== undefined &&
    !presets.some((preset) => sameRepeat(preset.repeat, value));

  function said(label: string, repeat: Repeat) {
    if (when === undefined) return label;
    const lands = snapTaskDate(when, repeat, browserTimeZone());
    return startOfLocalDay(lands) === startOfLocalDay(when)
      ? label
      : `${label}, from ${format(lands, "EEE")}`;
  }

  return (
    <div role="group" aria-label="Repeat" className="grid grid-cols-3 gap-1">
      {presets.map((preset) => {
        const chosen = sameRepeat(preset.repeat, value);
        const label = said(preset.label, preset.repeat);
        return (
          <button
            key={preset.word}
            type="button"
            disabled={disabled}
            aria-pressed={chosen}
            aria-label={label}
            title={chosen ? "Stop repeating" : label}
            onClick={() => choices.repeat(chosen ? null : preset.repeat)}
            className={cn(chip, "h-8")}
          >
            {preset.word}
          </button>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        aria-pressed={custom}
        aria-label={
          custom && value ? `Custom: ${repeatLabel(value)}` : "Custom repeat"
        }
        title={
          custom && value
            ? repeatLabel(value)
            : "Every N days, or chosen weekdays"
        }
        onClick={onCustom}
        className={cn(chip, "h-8")}
      >
        Custom
      </button>
    </div>
  );
}

/**
 * A Repeat the presets don't hold: every N days with a stepper, or weekly on
 * chosen weekdays, with the line saying what it will do, and where a weekly
 * one moves its date, before Save.
 */
function CustomRepeat({
  onBack,
  onSave,
  value,
  when,
}: {
  onBack: () => void;
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
      className="flex flex-col gap-2.5 px-1 pb-1"
    >
      <button
        type="button"
        aria-label="Back to repeat choices"
        onClick={onBack}
        className="inline-flex h-7 items-center gap-1 self-start rounded-full px-1.5 text-xs font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 [&_svg]:size-3.5"
      >
        <ChevronLeft />
        Custom repeat
      </button>
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
        <div className="flex items-center justify-between">
          {WEEKDAYS.map(({ day, name, letter }) => {
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
 * The phone's picker, in a drawer: the When as its title, the calendar, then
 * Time and Repeat as rows naming their value that open in place, one at a
 * time, and the row that removes the date.
 */
function WhenSheet(props: PartsProps) {
  const { choices, clearLabel, repeat, when } = props;
  const [open, setOpen] = useState<"time" | "repeat" | "custom" | null>(null);
  const toggle = (part: "time" | "repeat") =>
    setOpen(open === part ? null : part);
  const time = when === undefined ? undefined : timeOfDay(when);

  return (
    <div className="flex min-h-0 flex-col gap-1 overflow-y-auto px-2 pb-2">
      <DrawerHeader className="px-0 pb-2">
        <DrawerTitle>{whenSummary(when, repeat?.value)}</DrawerTitle>
      </DrawerHeader>
      <MonthCalendar
        choices={choices}
        when={when}
        className="self-center pb-2 [--cell-size:--spacing(10)]"
      />
      <div className="relative">
        <SheetRow
          icon={<Clock />}
          label="Time"
          value={time === undefined ? "None" : timeLabel(time)}
          expanded={open === "time"}
          onClick={() => toggle("time")}
        />
        {/* Open, the row trades its value for the way to remove it. */}
        {open === "time" && time !== undefined && (
          <PartAction
            text="Remove"
            label="Remove time"
            onClick={() => choices.time(undefined)}
            className="absolute top-1/2 right-7 -translate-y-1/2"
          />
        )}
      </div>
      {open === "time" && (
        <div className="px-1 pb-2">
          <TimeField
            choices={choices}
            time={time}
            disabled={when === undefined}
          />
        </div>
      )}
      {repeat !== undefined && (
        <>
          <div className="relative">
            <SheetRow
              icon={<RepeatIcon />}
              label="Repeat"
              value={repeatShortLabel(repeat.value)}
              expanded={open === "repeat" || open === "custom"}
              onClick={() => toggle("repeat")}
            />
            {open === "repeat" && repeat.value !== undefined && (
              <PartAction
                text="Stop"
                label="Stop repeating"
                onClick={() => choices.repeat(null)}
                className="absolute top-1/2 right-7 -translate-y-1/2"
              />
            )}
          </div>
          {open === "repeat" && (
            <div className="px-1 pb-2">
              <RepeatChoices
                choices={choices}
                value={repeat.value}
                when={when}
                onCustom={() => setOpen("custom")}
              />
            </div>
          )}
          {open === "custom" && when !== undefined && (
            <CustomRepeat
              value={repeat.value}
              when={when}
              onBack={() => setOpen("repeat")}
              onSave={(next) => {
                setOpen("repeat");
                choices.repeat(next);
              }}
            />
          )}
        </>
      )}
      {when !== undefined && (
        <button
          type="button"
          disabled={choices.busy}
          onClick={choices.clear}
          className="flex h-10 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-50 [&_svg]:size-3.5"
        >
          <X />
          {clearLabel}
        </button>
      )}
    </div>
  );
}

function SheetRow({
  expanded,
  icon,
  label,
  onClick,
  value,
}: {
  expanded: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  value: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onClick}
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
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
      <ChevronDown
        aria-hidden
        className={cn("transition-transform", expanded && "rotate-180")}
      />
    </button>
  );
}
