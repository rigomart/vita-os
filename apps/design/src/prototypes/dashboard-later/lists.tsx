import type { BoardScope } from "@vita-os/application/internal/dashboard/components/dashboard-line.tsx";

import {
  itemKey,
  type BoardGroup,
  type BoardItem,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { DashboardLine } from "@vita-os/application/internal/dashboard/components/dashboard-line.tsx";
import {
  CURSOR_SCROLL_MARGIN,
  groupLook,
  itemTitle,
  lookAt,
  type GroupLook,
} from "@vita-os/application/internal/dashboard/components/dashboard-list-model.ts";
import { cn } from "@vita-os/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { ListProps } from "./board";

/**
 * Late, Today and the six days after them as they ship; from a week out on,
 * one folded Later at the foot of the list, naming how many, when the next
 * comes due, and the first two. Unfolding it shows the weeks and months as
 * they ship.
 */
export function LaterFoldList({ groups, scope }: ListProps) {
  const near = groups.filter((group) => group.tone !== "far");
  const far = groups.filter((group) => group.tone === "far");
  return (
    <>
      {near.length === 0 && <NothingThisWeek />}
      {near.map((group) => (
        <Group key={group.key} group={group} scope={scope} />
      ))}
      <Fold
        foldKey="later"
        groups={far}
        label="Later"
        look={lookAt(3)}
        scope={scope}
      />
    </>
  );
}

/**
 * Every group keeps its heading, so the shape of the coming months still
 * reads; from a week out on, each heading folds its lines into one line of
 * names. Each opens on its own.
 */
export function GroupFoldList({ groups, scope }: ListProps) {
  return groups.map((group) =>
    group.tone === "far" ? (
      <FoldedGroup
        key={group.key}
        foldKey={`groups:${group.key}`}
        group={group}
        scope={scope}
      />
    ) : (
      <Group key={group.key} group={group} scope={scope} />
    ),
  );
}

/**
 * Only what is asking is open: Late, Today and Tomorrow. The rest of the week
 * folds into one line, and from a week out on into one Later line, each
 * opening to its groups as they ship.
 */
export function TodayFirstList({ groups, scope }: ListProps) {
  const open = groups.filter(
    (group) =>
      group.tone === "late" || group.tone === "today" || group.tone === "near",
  );
  const week = groups.filter(
    (group) => group.tone === "soon" || group.tone === "week",
  );
  const far = groups.filter((group) => group.tone === "far");
  return (
    <>
      {open.map((group) => (
        <Group key={group.key} group={group} scope={scope} />
      ))}
      <Fold
        foldKey="today:week"
        groups={week}
        label="This week"
        look={lookAt(2)}
        scope={scope}
      />
      <Fold
        foldKey="today:later"
        groups={far}
        label="Later"
        look={lookAt(3)}
        scope={scope}
      />
    </>
  );
}

/**
 * Whether a fold is open, held for the visit: it survives opening a Thread
 * and the board remounting, and a fresh load starts folded.
 */
const openFolds = new Map<string, boolean>();

function useVisitFold(key: string) {
  const [open, setOpen] = useState(() => openFolds.get(key) ?? false);
  const toggle = () => {
    openFolds.set(key, !open);
    setOpen(!open);
  };
  return [open, toggle] as const;
}

/**
 * Several groups folded into one ruled line: how many they hold, when the
 * next comes due, and the first two. Opening it shows the groups as they ship.
 */
function Fold({
  foldKey,
  groups,
  label,
  look,
  scope,
}: {
  foldKey: string;
  groups: BoardGroup[];
  label: string;
  look: GroupLook;
  scope: BoardScope;
}) {
  const [open, toggle] = useVisitFold(foldKey);
  const items = groups.flatMap((group) => group.items);
  if (items.length === 0) return null;
  return (
    <>
      <section aria-label={label} className="pt-2 pb-2">
        <FoldHeading
          count={items.length}
          hint={`next ${shortDate(items[0]!.when!)}`}
          label={label}
          look={look}
          open={open}
          summary={summary(items)}
          onToggle={toggle}
        />
      </section>
      {open &&
        groups.map((group) => (
          <Group key={group.key} group={group} scope={scope} />
        ))}
    </>
  );
}

function FoldedGroup({
  foldKey,
  group,
  scope,
}: {
  foldKey: string;
  group: BoardGroup;
  scope: BoardScope;
}) {
  const [open, toggle] = useVisitFold(foldKey);
  const look = groupLook(group);
  return (
    <section aria-label={group.label} className={look.heading.section}>
      <FoldHeading
        count={group.items.length}
        day={group.exact ? group.items[0]?.when : undefined}
        hint={group.hint}
        label={group.label}
        look={look}
        open={open}
        summary={summary(group.items)}
        onToggle={toggle}
      />
      {open && (
        <Lines
          exact={group.exact}
          items={group.items}
          look={look}
          scope={scope}
        />
      )}
    </section>
  );
}

/**
 * A group's ruled heading as one button, with how many it holds and, while
 * folded, the first two by name under it.
 */
function FoldHeading({
  count,
  day,
  hint,
  label,
  look,
  open,
  summary,
  onToggle,
}: {
  count: number;
  day?: number;
  hint?: string;
  label: string;
  look: GroupLook;
  open: boolean;
  summary: string;
  onToggle: () => void;
}) {
  return (
    <h2 className={cn("border-t", look.heading.rule, "pt-0 pb-0")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="group/fold flex w-full flex-col gap-0.5 rounded-lg px-1 pt-2.5 pb-1.5 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <span className="flex w-full items-baseline gap-2.5">
          {day !== undefined && (
            <span
              aria-hidden
              className={cn("font-heading tabular-nums", look.heading.numeral)}
            >
              {new Date(day).getDate()}
            </span>
          )}
          <span
            className={cn("font-heading tracking-tight", look.heading.label)}
          >
            {label}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground/70">
            {count}
          </span>
          {hint && (
            <span className="text-xs text-muted-foreground/70">{hint}</span>
          )}
          <ChevronDown
            aria-hidden
            className={cn(
              "ml-auto size-4 shrink-0 self-center text-muted-foreground/60 transition-transform group-hover/fold:text-foreground motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </span>
        {!open && (
          <span className="truncate text-[13px] font-normal text-muted-foreground">
            {summary}
          </span>
        )}
      </button>
    </h2>
  );
}

/** A group as it ships: its ruled heading over its lines. */
function Group({ group, scope }: { group: BoardGroup; scope: BoardScope }) {
  const look = groupLook(group);
  const day = group.exact ? group.items[0]?.when : undefined;
  return (
    <section aria-label={group.label} className={look.heading.section}>
      <h2
        className={cn(
          "flex items-baseline gap-2.5 border-t px-1",
          look.heading.rule,
        )}
      >
        {day !== undefined && (
          <span
            aria-hidden
            className={cn("font-heading tabular-nums", look.heading.numeral)}
          >
            {new Date(day).getDate()}
          </span>
        )}
        <span className={cn("font-heading tracking-tight", look.heading.label)}>
          {group.label}
        </span>
        {group.hint && (
          <span className="text-xs text-muted-foreground/70">{group.hint}</span>
        )}
      </h2>
      <Lines
        exact={group.exact}
        items={group.items}
        look={look}
        scope={scope}
      />
    </section>
  );
}

function Lines({
  exact,
  items,
  look,
  scope,
}: {
  exact: boolean;
  items: BoardItem[];
  look: GroupLook;
  scope: BoardScope;
}) {
  return (
    <ul className="-mx-1.5">
      {items.map((item) => (
        <li
          key={itemKey(item)}
          data-cursor-item={itemKey(item)}
          className={CURSOR_SCROLL_MARGIN}
        >
          <DashboardLine
            dateInHeading={exact}
            item={item}
            look={look.line}
            scope={scope}
          />
        </li>
      ))}
    </ul>
  );
}

function NothingThisWeek() {
  return (
    <p className="px-1 pt-2 pb-3 text-[15px] text-muted-foreground">
      Nothing this week.
    </p>
  );
}

/**
 * The first two by what they are about, a Thread's title or a Note's first
 * line, then how many more. Tasks are often generic ("Follow up").
 */
function summary(items: readonly BoardItem[]) {
  const names = items.slice(0, 2).map(itemTitle);
  const rest = items.length - names.length;
  return rest > 0 ? `${names.join(", ")} and ${rest} more` : names.join(", ");
}

function shortDate(when: number) {
  return new Date(when).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
