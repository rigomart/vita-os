import type { Repeat } from "@vita-os/contracts";
import type { ReactElement } from "react";

import { quickPicks } from "@vita-os/application/internal/attention-list/quick-picks.ts";
import { sameRepeat } from "@vita-os/application/internal/attention-list/repeat.ts";
import { clock } from "@vita-os/application/internal/lib/clock.ts";
import { browserTimeZone } from "@vita-os/application/internal/lib/time-zone.ts";
import { snapTaskDate, startOfLocalDay, withTimeOfDay } from "@vita-os/core";
import { Button } from "@vita-os/ui/components/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import { CalendarDays, Clock, Repeat as RepeatIcon } from "lucide-react";
import { cloneElement, useEffect, useRef, useState } from "react";

import type { PickerProps } from "./parts";

import {
  chip,
  dayName,
  landOn,
  MonthCalendar,
  RepeatChoices,
  Section,
  TimeInput,
  timeOf,
  whenSummary,
} from "./parts";

/**
 * A dialog, centred and roomy, that sets the whole When as a draft: day, time
 * and Repeat change only the summary at the top until Save writes them. A
 * phone gets it as a drawer. Nothing anchors it, so a card moving to its new
 * day underneath doesn't matter.
 */
export function DialogPicker({
  clearLabel = "Remove date",
  onSetWhen,
  repeat,
  title,
  trigger,
  when,
}: PickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {cloneElement(trigger as ReactElement<{ onClick?: () => void }>, {
        onClick: () => setOpen(true),
      })}
      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        {open && (
          <Draft
            title={title}
            when={when}
            repeat={repeat?.value}
            holdsRepeat={repeat !== undefined}
            clearLabel={clearLabel}
            onCancel={() => setOpen(false)}
            onSave={(next) => {
              if (next.when !== when) void onSetWhen(next.when);
              if (repeat && !sameRepeat(next.repeat, repeat.value))
                void repeat.onChange(next.repeat ?? null);
              setOpen(false);
            }}
          />
        )}
      </ResponsiveDialog>
    </>
  );
}

function Draft({
  clearLabel,
  holdsRepeat,
  onCancel,
  onSave,
  repeat: initialRepeat,
  title,
  when: initialWhen,
}: {
  clearLabel: string;
  holdsRepeat: boolean;
  onCancel: () => void;
  onSave: (next: {
    when: number | undefined;
    repeat: Repeat | undefined;
  }) => void;
  repeat: Repeat | undefined;
  title: string;
  when: number | undefined;
}) {
  const [when, setWhen] = useState(initialWhen);
  const [repeat, setRepeat] = useState(initialRepeat);
  const time = timeOf(when);
  const changed = when !== initialWhen || !sameRepeat(repeat, initialRepeat);

  function pickDay(day: number) {
    const next = landOn(day, when);
    // As the server would: a weekly Repeat keeps the date on a chosen day.
    setWhen(
      repeat === undefined
        ? next
        : snapTaskDate(next, repeat, browserTimeZone()),
    );
  }

  // The content doesn't pass a key handler on, so ⌘↵ listens on the window while the draft is open.
  const save = useRef(() => onSave({ when, repeat }));
  save.current = () => onSave({ when, repeat });
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      save.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ResponsiveDialogContent className="sm:max-w-[42rem]">
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="truncate pr-8">
          {title}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          {whenSummary(when, repeat)}
          {changed && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
              Not saved
            </span>
          )}
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <div className="flex flex-col gap-6 sm:flex-row">
        <MonthCalendar
          when={when}
          onPick={pickDay}
          className="self-center [--cell-size:--spacing(9)] sm:self-start"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Section icon={<CalendarDays />} label="Day">
            <div className="grid grid-cols-3 gap-1">
              {quickPicks(clock.now()).map((pick) => (
                <button
                  key={pick.label}
                  type="button"
                  aria-pressed={
                    when !== undefined && startOfLocalDay(when) === pick.day
                  }
                  onClick={() => pickDay(pick.day)}
                  className={`${chip} flex h-auto flex-col items-start rounded-xl px-2.5 py-1 text-left`}
                >
                  <span className="text-xs">{pick.label}</span>
                  <span className="text-[0.65rem] font-normal opacity-70">
                    {dayName(pick.day)}
                  </span>
                </button>
              ))}
            </div>
          </Section>
          <Section icon={<Clock />} label="Time">
            <TimeInput
              disabled={when === undefined}
              time={time}
              onPick={(next) => {
                if (when !== undefined) setWhen(withTimeOfDay(when, next));
              }}
            />
          </Section>
          {holdsRepeat && (
            <Section icon={<RepeatIcon />} label="Repeat">
              <RepeatChoices
                layout="chips"
                when={when}
                value={repeat}
                onPick={(next) => {
                  setRepeat(next ?? undefined);
                  if (next !== null && when !== undefined)
                    setWhen(snapTaskDate(when, next, browserTimeZone()));
                }}
              />
            </Section>
          )}
        </div>
      </div>

      <ResponsiveDialogFooter className="sm:justify-between">
        {initialWhen === undefined ? (
          <span />
        ) : (
          <Button
            variant="ghost"
            onClick={() => onSave({ when: undefined, repeat: undefined })}
          >
            {clearLabel}
          </Button>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onSave({ when, repeat })} disabled={!changed}>
            Save <span className="ml-1 text-xs opacity-60">⌘↵</span>
          </Button>
        </div>
      </ResponsiveDialogFooter>
    </ResponsiveDialogContent>
  );
}
