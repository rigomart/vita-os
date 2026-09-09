/**
 * PROTOTYPE — issue #314, round 6. Three header bands over the settled E1
 * layout and C1 card.
 *
 * The tension being tested: the Dashboard now wants two summaries at once — a
 * time-shaped one (the counts) and a space-shaped one (which Areas are
 * slipping) — and E1's columns are full-height, so every rem the header takes
 * comes off the board. H1 pays the most for the most information, H2 pays the
 * least and leans on the panel, H3 buys a middle ground by giving each Area
 * its own count.
 *
 * All three: clicking an Area opens the Quick Panel (condition segments +
 * capture). Only the header varies; nothing below it moves.
 */
import type { Condition } from "@convex/lib/condition";

import { conditionLabels } from "@convex/lib/condition";
import { format } from "date-fns";

import { AreaIcon } from "@/features/areas/components/area-icon";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type { DashboardArea } from "../components/dashboard-model";
import type { PrototypeEntry } from "./prototype-shared";

import { dayDelta } from "../components/dashboard-model";
import { dateToken } from "./dense-shared";
import { PrototypeAreaPanel } from "./prototype-area-panel";
import { StatStrip } from "./stat-strip";

export interface HeaderVariant {
  Header: (props: HeaderProps) => React.ReactElement;
  claim: string;
  key: string;
  name: string;
}

export interface HeaderProps {
  areas: DashboardArea[];
  currentDate: number;
  entries: PrototypeEntry[];
  onConditionChange: (areaId: string, condition: Condition) => void;
}

/** Attention items belonging to one Area — the number a tile shows. */
function pending(entries: PrototypeEntry[], areaId: string) {
  return entries.filter((entry) => entry.area?.id === areaId);
}

/** Worst condition first, then authored order. */
function worstFirst(a: DashboardArea, b: DashboardArea) {
  const rank = (area: DashboardArea) =>
    area.condition === "critical" ? 0 : area.condition === "healthy" ? 2 : 1;
  return rank(a) - rank(b) || a.order - b.order;
}

/**
 * The loudest thing this Area's Threads can say, in the order a person would
 * say it: the soonest dated move, else any captured move, else nothing.
 */
function reasonFor(entries: PrototypeEntry[], currentDate: number) {
  const soonest = entries
    .filter((entry) => entry.when !== undefined)
    .sort((a, b) => (a.when ?? 0) - (b.when ?? 0))[0];
  if (soonest) {
    return {
      text: soonest.isNextMove ? soonest.detail : soonest.title,
      token: dateToken(soonest.when ?? 0, currentDate),
      late: dayDelta(soonest.when ?? 0, currentDate) < 0,
    };
  }
  const move = entries.find((entry) => entry.isNextMove);
  if (move) return { text: move.detail, token: undefined, late: false };
  return { text: undefined, token: undefined, late: false };
}

/* ── H1 · Two bands ───────────────────────────────────────────────────────
   Production's shape, kept honest: only Areas that are not healthy get words,
   healthy ones trail as a glyph cluster, and the counts sit on their own line
   underneath. The most information and the most height — the question is
   whether the reason text still earns its line now that every card below
   already says what to do. */
function TwoBands({
  areas,
  currentDate,
  entries,
  onConditionChange,
}: HeaderProps) {
  const attention = areas
    .filter((area) => area.condition !== "healthy")
    .sort(worstFirst);
  const steady = areas
    .filter((area) => area.condition === "healthy")
    .sort((a, b) => a.order - b.order);
  const SteadyIcon = conditionIcons.healthy;

  return (
    <div className="flex flex-col gap-2 border-b border-border/50 pb-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <time
          dateTime={new Date(currentDate).toISOString()}
          className="shrink-0 text-xs text-muted-foreground"
        >
          <span className="font-semibold text-foreground">
            {format(new Date(currentDate), "EEE")}
          </span>{" "}
          · {format(new Date(currentDate), "MMM d")}
        </time>

        {attention.map((area) => {
          const reason = reasonFor(pending(entries, area.id), currentDate);
          return (
            <PrototypeAreaPanel
              key={area.id}
              area={area}
              onConditionChange={onConditionChange}
              trigger={
                <button
                  type="button"
                  aria-label={`Area panel for ${area.name}`}
                  className="group flex min-w-0 max-w-[22rem] items-center gap-1.5 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              }
            >
              <span
                className={cn(
                  "inline-flex shrink-0",
                  conditionTextClassName[area.condition],
                )}
              >
                <AreaIcon icon={area.icon} className="size-4" />
              </span>
              <span className="shrink-0 text-sm font-medium underline-offset-4 group-hover:underline">
                {area.name}
              </span>
              {reason.text && (
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {reason.token && (
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        reason.late
                          ? "text-condition-attention"
                          : "text-foreground/70",
                      )}
                    >
                      {reason.token} ·{" "}
                    </span>
                  )}
                  {reason.text}
                </span>
              )}
            </PrototypeAreaPanel>
          );
        })}

        {steady.length > 0 && (
          <span className="flex items-center gap-0.5 sm:ml-auto">
            <SteadyIcon
              aria-hidden
              className={cn("size-3.5", conditionTextClassName.healthy)}
            />
            {steady.map((area) => (
              <PrototypeAreaPanel
                key={area.id}
                area={area}
                onConditionChange={onConditionChange}
                trigger={
                  <button
                    type="button"
                    aria-label={`Area panel for ${area.name}`}
                    title={`${area.name} — steady`}
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                  />
                }
              >
                <AreaIcon icon={area.icon} className="size-3.5" />
              </PrototypeAreaPanel>
            ))}
          </span>
        )}
      </div>

      <StatStrip currentDate={currentDate} entries={entries} />
    </div>
  );
}

