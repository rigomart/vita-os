/**
 * PROTOTYPE — issue #314, round 4. The card every variant now shares.
 *
 * Round 3 showed the Next Move *instead of* the Thread title, which was
 * disorienting — you could not tell which Thread you were looking at. So the
 * card is explicitly two-part: the Thread is the headline, the Next Move is
 * the subordinate line under it. Both are visible at rest; neither is prose.
 *
 * The card is held constant across E1/E2/E3 on purpose — round 4 is about
 * where cards go and how time is drawn, not about the card itself.
 */
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta } from "../components/dashboard-model";
import { AreaGlyph, DateToken } from "./dense-shared";
import { EntryLink } from "./prototype-shared";

export function AttentionCard({
  currentDate,
  entry,
  flat,
}: {
  currentDate: number;
  entry: PrototypeEntry;
  /** Inside an already-bounded column, the border is noise. */
  flat?: boolean;
}) {
  const late =
    entry.when !== undefined && dayDelta(entry.when, currentDate) < 0;
  const due =
    entry.when !== undefined && dayDelta(entry.when, currentDate) === 0;
  const move = entry.isNextMove ? entry.detail : undefined;

  return (
    <EntryLink
      entry={entry}
      className={cn(
        "h-full rounded-lg px-2.5 py-2 transition-colors",
        flat
          ? "hover:bg-muted/60"
          : "border border-border/60 hover:border-border hover:bg-muted/30",
        !flat && late && "border-condition-attention/45",
        !flat && due && "border-foreground/25",
        flat && late && "bg-condition-attention/[0.05]",
      )}
    >
      <div className="flex items-start gap-2">
        <AreaGlyph entry={entry} className="mt-0.5" />
        <span className="min-w-0 flex-1 text-sm font-medium leading-snug line-clamp-2">
          {entry.title}
        </span>
        <DateToken
          className="mt-0.5"
          currentDate={currentDate}
          when={entry.when}
        />
      </div>

      {move && (
        <p className="mt-1 flex items-start gap-1 pl-5 text-[13px] leading-snug text-muted-foreground">
          <ArrowRight aria-hidden className="mt-0.5 size-3 shrink-0" />
          <span className="line-clamp-2">{move}</span>
        </p>
      )}
    </EntryLink>
  );
}
