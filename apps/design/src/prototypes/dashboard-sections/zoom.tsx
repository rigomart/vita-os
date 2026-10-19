import type { BoardScope } from "@vita-os/application/internal/dashboard/components/dashboard-item.tsx";
import type { ProductSearch } from "@vita-os/application/internal/navigation/search-params.ts";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { timeToken } from "@vita-os/application/internal/attention-list/index.ts";
import {
  itemKey,
  type BoardGroup,
  type BoardItem,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { itemTitle } from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";
import { ThreadCopy } from "@vita-os/application/internal/dashboard/components/thread-copies.tsx";
import { cn } from "@vita-os/ui/lib/utils";
import { Repeat as RepeatIcon } from "lucide-react";

import type { ListProps } from "./board";

import { groupDay, isNow, weekday } from "./board";
import { ItemRow, NoteMark } from "./row";

/**
 * Zoom: an item changes form with distance, as things do when they come
 * closer. Late and Today are big, one to a row, with room to act on them.
 * The rest of the week is one row per day, its items as small chips that
 * open them. Weeks and months are a single line of names.
 */
export function ZoomList({ groups, scope }: ListProps) {
  const now = groups.filter(isNow);
  const week = groups.filter((group) => !isNow(group) && group.exact);
  const far = groups.filter((group) => !isNow(group) && !group.exact);

  return (
    <div className="flex flex-col gap-7 pt-2">
      {now.length > 0 && (
        <div className="flex flex-col gap-5">
          {now.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h2 className="flex items-baseline gap-2.5 px-1 pb-2">
                <span
                  className={cn(
                    "font-heading tracking-tight",
                    group.tone === "late"
                      ? "text-lg font-semibold text-condition-attention"
                      : "text-2xl font-semibold",
                  )}
                >
                  {group.label}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground/60">
                  {group.items.length}
                </span>
              </h2>
              <ul className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <li
                    key={itemKey(item)}
                    className={cn(
                      "rounded-2xl border bg-card shadow-xs [&_[data-slot=thread-copy]]:rounded-2xl",
                      group.tone === "late"
                        ? "border-condition-attention/35 bg-[color-mix(in_oklab,var(--color-condition-attention)_6%,var(--color-card))]"
                        : "border-border",
                    )}
                  >
                    <ItemRow
                      item={item}
                      scope={scope}
                      dateInHeading={group.exact}
                      big
                      stacked
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {week.length > 0 && (
        <section aria-label="This week" className="flex flex-col">
          {week.map((group) => (
            <div
              key={group.key}
              className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-x-3 border-t border-border/60 py-2.5 first:border-t-0 @2xl:grid-cols-[8rem_minmax(0,1fr)]"
            >
              <h3 className="flex flex-col pt-1 leading-tight">
                <span
                  className={cn(
                    "font-heading tracking-tight",
                    group.tone === "near"
                      ? "text-base font-semibold"
                      : "text-[15px] font-medium text-foreground/80",
                  )}
                >
                  {group.tone === "near"
                    ? group.label
                    : weekday(groupDay(group, scope.currentDate), "short") +
                      " " +
                      new Date(groupDay(group, scope.currentDate)).getDate()}
                </span>
                <span className="text-[11px] text-muted-foreground/70">
                  {group.hint}
                </span>
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <li key={itemKey(item)}>
                    <Chip item={item} scope={scope} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {far.length > 0 && (
        <section aria-label="Later" className="flex flex-col gap-1 px-1">
          {far.map((group) => (
            <FarLine key={group.key} group={group} scope={scope} />
          ))}
        </section>
      )}
    </div>
  );
}

/**
 * A day's item as a chip: its marker, its Task and Thread, and a time if it
 * has one. A chip opens its item; acting on it happens there.
 */
export function Chip({ item, scope }: { item: BoardItem; scope: BoardScope }) {
  const time = item.when === undefined ? undefined : timeToken(item.when);
  const repeats = item.kind === "thread" && item.task?.repeat !== undefined;
  const body = (
    <>
      <span
        aria-hidden
        className="flex w-3 shrink-0 items-center justify-center"
      >
        {item.kind === "note" ? (
          <NoteMark />
        ) : repeats ? (
          <RepeatIcon className="size-3 text-muted-foreground" />
        ) : (
          <span className="size-1.5 rounded-full bg-muted-foreground/60" />
        )}
      </span>
      <span className="min-w-0 max-w-72 truncate">
        {item.kind === "thread" && item.task !== undefined ? (
          <>
            {item.task.text}
            <span className="text-muted-foreground">
              {" "}
              · {item.thread.title}
            </span>
          </>
        ) : (
          itemTitle(item)
        )}
      </span>
      {time !== undefined && (
        <span className="shrink-0 text-xs whitespace-nowrap tabular-nums text-muted-foreground">
          {time}
        </span>
      )}
    </>
  );
  const chip =
    "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[13px] text-foreground/90 transition-colors outline-none hover:border-foreground/20 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40";

  if (item.kind === "note") {
    return (
      <button
        type="button"
        onClick={() => scope.onOpenNote(item.note)}
        className={chip}
      >
        {body}
      </button>
    );
  }
  return (
    <ThreadCopy thread={item.thread} className="max-w-full rounded-full">
      <Link
        to="."
        search={(previous: ProductSearch): ProductSearch => ({
          ...previous,
          thread: item.thread.slug,
        })}
        title={`${item.task?.text ?? item.thread.title} · ${item.thread.title}`}
        className={chip}
      >
        {body}
      </Link>
    </ThreadCopy>
  );
}

/** Weeks and months out: the label, then every item's name in one line. */
function FarLine({ group, scope }: { group: BoardGroup; scope: BoardScope }) {
  return (
    <p className="flex items-baseline gap-3 py-1 text-sm">
      <span className="w-[5.5rem] shrink-0 text-[13px] font-medium text-muted-foreground @2xl:w-32">
        {group.label}
        {group.hint && (
          <span className="block text-[11px] font-normal text-muted-foreground/60">
            {group.hint}
          </span>
        )}
      </span>
      <FarNames group={group} scope={scope} />
    </p>
  );
}

/** Every item of a group by name, in one run of text, each opening its item. */
export function FarNames({
  group,
  scope,
}: {
  group: BoardGroup;
  scope: BoardScope;
}) {
  const names: ReactNode[] = [];
  group.items.forEach((item, index) => {
    if (index > 0) names.push(<span key={`sep-${index}`}>, </span>);
    const label =
      item.kind === "thread" && item.task !== undefined
        ? `${item.task.text} (${item.thread.title})`
        : itemTitle(item);
    names.push(
      item.kind === "note" ? (
        <button
          key={itemKey(item)}
          type="button"
          onClick={() => scope.onOpenNote(item.note)}
          className="hover:text-foreground hover:underline"
        >
          {label}
        </button>
      ) : (
        <Link
          key={itemKey(item)}
          to="."
          search={(previous: ProductSearch): ProductSearch => ({
            ...previous,
            thread: item.thread.slug,
          })}
          className="hover:text-foreground hover:underline"
        >
          {label}
        </Link>
      ),
    );
  });
  return (
    <span className="min-w-0 flex-1 text-muted-foreground/90">{names}</span>
  );
}
