import type { Doc } from "@convex/_generated/dataModel";

import {
  CONDITION_OPTIONS,
  conditionColors,
  conditionLabels,
  isCondition,
} from "@convex/lib/condition";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vita-os/ui/components/select";
import { Pencil, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

interface AreaHeaderProps {
  area: Doc<"areas">;
  threadCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onConditionChange: (value: Doc<"areas">["condition"]) => void;
}

export function AreaHeader({
  area,
  threadCount,
  onEdit,
  onDelete,
  onConditionChange,
}: AreaHeaderProps) {
  return (
    <div>
      <PageHeader
        title={area.name}
        backLink={{ label: "Dashboard", to: "/" }}
        titleAccessory={
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              conditionColors[area.condition],
            )}
            aria-label={conditionLabels[area.condition]}
          />
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              aria-label="Edit area"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete area"
                  />
                }
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete area?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This area and its data will be permanently deleted. Move or
                    delete all threads first.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />

      <div className="flex items-center gap-3">
        <Select
          items={CONDITION_OPTIONS}
          value={area.condition}
          onValueChange={(value) => {
            if (isCondition(value)) onConditionChange(value);
          }}
        >
          <SelectTrigger
            className="h-7 w-auto gap-2 border-none bg-surface-3/60 px-3 text-xs"
            aria-label="Area condition"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CONDITION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn("h-2 w-2 rounded-full", option.color)}
                    />
                    {option.label}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {threadCount} {threadCount === 1 ? "thread" : "threads"}
        </span>
      </div>
    </div>
  );
}
