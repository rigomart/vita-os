import {
  itemKey,
  type BoardGroup,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { DashboardItem } from "@vita-os/application/internal/dashboard/components/dashboard-item.tsx";
import { groupLook } from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";
import { cn } from "@vita-os/ui/lib/utils";

import type { ListProps } from "./board";

import { groupDay } from "./board";
import { ItemRow } from "./row";

const isNow = (group: BoardGroup) =>
  group.tone === "late" || group.tone === "today";

/**
 * Agenda: no boxes. Each group is a band of lines with its day in a gutter
 * at the left, like a calendar's schedule view: the date's number large, its
 * weekday and how far out under it. The gutter sticks while its lines
 * scroll. Today is the one band with a fill; Late is marked by its colour
 * alone.
 */
export function AgendaList({ groups, scope }: ListProps) {
  return (
    <div className="flex flex-col pt-1">
      {groups.map((group, index) => {
        const today = group.tone === "today";
        const previousToday = groups[index - 1]?.tone === "today";
        return (
          <section
            key={group.key}
            aria-label={group.label}
            className={cn(
              "grid grid-cols-[4rem_minmax(0,1fr)] gap-x-2 py-2.5 @2xl:grid-cols-[6.5rem_minmax(0,1fr)] @2xl:gap-x-4",
              today
                ? "-mx-2 my-1 rounded-2xl bg-surface-2 px-2"
                : index > 0 && !previousToday && "border-t border-border/60",
            )}
          >
            <AgendaGutter group={group} currentDate={scope.currentDate} />
            <ul className="flex flex-col">
              {group.items.map((item) => (
                <li key={itemKey(item)}>
                  <ItemRow
                    item={item}
                    scope={scope}
                    dateInHeading={group.exact}
                    loud={isNow(group)}
                    quiet={group.tone === "far"}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function AgendaGutter({
  currentDate,
  group,
}: {
  currentDate: number;
  group: BoardGroup;
}) {
  const day = groupDay(group, currentDate);
  const { distance } = groupLook(group);
  const count = (
    <span className="text-xs tabular-nums text-muted-foreground/60">
      {group.items.length}
    </span>
  );
  return (
    <h2 className="sticky top-20 self-start pt-1.5 pl-1">
      {group.tone === "late" ? (
        <span className="flex items-baseline gap-1.5 font-heading text-lg font-semibold tracking-tight text-condition-attention">
          Late {count}
        </span>
      ) : group.exact ? (
        <span className="flex flex-col">
          <span
            className={cn(
              "text-[11px] font-semibold tracking-wider uppercase",
              distance === 0 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {group.tone === "today" || group.tone === "near"
              ? group.label
              : weekday(day, "short")}
          </span>
          <span
            className={cn(
              "font-heading leading-none tracking-tight tabular-nums",
              distance === 0
                ? "text-4xl font-semibold"
                : distance === 1
                  ? "text-3xl font-semibold text-foreground/85"
                  : "text-2xl font-medium text-foreground/65",
            )}
          >
            {new Date(day).getDate()}
          </span>
          <span className="pt-0.5 text-[11px] text-muted-foreground/70">
            {group.tone === "today" || group.tone === "near"
              ? weekday(day, "short")
              : group.hint}
          </span>
        </span>
      ) : (
        <span className="flex flex-col">
          <span className="text-[13px] font-medium text-muted-foreground">
            {group.label}
          </span>
          {group.hint && (
            <span className="text-[11px] text-muted-foreground/60">
              {group.hint}
            </span>
          )}
        </span>
      )}
    </h2>
  );
}

/**
 * Spotlight: one raised panel for what is asking, Late and Today together,
 * in the cards as they ship. Everything after it is a quiet list of lines
 * under plain headings, with no fills: there to be known about, not read.
 */
export function SpotlightList({ groups, scope }: ListProps) {
  const late = groups.find((group) => group.tone === "late");
  const today = groups.find((group) => group.tone === "today");
  const rest = groups.filter((group) => !isNow(group));
  const asking = (late?.items.length ?? 0) + (today?.items.length ?? 0);

  return (
    <div className="flex flex-col gap-8 pt-2">
      <section
        aria-label="Today"
        className="rounded-3xl border border-border/70 bg-surface-2 p-3 shadow-sm @2xl:p-4"
      >
        <h2 className="flex items-baseline gap-2.5 px-1 pb-3">
          <span className="font-heading text-2xl font-semibold tracking-tight">
            Today
          </span>
          <span className="text-xs tabular-nums text-muted-foreground/70">
            {asking}
          </span>
        </h2>
        {asking === 0 && (
          <p className="px-1 pb-2 text-sm text-muted-foreground">
            Nothing comes due today.
          </p>
        )}
        {late && (
          <div className="pb-3">
            <h3 className="flex items-baseline gap-2 px-1 pb-1.5 text-[13px] font-semibold text-condition-attention">
              Late
              <span className="font-normal tabular-nums opacity-70">
                {late.items.length}
              </span>
            </h3>
            <Cards group={late} scope={scope} />
          </div>
        )}
        {today && (
          <div>
            {late && (
              <h3 className="flex items-baseline gap-2 px-1 pb-1.5 text-[13px] font-semibold text-muted-foreground">
                Due today
                <span className="font-normal tabular-nums opacity-70">
                  {today.items.length}
                </span>
              </h3>
            )}
            <Cards group={today} scope={scope} />
          </div>
        )}
      </section>

      {rest.length > 0 && (
        <div className="flex flex-col">
          <h2 className="px-1 pb-2 text-[13px] font-semibold tracking-wider text-muted-foreground uppercase">
            Coming up
          </h2>
          {rest.map((group) => {
            const { distance } = groupLook(group);
            return (
              <section
                key={group.key}
                aria-label={group.label}
                className="border-t border-border/60 py-2"
              >
                <h3 className="flex items-baseline gap-2 px-1 pt-1 pb-0.5">
                  <span
                    className={cn(
                      "font-heading tracking-tight",
                      distance <= 1
                        ? "text-base font-semibold"
                        : distance <= 3
                          ? "text-[15px] font-medium text-foreground/85"
                          : "text-sm font-medium text-muted-foreground",
                    )}
                  >
                    {group.label}
                  </span>
                  {group.hint && (
                    <span className="text-xs text-muted-foreground/70">
                      {group.hint}
                    </span>
                  )}
                </h3>
                <ul className="-mx-1">
                  {group.items.map((item) => (
                    <li key={itemKey(item)}>
                      <ItemRow
                        item={item}
                        scope={scope}
                        dateInHeading={group.exact}
                        quiet={group.tone === "far"}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cards({
  group,
  scope,
}: {
  group: BoardGroup;
  scope: ListProps["scope"];
}) {
  return (
    <ul className="grid gap-1.5 @2xl:grid-cols-2">
      {group.items.map((item) => (
        <li key={itemKey(item)}>
          <DashboardItem
            dateInHeading={group.exact}
            item={item}
            scope={scope}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Day pages: each group is one sheet, a page of a day planner, with its
 * date at the head and its items as ruled lines on it. The sheet is the day,
 * not each item. Nearer pages stand out more; Late's page has a warm edge.
 * From next week on there is no page, only a heading and its lines.
 */
export function PagesList({ groups, scope }: ListProps) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      {groups.map((group) => {
        const { distance } = groupLook(group);
        const late = group.tone === "late";
        const far = group.tone === "far";
        const day = groupDay(group, scope.currentDate);
        return (
          <section
            key={group.key}
            aria-label={group.label}
            className={cn(
              far ? "pt-2" : "overflow-hidden rounded-2xl border bg-card",
              !far &&
                (late
                  ? "border-condition-attention/35 bg-[color-mix(in_oklab,var(--color-condition-attention)_5%,var(--color-card))]"
                  : distance === 0
                    ? "border-border shadow-md"
                    : distance <= 2
                      ? "border-border/80"
                      : "border-border/50 bg-transparent"),
            )}
          >
            <h2
              className={cn(
                "flex items-center gap-3 px-4",
                far ? "pb-1" : "pt-3 pb-1.5",
              )}
            >
              {group.exact && (
                <span
                  className={cn(
                    "font-heading leading-none tabular-nums tracking-tight",
                    distance === 0
                      ? "text-3xl font-semibold"
                      : distance === 1
                        ? "text-2xl font-semibold text-foreground/80"
                        : "text-xl font-medium text-foreground/55",
                  )}
                >
                  {new Date(day).getDate()}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span
                  className={cn(
                    "font-heading tracking-tight",
                    late
                      ? "text-lg font-semibold text-condition-attention"
                      : distance === 0
                        ? "text-base font-semibold"
                        : far
                          ? "text-sm font-medium text-muted-foreground"
                          : "text-[15px] font-medium text-foreground/85",
                  )}
                >
                  {group.label}
                </span>
                {(group.hint ??
                  (group.tone === "today"
                    ? weekday(day, "long")
                    : undefined)) && (
                  <span className="text-xs text-muted-foreground/70">
                    {group.hint ?? weekday(day, "long")}
                  </span>
                )}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground/60">
                {group.items.length}
              </span>
            </h2>
            <ul
              className={cn(
                "divide-y divide-border/50",
                far ? "px-1.5" : "px-1.5 pb-1.5",
              )}
            >
              {group.items.map((item) => (
                <li key={itemKey(item)} className="py-px">
                  <ItemRow
                    item={item}
                    scope={scope}
                    dateInHeading={group.exact}
                    loud={isNow(group)}
                    quiet={far}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function weekday(day: number, width: "long" | "short") {
  return new Date(day).toLocaleDateString("en-US", { weekday: width });
}
