import type {
  Announcements,
  DragEndEvent,
  Modifier,
  UniqueIdentifier,
} from "@dnd-kit/core";
import type {
  AreaIcon as AreaIconName,
  AreaId,
  AreaSummary,
  Thread,
} from "@vita-os/contracts";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { cn } from "@vita-os/ui/lib/utils";
import { GripVertical, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

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
  // Escape while a row is held cancels the move. The dialog hears that key
  // before dnd-kit does, so it must not close in the meantime.
  const holding = useRef(false);
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click on the handle
    // stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // The optimistic order lands in the cache before the drop animation ends,
  // so the row stays where it was dropped.
  const reorder = ({ active, over }: DragEndEvent) => {
    holding.current = false;
    if (areas === undefined || over === null || active.id === over.id) return;
    const areaIds = areas.map((area) => area._id);
    const from = areaIds.indexOf(active.id as AreaId);
    const to = areaIds.indexOf(over.id as AreaId);
    if (from === -1 || to === -1) return;
    void reorderAreas
      .mutateAsync({ areaIds: arrayMove(areaIds, from, to) })
      .catch(() => undefined);
  };

  const nameOf = (id: UniqueIdentifier) =>
    areas?.find((area) => area._id === id)?.name ?? "Area";
  const positionOf = (id: UniqueIdentifier) =>
    (areas?.findIndex((area) => area._id === id) ?? -1) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${nameOf(active.id)}, position ${positionOf(active.id)} of ${areas?.length}.`,
    onDragOver: ({ active, over }) =>
      over === null
        ? undefined
        : `${nameOf(active.id)} moved to position ${positionOf(over.id)}.`,
    onDragEnd: ({ active, over }) =>
      over === null
        ? `${nameOf(active.id)} dropped.`
        : `${nameOf(active.id)} dropped at position ${positionOf(over.id)}.`,
    onDragCancel: ({ active }) =>
      `Moving ${nameOf(active.id)} cancelled. It stays where it was.`,
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && holding.current) return;
        onOpenChange(next);
      }}
    >
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[alongTheList]}
                onDragStart={() => {
                  holding.current = true;
                }}
                onDragEnd={reorder}
                onDragCancel={() => {
                  holding.current = false;
                }}
                accessibility={{
                  announcements,
                  screenReaderInstructions: {
                    draggable:
                      "Press Space to pick up the Area, the arrow keys to move it, Space again to drop it, or Escape to cancel.",
                  },
                }}
              >
                <SortableContext
                  items={areas.map((area) => area._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul aria-label="Areas" className="flex flex-col gap-1">
                    {areas.map((area) => (
                      <ManagedArea
                        key={`${area._id}:${area.name}`}
                        area={area}
                        onDelete={() => setDeleting(area)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
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

/** The list only runs one way, so a drag never wanders sideways. */
const alongTheList: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function ManagedArea({
  area,
  onDelete,
}: {
  area: AreaSummary;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: area._id });
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
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1.5 rounded-lg bg-popover",
        isDragging && "relative z-10 shadow-md ring-1 ring-border",
      )}
    >
      {/* Only the handle starts a drag, so the name field and buttons keep
          their clicks. Vaul skips it, so a drag on a phone moves the Area
          instead of the drawer. */}
      <Button
        ref={setActivatorNodeRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Reorder ${area.name}`}
        data-vaul-no-drag
        className={cn(
          "touch-none text-muted-foreground",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
        {...attributes}
        {...listeners}
        onKeyDown={(event) => {
          listeners?.onKeyDown?.(event);
          // dnd-kit reads a held row's keys from the document, but Base UI's
          // dialog stops arrows and Escape at its edge. While this row is
          // held, its keys go straight to dnd-kit instead.
          if (isDragging) {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.ownerDocument.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: event.key,
                code: event.code,
              }),
            );
          }
        }}
      >
        <GripVertical />
      </Button>
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
