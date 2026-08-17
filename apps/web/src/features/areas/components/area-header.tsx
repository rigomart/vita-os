import type { AreaIcon as AreaIconName } from "@convex/lib/areaIcons";
import type { ProjectedArea } from "@convex/lib/validators";

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
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { BrandHexagon } from "@/components/ui/brand-hexagon";

import { AreaConditionSelect } from "./area-condition-select";
import { AreaIcon } from "./area-icon";
import { AreaIconPicker } from "./area-icon-picker";

interface AreaHeaderProps {
  area: ProjectedArea;
  onEdit: () => void;
  onDelete: () => void;
  onConditionChange: (value: ProjectedArea["condition"]) => void;
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
  const selectedIcon = area.icon;

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
            <AreaConditionSelect
              className="ml-1"
              condition={area.condition}
              onConditionChange={onConditionChange}
            />

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
