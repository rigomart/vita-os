import type { Repeat } from "@vita-os/contracts";
import type * as React from "react";
import type { ComponentType } from "react";

import { followUpDateLabels } from "@vita-os/application/internal/attention-list/follow-up-date.ts";
import { repeatShortLabel } from "@vita-os/application/internal/attention-list/repeat.ts";
import { clock } from "@vita-os/application/internal/lib/clock.ts";
import { browserTimeZone } from "@vita-os/application/internal/lib/time-zone.ts";
import { snapTaskDate, startOfLocalDay, withTimeOfDay } from "@vita-os/core";
import { cn } from "@vita-os/ui/lib/utils";
import { CalendarClock, Circle, Repeat as RepeatIcon } from "lucide-react";
import { useState } from "react";

import type { PickerProps } from "./parts";

import { whenSummary } from "./parts";

interface Item {
  id: string;
  text: string;
  /** A Note's Follow-up date holds no Repeat. */
  kind: "task" | "note";
  when?: number;
  repeat?: Repeat;
}

type Entry = { at: number; text: string };

/** Local midnight `days` from today. */
function inDays(days: number): number {
  const date = new Date(startOfLocalDay(clock.now()));
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function seed(): Item[] {
  return [
    {
      id: "row",
      kind: "task",
      text: "Renew the passport",
      when: withTimeOfDay(inDays(2), "09:00"),
      repeat: undefined,
    },
    { id: "row-undated", kind: "task", text: "Call the plumber back" },
    {
      id: "card",
      kind: "task",
      text: "Water the plants",
      when: inDays(1),
      repeat: { kind: "weekly", weekdays: [new Date(inDays(1)).getDay()] },
    },
    {
      id: "note",
      kind: "note",
      text: "Ideas for the kitchen",
      when: inDays(7),
    },
    {
      id: "low",
      kind: "task",
      text: "Book the annual check-up",
      when: inDays(-1),
    },
  ];
}

/**
 * The picker where it opens in the app: a Task's row in Thread detail, which
 * keeps it open on a pick, a Dashboard card and a Note, which close it, and a
 * card low on the screen. Every write lands in the log, as the app would send it.
 */
export function PickerStage({
  picker: Picker,
}: {
  picker: ComponentType<PickerProps>;
}) {
  const [items, setItems] = useState(seed);
  const [log, setLog] = useState<Entry[]>([]);

  /** Applies `change` to the item as it is by then, so two writes in one go both land. */
  function write(
    id: string,
    change: (item: Item) => Partial<Item>,
    text: string,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...change(item) } : item,
      ),
    );
    setLog((current) => [{ at: clock.now(), text }, ...current].slice(0, 30));
  }

  function props(item: Item, keepOpenOnPick: boolean): PickerProps {
    return {
      title: item.text,
      when: item.when,
      keepOpenOnPick,
      ...(item.kind === "note"
        ? { clearLabel: followUpDateLabels.clear }
        : {
            clearLabel: "Remove date",
            repeat: {
              value: item.repeat,
              onChange: (repeat: Repeat | null) => {
                write(
                  item.id,
                  (current) => ({
                    repeat: repeat ?? undefined,
                    // The server moves a weekly Repeat's date to its first chosen day.
                    when:
                      repeat === null || current.when === undefined
                        ? current.when
                        : snapTaskDate(current.when, repeat, browserTimeZone()),
                  }),
                  `${item.text}: repeat → ${repeat === null ? "none" : repeatShortLabel(repeat)}`,
                );
              },
            },
          }),
      onSetWhen: (when) =>
        write(
          item.id,
          () => (when === undefined ? { when, repeat: undefined } : { when }),
          `${item.text}: date → ${whenSummary(when, undefined)}`,
        ),
      trigger: <Trigger item={item} />,
    };
  }

  const [row, rowUndated, card, note, low] = items as [
    Item,
    Item,
    Item,
    Item,
    Item,
  ];

  return (
    <div className="flex min-h-dvh flex-col gap-8 bg-background px-4 py-6 text-sm md:flex-row md:px-8 md:py-8">
      <div className="flex max-w-xl flex-1 flex-col gap-8">
        <Frame
          title="Thread detail · Task rows"
          note="Stays open on a pick, so a time or a Repeat can follow."
        >
          <div className="flex flex-col divide-y rounded-2xl border bg-popover px-4">
            {[row, rowUndated].map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2.5">
                <Circle className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{item.text}</span>
                <Picker {...props(item, true)} />
              </div>
            ))}
          </div>
        </Frame>

        <div className="grid gap-4 sm:grid-cols-2">
          <Frame
            title="Dashboard card"
            note="A pick closes it: the card moves to its new day."
          >
            <Card item={card}>
              <Picker {...props(card, false)} />
            </Card>
          </Frame>
          <Frame title="Note · Follow-up date" note="No Repeat.">
            <Card item={note}>
              <Picker {...props(note, false)} />
            </Card>
          </Frame>
        </div>

        <div className="h-[40vh]" />
        <div className="sticky bottom-4 w-64">
          <Frame title="Card low on the screen">
            <Card item={low}>
              <Picker {...props(low, false)} />
            </Card>
          </Frame>
        </div>
      </div>

      <aside className="flex h-fit w-full shrink-0 flex-col gap-2 md:sticky md:top-8 md:w-72">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-muted-foreground">
            Writes, newest first
          </h2>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setItems(seed());
              setLog([]);
            }}
          >
            Reset
          </button>
        </div>
        <ol className="flex flex-col gap-1 rounded-2xl border bg-popover p-3 text-xs">
          {log.length === 0 && (
            <li className="text-muted-foreground">Nothing written yet.</li>
          )}
          {log.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="flex gap-2">
              <span className="text-muted-foreground tabular-nums">
                {new Date(entry.at).toLocaleTimeString("en-GB")}
              </span>
              <span>{entry.text}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          {log.length} {log.length === 1 ? "write" : "writes"}. Each would be
          one request.
        </p>
      </aside>
    </div>
  );
}

function Frame({
  children,
  note,
  title,
}: {
  children: React.ReactNode;
  note?: string;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex flex-col">
        <h2 className="text-xs font-medium">{title}</h2>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </header>
      {children}
    </section>
  );
}

function Card({ children, item }: { children: React.ReactNode; item: Item }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-popover p-4">
      <span className="font-medium">{item.text}</span>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {children}
        <span>{item.kind === "note" ? "Note" : "Home"}</span>
      </div>
    </div>
  );
}

/** The date as a card writes it, or the bare control on an undated item. */
function Trigger({
  item,
  ...rest
}: { item: Item } & React.ComponentProps<"button">) {
  if (item.when === undefined) {
    return (
      <button
        type="button"
        aria-label="Set date"
        className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        {...rest}
      >
        <CalendarClock className="size-3.5" />
      </button>
    );
  }
  const late = item.when < startOfLocalDay(clock.now());
  return (
    <button
      type="button"
      aria-label="Change date"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs tabular-nums hover:bg-muted",
        late ? "text-destructive" : "text-muted-foreground",
      )}
      {...rest}
    >
      {whenSummary(item.when, undefined)}
      {item.repeat && <RepeatIcon className="size-3" />}
    </button>
  );
}
