import { cn } from "@/lib/utils";

/**
 * PROTOTYPE — issue #314, round 4. The quick-stat strip, kept from D2 because
 * it was the part of round 3 that worked: five numbers, no prose.
 */
import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta } from "../components/dashboard-model";

export function StatStrip({
  currentDate,
  entries,
}: {
  currentDate: number;
  entries: PrototypeEntry[];
}) {
  const count = (test: (entry: PrototypeEntry) => boolean) =>
    entries.filter(test).length;

  const delta = (entry: PrototypeEntry) =>
    entry.when === undefined ? undefined : dayDelta(entry.when, currentDate);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Stat
        label="Late"
        urgent
        value={count((entry) => (delta(entry) ?? 1) < 0)}
      />
      <Stat label="Today" value={count((entry) => delta(entry) === 0)} />
      <Stat
        label="This week"
        value={count((entry) => {
          const d = delta(entry);
          return d !== undefined && d >= 1 && d <= 6;
        })}
      />
      <Stat
        label="Ready to move"
        value={count((entry) => entry.when === undefined && entry.isNextMove)}
      />
      <Stat label="Open" muted value={entries.length} />
    </div>
  );
}

function Stat({
  label,
  muted,
  urgent,
  value,
}: {
  label: string;
  muted?: boolean;
  urgent?: boolean;
  value: number;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span
        className={cn(
          "text-xl font-semibold leading-none tabular-nums",
          urgent && value > 0 && "text-condition-attention",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
        {label}
      </span>
    </span>
  );
}