/* ── H2 · Merged bar ──────────────────────────────────────────────────────
   One row. Areas are chips carrying only icon, name and condition colour; the
   five counts sit at the right end. No reason text at all — the "why" is one
   click away in the panel. Cheapest in height, most reliant on colour and on
   the panel being genuinely quick. */
function MergedBar({
  areas,
  currentDate,
  entries,
  onConditionChange,
}: HeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/50 pb-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {[...areas].sort(worstFirst).map((area) => (
          <PrototypeAreaPanel
            key={area.id}
            area={area}
            onConditionChange={onConditionChange}
            trigger={
              <button
                type="button"
                aria-label={`Area panel for ${area.name}`}
                title={`${area.name} — ${conditionLabels[area.condition]}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40",
                  area.condition === "healthy"
                    ? "border-border/60 text-muted-foreground"
                    : "border-current/30",
                  area.condition !== "healthy" &&
                    conditionTextClassName[area.condition],
                )}
              />
            }
          >
            <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
            <span className="max-w-[8rem] truncate font-medium">
              {area.name}
            </span>
            <span className="tabular-nums opacity-60">
              {pending(entries, area.id).length}
            </span>
          </PrototypeAreaPanel>
        ))}
      </div>

      <div className="ml-auto">
        <StatStrip currentDate={currentDate} entries={entries} />
      </div>
    </div>
  );
}

/* ── H3 · Area tiles ──────────────────────────────────────────────────────
   Each Area gets a tile: icon, name, its own pending count, condition as a
   coloured base rule, and its soonest date as a token. "Health is critical
   and has four things pending, the first of them six days late" is readable
   without opening anything — and the tile is a click target with real size.
   The global counts fold into the end of the same row. */
function AreaTiles({
  areas,
  currentDate,
  entries,
  onConditionChange,
}: HeaderProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/50 pb-3">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6">
        {[...areas].sort(worstFirst).map((area) => {
          const own = pending(entries, area.id);
          const reason = reasonFor(own, currentDate);
          const ConditionIcon = conditionIcons[area.condition];

          return (
            <PrototypeAreaPanel
              key={area.id}
              area={area}
              onConditionChange={onConditionChange}
              trigger={
                <button
                  type="button"
                  aria-label={`Area panel for ${area.name}`}
                  className="flex min-w-0 flex-col gap-1 rounded-lg border border-border/60 px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              }
            >
              <span className="flex w-full min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex shrink-0",
                    conditionTextClassName[area.condition],
                  )}
                >
                  <AreaIcon icon={area.icon} className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {area.name}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                  {own.length}
                </span>
              </span>
              <span className="flex w-full items-center gap-1.5">
                <ConditionIcon
                  aria-hidden
                  className={cn(
                    "size-3 shrink-0",
                    conditionTextClassName[area.condition],
                  )}
                />
                <span
                  className={cn(
                    "truncate text-2xs",
                    area.condition === "healthy"
                      ? "text-muted-foreground/60"
                      : conditionTextClassName[area.condition],
                  )}
                >
                  {conditionLabels[area.condition]}
                </span>
                {reason.token && (
                  <span
                    className={cn(
                      "ml-auto shrink-0 text-2xs tabular-nums",
                      reason.late
                        ? "text-condition-attention"
                        : "text-muted-foreground/60",
                    )}
                  >
                    {reason.token}
                  </span>
                )}
              </span>
            </PrototypeAreaPanel>
          );
        })}
      </div>

      <StatStrip currentDate={currentDate} entries={entries} />
    </div>
  );
}

export const HEADER_VARIANTS: HeaderVariant[] = [
  {
    key: "H1",
    name: "Two bands",
    claim:
      "Areas with their reason on top, counts underneath — production's shape. Most information, most height.",
    Header: TwoBands,
  },
  {
    key: "H2",
    name: "Merged bar",
    claim:
      "One row: Area chips with condition colour and a count, the five stats at the right end. Cheapest in height, leans on the panel for the why.",
    Header: MergedBar,
  },
  {
    key: "H3",
    name: "Area tiles",
    claim:
      "A tile per Area — name, its own pending count, condition, soonest date — with the global counts below. Bigger click target, more to read.",
    Header: AreaTiles,
  },
];
