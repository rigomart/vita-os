import { Button } from "@vita-os/ui/components/button";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";

import { EditableField } from "@/components/ui/editable-field";

import type { AttentionRowModel } from "./attention-row-model";

import { whenTone } from "./date-parts";
import { AreaTag, RowCheckbox, RowShell, WhenPopover } from "./row-parts";

const railToneClassName = {
  due: "bg-surface-3 text-brand-accent-foreground",
  overdue: "bg-condition-attention/12 text-condition-attention",
  scheduled: "text-muted-foreground",
  unscheduled: "text-muted-foreground/40",
} as const;

type RailTone = keyof typeof railToneClassName;

export function AttentionRow({
  now,
  row,
}: {
  now: number;
  row: AttentionRowModel;
}) {
  return (
    <div className="group/row flex h-10 items-center gap-2.5 rounded-lg pr-2 transition-colors hover:bg-muted/50">
      <StateRail now={now} row={row} />

      {row.onToggleDone && <RowCheckbox row={row} className="shrink-0" />}
      {!row.onToggleDone && row.area && (
        <span className="size-1.5 shrink-0 rounded-full bg-border" />
      )}

      <RowShell
        row={row}
        className="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden"
      >
        <RowTitle row={row} />
        {row.detail && (
          <span className="flex min-w-0 flex-1 items-baseline gap-1 text-xs text-muted-foreground/80">
            {row.detailKind === "next-move" && (
              <ArrowRight className="size-3 shrink-0 translate-y-0.5" />
            )}
            <span className="truncate">{row.detail}</span>
          </span>
        )}
      </RowShell>

      {row.area && (
        <AreaTag
          area={row.area}
          className="hidden max-w-28 shrink-0 text-[11px] text-muted-foreground sm:inline-flex"
        />
      )}

      {row.actions && (
        <div className="flex w-12 shrink-0 justify-end gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100">
          {row.actions}
        </div>
      )}
    </div>
  );
}

function RowTitle({ row }: { row: AttentionRowModel }) {
  const titleClassName = cn(
    "text-sm font-medium",
    row.done &&
      "text-muted-foreground/60 line-through decoration-muted-foreground/30",
  );
  const widthClassName = cn(
    "min-w-0",
    row.detail ? "max-w-[55%] shrink-0" : "flex-1",
  );

  if (!row.onUpdateText) {
    return (
      <span className={cn(widthClassName, "truncate", titleClassName)}>
        {row.title}
      </span>
    );
  }

  return (
    // EditableField fills its parent, so the row constrains it from outside.
    <span className={widthClassName}>
      <EditableField
        value={row.title}
        onSave={(text) => {
          if (!text || row.isSavingText) return;
          row.onUpdateText?.(text);
        }}
        disabled={row.isSavingText}
        inputAriaLabel="Edit task text"
        className={cn("min-h-0 py-0", titleClassName)}
        displayClassName="block truncate border-transparent text-left"
      />
    </span>
  );
}

function StateRail({ now, row }: { now: number; row: AttentionRowModel }) {
  const date =
    row.done || row.when === undefined ? undefined : new Date(row.when);
  const tone: RailTone =
    date === undefined
      ? "unscheduled"
      : (whenTone(row.when, now) ?? "scheduled");
  const block = (
    <span
      className={cn(
        "flex size-9 flex-col items-center justify-center rounded-md",
        railToneClassName[tone],
      )}
    >
      {date === undefined ? (
        <span className="size-4 rounded-full border border-dashed border-current" />
      ) : (
        <time
          dateTime={date.toISOString()}
          className="flex flex-col items-center"
        >
          <span className="text-[9px] leading-none font-medium tracking-wider uppercase opacity-70">
            {format(date, "MMM")}
          </span>
          <span
            className={cn(
              "mt-0.5 text-base leading-none font-semibold tabular-nums",
              tone === "scheduled" && "text-foreground",
              tone === "overdue" && "text-condition-attention",
            )}
          >
            {format(date, "d")}
          </span>
        </time>
      )}
    </span>
  );

  if (!row.onSetWhen) {
    return <span className="flex w-11 shrink-0 justify-center">{block}</span>;
  }

  return (
    <span className="flex w-11 shrink-0 justify-center">
      <WhenPopover
        row={row}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            disabled={row.whenBusy}
            aria-busy={row.whenBusy}
            aria-label={date ? "Change when" : "Set when"}
            className="size-9 rounded-md p-0 hover:bg-transparent"
          >
            {block}
          </Button>
        }
      />
    </span>
  );
}
