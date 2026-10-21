import { quickPicks } from "@vita-os/application/internal/attention-list/quick-picks.ts";
import { clock } from "@vita-os/application/internal/lib/clock.ts";
import { startOfLocalDay, withTimeOfDay } from "@vita-os/core";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { CalendarDays, Clock, Repeat as RepeatIcon, X } from "lucide-react";
import { useState } from "react";

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
 * Everything in view at once, in a popover twice as wide: the calendar on
 * the left; the quick picks, the time and the Repeat on the right. No pages.
 * It stays open on every pick, since the rest is right there.
 */
export function WidePicker({
  clearLabel = "Remove date",
  onSetWhen,
  repeat,
  trigger,
  when,
}: PickerProps) {
  const [open, setOpen] = useState(false);
  const time = timeOf(when);
  const pickDay = (day: number) => void onSetWhen(landOn(day, when));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent className="w-auto gap-0 p-0" align="end">
        <div className="flex">
          <div className="border-r p-3">
            <MonthCalendar when={when} onPick={pickDay} />
          </div>
          <div className="flex w-64 flex-col gap-4 p-3">
            <Section icon={<CalendarDays />} label="Day">
              <div className="grid grid-cols-2 gap-1">
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
                  if (when !== undefined)
                    void onSetWhen(withTimeOfDay(when, next));
                }}
              />
            </Section>
            {repeat !== undefined && (
              <Section icon={<RepeatIcon />} label="Repeat">
                <RepeatChoices
                  layout="chips"
                  when={when}
                  value={repeat.value}
                  onPick={(next) => void repeat.onChange(next)}
                />
              </Section>
            )}
          </div>
        </div>
        <footer className="flex items-center gap-2 border-t px-4 py-2 text-xs">
          <span className="flex-1 text-muted-foreground">
            {whenSummary(when, repeat?.value)}
          </span>
          {when !== undefined && (
            <button
              type="button"
              onClick={() => {
                void onSetWhen(undefined);
                setOpen(false);
              }}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3"
            >
              <X />
              {clearLabel}
            </button>
          )}
        </footer>
      </PopoverContent>
    </Popover>
  );
}
