import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { format } from "date-fns";

import type { ActivityLogEntryReading } from "../activity-log-entry";

/** A small line's icon on the rail, without a ring. */
export function BareNode({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="relative flex size-6 shrink-0 items-center justify-center bg-popover text-muted-foreground/60">
      <Icon aria-hidden className="size-3" />
    </span>
  );
}

/** A line's sentence. `trailing` follows the last word and never wraps away from it. */
export function Sentence({
  reading,
  trailing,
}: {
  reading: ActivityLogEntryReading;
  trailing?: ReactNode;
}) {
  const quiet = "text-muted-foreground";
  const parts = [
    { text: reading.action, className: quiet },
    reading.subject !== undefined && {
      text: ` ${reading.subject}`,
      className: "text-foreground/75",
    },
    reading.from !== undefined && {
      text: `, from ${reading.from}`,
      className: quiet,
    },
    reading.times !== undefined && {
      text: ` ${reading.times} times`,
      className: quiet,
    },
    reading.aside !== undefined && { text: reading.aside, className: quiet },
  ].filter((part) => part !== false);

  return parts.map(({ text, className }, index) => {
    if (trailing === undefined || index < parts.length - 1) {
      return (
        <span key={index} className={className}>
          {text}
        </span>
      );
    }
    const cut = text.lastIndexOf(" ") + 1;
    return (
      <span key={index} className={className}>
        {text.slice(0, cut)}
        <span className="whitespace-nowrap">
          {text.slice(cut)}
          {trailing}
        </span>
      </span>
    );
  });
}

/** A line's time, at one size whatever the line's weight. */
export function Time({ at }: { at: number }) {
  const date = new Date(at);
  return (
    <time
      dateTime={date.toISOString()}
      title={format(date, "PPpp")}
      className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground tabular-nums"
    >
      {format(date, "h:mm a")}
    </time>
  );
}

export const OPENABLE_LINE_HOVER =
  "rounded-lg transition-colors hover:bg-muted/50 has-focus-visible:bg-muted/60 motion-reduce:transition-none";
