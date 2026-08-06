import {
  DEFAULT_AREA_ICON,
  getAreaIcon,
  type AreaIcon as AreaIconName,
} from "@convex/lib/areaIcons";
import {
  CONDITION_OPTIONS,
  type Condition,
  DEFAULT_CONDITION,
  isCondition,
} from "@convex/lib/condition";
import { Button } from "@vita-os/ui/components/button";
import { Input } from "@vita-os/ui/components/input";
import { Label } from "@vita-os/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vita-os/ui/components/select";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { useEffect, useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { AreaIconPicker } from "@/features/areas/components/area-icon-picker";
import {
  conditionIcons,
  conditionTextClassName,
} from "@/features/areas/condition-presentation";
import { cn } from "@/lib/utils";

import type { AreaFormValue } from "./types";

interface AreaFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: AreaFormValue;
  onSubmit: (value: AreaFormValue) => Promise<void> | void;
}

function SelectedConditionIcon({ condition }: { condition: Condition }) {
  const Icon = conditionIcons[condition];
  return (
    <Icon
      aria-hidden
      className={cn("size-4", conditionTextClassName[condition])}
    />
  );
}

function getAreaSaveError(error: unknown) {
  const detail =
    error instanceof Error && error.message
      ? error.message
      : "Please try again.";
  return `Area was not saved. ${detail}`;
}

export function AreaFormDialog({
  mode,
  open,
  onOpenChange,
  initialValue,
  onSubmit,
}: AreaFormDialogProps) {
  const [name, setName] = useState(initialValue?.name ?? "");
  const [condition, setCondition] = useState<Condition>(
    initialValue?.condition ?? DEFAULT_CONDITION,
  );
  const [icon, setIcon] = useState<AreaIconName>(
    getAreaIcon(initialValue?.icon),
  );
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialValue?.name ?? "");
    setCondition(initialValue?.condition ?? DEFAULT_CONDITION);
    setIcon(getAreaIcon(initialValue?.icon));
    setIconPickerOpen(false);
  }, [open, initialValue]);

  const {
    run: submitArea,
    isPending,
    error,
  } = useGuardedAsyncAction(onSubmit, {
    successMessage: mode === "create" ? "Area created" : undefined,
    errorToast: false,
    getErrorMessage: getAreaSaveError,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || isPending) return;

    const result = await submitArea({
      name: trimmedName,
      condition: condition,
      icon,
    });
    if (!result.ok) return;

    if (mode === "create") {
      setName("");
      setCondition(DEFAULT_CONDITION);
      setIcon(DEFAULT_AREA_ICON);
      setIconPickerOpen(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent showCloseButton={!isPending}>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {mode === "edit" ? "Edit area" : "New area"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {mode === "edit"
              ? "Update this life area's details."
              : "Areas are stable life domains like Health, Career, or Finances."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="area-name">Name</Label>
            <div className="flex items-center gap-2">
              {mode === "create" ? (
                <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        aria-label={`Choose Area icon: ${icon}`}
                        disabled={isPending}
                      />
                    }
                  >
                    <AreaIcon icon={icon} className="size-4" />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start">
                    <AreaIconPicker
                      selectedIcon={icon}
                      onSelect={(selectedIcon) => {
                        setIcon(selectedIcon);
                        setIconPickerOpen(false);
                      }}
                      disabled={isPending}
                    />
                  </PopoverContent>
                </Popover>
              ) : null}
              <Input
                id="area-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Health, Career, Finances"
                autoFocus
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="area-condition">Condition</Label>
            <Select
              items={CONDITION_OPTIONS}
              value={condition}
              disabled={isPending}
              onValueChange={(value) => {
                if (isCondition(value)) setCondition(value);
              }}
            >
              <SelectTrigger id="area-condition">
                <SelectedConditionIcon condition={condition} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {CONDITION_OPTIONS.map((option) => {
                    const OptionIcon = conditionIcons[option.value];
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <OptionIcon
                            aria-hidden
                            className={cn(
                              "size-4",
                              conditionTextClassName[option.value],
                            )}
                          />
                          {option.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isPending}
              aria-busy={isPending}
            >
              {mode === "edit" ? "Save changes" : "Create area"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
