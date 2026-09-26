import type {
  AreaIcon as AreaIconName,
  AreaSummary,
  Thread,
} from "@vita-os/contracts";

import { DEFAULT_AREA_ICON } from "@vita-os/core";
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
import { Input } from "@vita-os/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@vita-os/ui/components/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useState } from "react";

import { useOpenThreads } from "../../threads/hooks";
import { AreaIcon } from "../components/area-icon";
import { AreaIconPicker } from "../components/area-icon-picker";
import {
  useAreas,
  useCreateArea,
  useRemoveArea,
  useReorderAreas,
  useUpdateArea,
} from "../hooks";

/**
 * The one home for keeping Areas tidy: rename, re-icon, reorder, delete, and
 * add one without a Thread to hang it on. Deleting never waits on Threads —
 * they simply lose the label.
 */
export function ManageAreasDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const areas = useAreas({ enabled: open }).data;
  const threads = useOpenThreads({ enabled: open }).data;
  const reorderAreas = useReorderAreas();
  const [deleting, setDeleting] = useState<AreaSummary | null>(null);

  const move = (index: number, offset: -1 | 1) => {
    if (areas === undefined) return;
    const target = index + offset;
    if (target < 0 || target >= areas.length) return;
    const areaIds = areas.map((area) => area._id);
    [areaIds[index], areaIds[target]] = [areaIds[target]!, areaIds[index]!];
    void reorderAreas.mutateAsync({ areaIds }).catch(() => undefined);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Manage areas</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Areas are optional labels for Threads. Deleting one leaves its
            Threads open and unlabeled.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {areas === undefined ? null : (
          <div className="flex flex-col gap-3">
            {areas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No areas yet. Add one here, or create one while labeling a
                Thread.
              </p>
            ) : (
              <ul aria-label="Areas" className="flex flex-col gap-1">
                {areas.map((area, index) => (
                  <ManagedArea
                    key={`${area._id}:${area.name}`}
                    area={area}
                    isFirst={index === 0}
                    isLast={index === areas.length - 1}
                    onMoveUp={() => move(index, -1)}
                    onMoveDown={() => move(index, 1)}
                    onDelete={() => setDeleting(area)}
                  />
                ))}
              </ul>
            )}
            <AddArea />
          </div>
        )}

        <DeleteAreaConfirmation
          area={deleting}
          threads={threads}
          onDone={() => setDeleting(null)}
        />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function ManagedArea({
  area,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  area: AreaSummary;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const updateArea = useUpdateArea();
  const [name, setName] = useState(area.name);
  const [iconOpen, setIconOpen] = useState(false);

  const { run: save } = useGuardedAsyncAction(
    async (change: { name?: string; icon?: AreaIconName }) => {
      await updateArea.mutateAsync({ areaId: area._id, ...change });
    },
    { errorToast: true },
  );

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === area.name) {
      setName(area.name);
      return;
    }
    void save({ name: trimmed }).then((result) => {
      if (!result.ok) setName(area.name);
    });
  };

  return (
    <li className="flex items-center gap-1.5">
      <Popover open={iconOpen} onOpenChange={setIconOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Change icon for ${area.name}`}
            />
          }
        >
          <AreaIcon icon={area.icon} className="size-4" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <AreaIconPicker
            selectedIcon={area.icon}
            onSelect={(icon) => {
              setIconOpen(false);
              if (icon !== area.icon) void save({ icon });
            }}
          />
        </PopoverContent>
      </Popover>
      <Input
        aria-label={`Name of ${area.name}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") setName(area.name);
        }}
        className="h-8 min-w-0 flex-1"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${area.name} up`}
        disabled={isFirst}
        onClick={onMoveUp}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${area.name} down`}
        disabled={isLast}
        onClick={onMoveDown}
      >
        <ArrowDown />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${area.name}`}
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
    </li>
  );
}

function AddArea() {
  const createArea = useCreateArea();
  const [name, setName] = useState("");
  const { run: add, isPending } = useGuardedAsyncAction(
    async (value: string) => {
      await createArea.mutateAsync({ name: value, icon: DEFAULT_AREA_ICON });
    },
    { errorToast: true },
  );

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (trimmed === "" || isPending) return;
        void add(trimmed).then((result) => {
          if (result.ok) setName("");
        });
      }}
    >
      <Input
        aria-label="New area name"
        placeholder="Add an area…"
        value={name}
        onChange={(event) => setName(event.target.value)}
        disabled={isPending}
        className="h-8"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={name.trim() === "" || isPending}
      >
        Add
      </Button>
    </form>
  );
}

/**
 * States what deleting costs before it happens. Only Open Threads are loaded
 * here, so the count names them; Resolved Threads lose the label too.
 */
function DeleteAreaConfirmation({
  area,
  threads,
  onDone,
}: {
  area: AreaSummary | null;
  threads: Thread[] | undefined;
  onDone: () => void;
}) {
  const removeArea = useRemoveArea();
  const { run: remove } = useGuardedAsyncAction(
    async (target: AreaSummary) => {
      await removeArea.mutateAsync({ areaId: target._id });
    },
    { successMessage: "Area deleted", errorToast: true },
  );

  const labeled =
    area === null
      ? 0
      : (threads ?? []).filter((thread) => thread.areaId === area._id).length;
  const effect =
    labeled === 0
      ? "No open Threads use this area."
      : `${labeled} open ${labeled === 1 ? "Thread" : "Threads"} will lose this label.`;

  return (
    <AlertDialog
      open={area !== null}
      onOpenChange={(next) => {
        if (!next) onDone();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{area?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {effect} Resolved Threads that use it lose it too. The Threads
            themselves are not changed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (area !== null) void remove(area);
              onDone();
            }}
          >
            Delete area
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
