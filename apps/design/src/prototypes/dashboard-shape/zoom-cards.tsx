import type { BoardGroup } from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";

import {
  groupByWhen,
  itemKey,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { cn } from "@vita-os/ui/lib/utils";

import type { BodyProps } from "./board";

import { Count, SpanLabel } from "./board";
import { ItemCard, ItemChip } from "./tile";

/**
 * Cards all the way down: one form for every item, smaller the further off.
 * Late and Today are full cards three to a row, the week's days smaller
 * cards four to a row, Later a wrap of name chips, No date small cards
 * beside. Every group leads with its count. Unlike ADR 0045's Zoom, which
 * changed form with distance, only the size changes.
 */
export function ZoomCards({ bands, board, scope }: BodyProps) {
  const near = groupByWhen([...board.now, ...board.week], scope.currentDate);
  const none = bands.find((band) => band.key === "none")!;

  return (
    <div className="grid gap-x-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-5">
        {near.map((group) => (
          <Group key={group.key} group={group} scope={scope} />
        ))}
        {board.later.length > 0 && (
          <section aria-label="Later">
            <Heading count={board.later.length} label="Later" size={3} />
            <ul className="flex flex-wrap gap-1.5">
              {board.later.map((item) => (
                <li key={itemKey(item)} className="max-w-56">
                  <ItemChip item={item} scope={scope} late={false} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <aside aria-label="No date" className="min-w-0 pt-6 lg:pt-0">
        <Heading count={none.items.length} label="No date" size={2} />
        <ul className="flex flex-col gap-1.5">
          {none.items.map((item) => (
            <li key={itemKey(item)}>
              <ItemCard item={item} scope={scope} distance={3} late={false} />
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function Group({
  group,
  scope,
}: {
  group: BoardGroup;
  scope: BodyProps["scope"];
}) {
  const size =
    group.tone === "late" || group.tone === "today"
      ? 0
      : group.tone === "near"
        ? 1
        : 2;
  return (
    <section aria-label={group.label}>
      <Heading
        count={group.items.length}
        label={group.label}
        hint={group.hint}
        late={group.tone === "late"}
        size={size}
      />
      <ul
        className={cn(
          "grid gap-2",
          size === 0 && "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
          size === 1 && "grid-cols-2 xl:grid-cols-3",
          size === 2 && "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4",
        )}
      >
        {group.items.map((item) => (
          <li key={itemKey(item)}>
            <ItemCard
              item={item}
              scope={scope}
              distance={size === 0 ? 0 : size === 1 ? 1 : 3}
              late={group.tone === "late"}
              className="h-full"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Heading({
  count,
  label,
  hint,
  late = false,
  size,
}: {
  count: number;
  label: string;
  hint?: string;
  late?: boolean;
  size: number;
}) {
  return (
    <h2 className="flex items-baseline gap-2 px-0.5 pb-2">
      <Count
        count={count}
        className={cn(
          size === 0 && "text-3xl",
          size === 1 && "text-2xl text-foreground/85",
          size >= 2 && "text-lg text-foreground/60",
        )}
      />
      <SpanLabel
        label={label}
        late={late}
        className={cn(
          size === 0 && "text-lg",
          size === 1 && "text-base",
          size >= 2 && "text-sm text-foreground/75",
        )}
      />
      {hint && <span className="text-xs text-muted-foreground/70">{hint}</span>}
    </h2>
  );
}
