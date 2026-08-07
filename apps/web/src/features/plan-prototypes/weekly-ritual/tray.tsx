import { useDraggable } from "@dnd-kit/core";
import { Button } from "@vita-os/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vita-os/ui/components/collapsible";
import { cn } from "@vita-os/ui/lib/utils";
import { CalendarPlus, ChevronRight, Sparkles } from "lucide-react";
import { useState } from "react";

import type { PlanActions } from "./item-parts";
import type { PlanItem, TrayGroup } from "./model";

import { ItemEditor } from "./item-editor";
import { ItemContext, ItemGlyph, NextMoveLine, StaleChip } from "./item-parts";

/**
 * The left pane: a finite pile of things that want a decision.
 *
 * Four groups, each collapsible and counted, so the pile reads as something
 * you can empty rather than a feed that keeps producing.
 */
export function PlanningTray({
  actions,
  groups,
  now,
}: {
  actions: PlanActions;
  groups: TrayGroup[];
  now: number;
}) {
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section
      aria-label="Needs planning"
      className="flex max-h-[42rem] min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-surface-2 lg:sticky lg:top-4 lg:max-h-[calc(100svh-4rem)]"
    >
      <header className="flex items-baseline justify-between gap-2 border-b border-border/60 px-3.5 py-3">
        <div className="flex items-baseline gap-2">
          <h3 className="font-heading text-sm font-semibold tracking-tight">
            Needs planning
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {total}
          </span>
        </div>
        {total > 0 && (
          <span className="text-[11px] text-muted-foreground/70">
            drag onto a day →
          </span>
        )}
      </header>

      {total === 0 ? (
        <TrayEmpty />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {groups.map((group) => (
            <TrayGroupBlock
              key={group.key}
              actions={actions}
              group={group}
              now={now}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TrayEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-condition-healthy/12 text-condition-healthy">
        <Sparkles className="size-5" />
      </span>
      <p className="text-sm font-medium">Tray empty</p>
      <p className="max-w-52 text-xs leading-relaxed text-muted-foreground">
        Nothing is waiting on a decision. Everything open has a day or a move.
      </p>
    </div>
  );
}

function TrayGroupBlock({
  actions,
  group,
  now,
}: {
  actions: PlanActions;
  group: TrayGroup;
  now: number;
}) {
  const [open, setOpen] = useState(true);
  const emptied = group.items.length === 0;

  return (
    <Collapsible open={open && !emptied} onOpenChange={setOpen}>
      <CollapsibleTrigger
        disabled={emptied}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-lg px-1.5 py-2 text-left transition-colors",
          emptied
            ? "cursor-default opacity-60"
            : "hover:bg-surface-3/70 cursor-pointer",
        )}
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && !emptied && "rotate-90",
            emptied && "opacity-0",
          )}
        />
        <span
          className={cn(
            "text-[11px] font-semibold tracking-wide uppercase",
            group.key === "overdue" && !emptied
              ? "text-condition-attention"
              : "text-muted-foreground",
          )}
        >
          {group.label}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {emptied ? "cleared" : group.items.length}
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <p className="px-1.5 pb-1.5 pl-6 text-[11px] leading-snug text-muted-foreground/70">
          {group.hint}
        </p>
        <ul className="flex flex-col pb-1">
          {group.items.map((item) => (
            <li key={item.id}>
              <TrayRow actions={actions} item={item} now={now} />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TrayRow({
  actions,
  item,
  now,
}: {
  actions: PlanActions;
  item: PlanItem;
  now: number;
}) {
  const [open, setOpen] = useState(false);
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    data: { item },
    id: item.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "group/tray flex cursor-grab items-start gap-2 rounded-lg py-1.5 pr-1 pl-1.5 transition-colors hover:bg-surface-3/70 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
        isDragging && "opacity-40",
      )}
    >
      <ItemGlyph item={item} className="mt-0.5" />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm leading-snug font-medium">
            {item.title}
          </span>
          {item.when !== undefined && <StaleChip now={now} when={item.when} />}
        </div>
        {item.nextMove ? (
          <NextMoveLine item={item} />
        ) : (
          <ItemContext item={item} />
        )}
      </div>

      <ItemEditor
        actions={actions}
        item={item}
        now={now}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Plan ${item.title}`}
            className={cn(
              "mt-0.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/tray:opacity-100 group-focus-within/tray:opacity-100",
              open && "opacity-100",
            )}
          >
            <CalendarPlus />
          </Button>
        }
      />
    </div>
  );
}
