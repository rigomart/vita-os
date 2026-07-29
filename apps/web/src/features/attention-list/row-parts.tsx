import type { LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@vita-os/ui/components/alert-dialog";
import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import { Checkbox } from "@vita-os/ui/components/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import { cn } from "@vita-os/ui/lib/utils";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { AttentionRowModel } from "./attention-row-model";

export function RowShell({
  children,
  className,
  row,
}: {
  children: ReactNode;
  className?: string;
  row: AttentionRowModel;
}) {
  if (!row.linkTo) {
    return <div className={className}>{children}</div>;
  }

  return (
    <Link
      to="/$areaSlug/$threadSlug"
      params={row.linkTo}
      className={cn("outline-none", className)}
    >
      {children}
    </Link>
  );
}

export function RowCheckbox({
  className,
  row,
}: {
  className?: string;
  row: AttentionRowModel;
}) {
  return (
    <Checkbox
      checked={row.done ?? false}
      onCheckedChange={() => {
        if (!row.toggleBusy) row.onToggleDone?.();
      }}
      disabled={row.toggleBusy}
      aria-busy={row.toggleBusy}
      aria-label={row.done ? "Mark task open" : "Mark task done"}
      className={cn("border-border/80 bg-surface-1", className)}
    />
  );
}

export function AreaTag({
  area,
  className,
  iconClassName,
}: {
  area: NonNullable<AttentionRowModel["area"]>;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <AreaIcon
        icon={area.icon}
        className={cn("size-3 shrink-0", iconClassName)}
      />
      <span className="truncate">{area.name}</span>
    </span>
  );
}

export function WhenPopover({
  row,
  trigger,
}: {
  row: AttentionRowModel;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const selected = row.when === undefined ? undefined : new Date(row.when);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent className="w-auto gap-0 p-0" align="end">
        <Calendar
          mode="single"
          selected={selected}
          disabled={row.whenBusy}
          onSelect={(date) => {
            if (!date || row.whenBusy) return;
            row.onSetWhen?.(date.getTime());
            setOpen(false);
          }}
        />
        {selected && (
          <div className="border-t border-border/60 p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              disabled={row.whenBusy}
              onClick={() => {
                if (row.whenBusy) return;
                row.onSetWhen?.(undefined);
                setOpen(false);
              }}
            >
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function RowIconAction({
  icon: Icon,
  label,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      onClick={onSelect}
      className="text-muted-foreground"
    >
      <Icon />
    </Button>
  );
}

export function RowDeleteAction({
  busy,
  confirmLabel,
  description,
  label,
  onConfirm,
  title,
}: {
  busy?: boolean;
  confirmLabel: string;
  description: string;
  label: string;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className="text-muted-foreground"
          />
        }
      >
        <Trash2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
