import type { Doc } from "@convex/_generated/dataModel";
import type { AreaIcon as AreaIconName } from "@convex/lib/areaIcons";

import { getAreaIcon } from "@convex/lib/areaIcons";
import { CONDITION_OPTIONS, isCondition } from "@convex/lib/condition";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vita-os/ui/components/select";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

import { AreaIcon } from "./area-icon";
import { AreaIconPicker } from "./area-icon-picker";

interface AreaHeaderProps {
  area: Doc<"areas">;
  threadCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onConditionChange: (value: Doc<"areas">["condition"]) => void;
  onIconChange: (value: AreaIconName) => Promise<void> | void;
}

export function AreaHeader({
  area,
  threadCount,
  onEdit,
  onDelete,
  onConditionChange,
  onIconChange,
}: AreaHeaderProps) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const { run: saveIcon, isPending: isSavingIcon } =
    useGuardedAsyncAction(onIconChange);
  const selectedIcon = getAreaIcon(area.icon);

  const handleIconSelect = async (icon: AreaIconName) => {
    if (icon === selectedIcon) {
      setIconPickerOpen(false);
      return;
    }

    const result = await saveIcon(icon);
    if (result.ok) setIconPickerOpen(false);
  };

  return (
    <div>
      <PageHeader
        title={area.name}
        backLink={{ label: "Dashboard", to: "/" }}
        titleLeading={
          <Popover
            open={iconPickerOpen}
            onOpenChange={(open) => {
              if (!isSavingIcon) setIconPickerOpen(open);
            }}
          >
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Change Area icon"
                  disabled={isSavingIcon}
                />
              }
            >
              <AreaIcon icon={selectedIcon} className="size-4" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <AreaIconPicker
                selectedIcon={selectedIcon}
                onSelect={(icon) => void handleIconSelect(icon)}
                disabled={isSavingIcon}
              />
            </PopoverContent>
          </Popover>
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
            {CONDITION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", option.color)} />
                  {option.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {threadCount} {threadCount === 1 ? "thread" : "threads"}
        </span>
      </div>
    </div>
  );
}
