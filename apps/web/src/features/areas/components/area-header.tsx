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
} from "@vita-os/ui/components/alert-dialog";
import { Button } from "@vita-os/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vita-os/ui/components/select";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { BrandHexagon } from "@/components/ui/brand-hexagon";
import { cn } from "@/lib/utils";

import { AreaIcon } from "./area-icon";
import { AreaIconPicker } from "./area-icon-picker";

interface AreaHeaderProps {
  area: Doc<"areas">;
  onEdit: () => void;
  onDelete: () => void;
  onConditionChange: (value: Doc<"areas">["condition"]) => void;
  onIconChange: (value: AreaIconName) => Promise<void> | void;
}

export function AreaHeader({
  area,
  onEdit,
  onDelete,
  onConditionChange,
  onIconChange,
}: AreaHeaderProps) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { run: saveIcon, isPending: isSavingIcon } =
    useGuardedAsyncAction(onIconChange);
  const selectedIcon = getAreaIcon(area.icon);

  const handleIconSelect = async (icon: AreaIconName) => {
    if (icon === selectedIcon) {
      setIconPickerOpen(false);
      return;
    }

    setIconPickerOpen(false);
    await saveIcon(icon);
  };

  const handleDelete = () => {
    onDelete();
    setDeleteOpen(false);
  };

  return (
    <div>
      <PageHeader
        className="mb-0"
        title={area.name}
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
                  className="size-9 hover:bg-transparent"
                />
              }
            >
              <BrandHexagon className="size-8 bg-brand-ink text-brand-gold">
                <AreaIcon icon={selectedIcon} />
              </BrandHexagon>
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
            <Select
              items={CONDITION_OPTIONS}
              value={area.condition}
              onValueChange={(value) => {
                if (isCondition(value)) onConditionChange(value);
              }}
            >
              <SelectTrigger
                className="ml-1 h-7 w-auto gap-2 border border-brand-gold-strong/25 bg-brand-gold/12 px-3 text-xs"
                aria-label="Area condition"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    CONDITION_OPTIONS.find(
                      (option) => option.value === area.condition,
                    )?.color,
                  )}
                />
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

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Area actions"
                  />
                }
              >
                <Ellipsis />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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
                    variant="destructive"
                    onClick={handleDelete}
                  >
                    Delete area
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />
    </div>
  );
}
