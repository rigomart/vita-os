import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  FilterX,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Tags,
} from "lucide-react";
import { useMemo, useRef } from "react";

import type { ProductSearch } from "../navigation/search-params";

import { AreaIcon } from "../areas/components/area-icon";
import { useAreas } from "../areas/hooks";
import { useOpenThreads } from "../threads/hooks";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "../ui/command";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewNote: () => void;
  onNewThread: () => void;
  onManageAreas: () => void;
  onOpenInbox: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onNewNote,
  onNewThread,
  onManageAreas,
  onOpenInbox,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { area: areaFilter }: ProductSearch = useSearch({ strict: false });
  // The palette is mounted only while it is open, so these subscriptions live
  // exactly as long as the surface that reads them.
  const areas = useAreas({ enabled: open }).data;
  const threads = useOpenThreads({ enabled: open }).data;
  const areaById = useMemo(
    () => new Map((areas ?? []).map((area) => [area._id, area])),
    [areas],
  );

  // Running an action closes the palette and opens another surface in the same
  // tick. Base UI would then queue a microtask returning focus to whatever was
  // focused before the palette opened, stealing it from the new dialog's first
  // field. A dismiss (Escape, backdrop) must still return focus, so the flag is
  // set only on the action path.
  const skipFocusReturn = useRef(false);

  const run = (action: () => void) => {
    skipFocusReturn.current = true;
    onOpenChange(false);
    action();
  };

  const filterBy = (area: string | undefined) =>
    run(() =>
      navigate({
        to: "/",
        search: (prev: ProductSearch): ProductSearch => ({ ...prev, area }),
      }),
    );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Jump to"
      description="Jump to a thread, filter by an area, or run an action"
      showCloseButton={false}
      // Function form: Base UI reads it at close time, after `run` has set the
      // flag, which a plain value could not see in the same commit.
      finalFocus={() => !skipFocusReturn.current}
      // Sit high so the on-screen keyboard never covers the input on mobile.
      className="top-[15%] translate-y-0"
    >
      <CommandInput placeholder="Jump to a thread, area, or action…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {/* Jumping first: Threads are the work. Create lives last because the
            dock already offers those one-tap actions; keeping the rows means
            "new thread" still matches when someone searches rather than taps. */}
        <CommandGroup heading="Threads">
          {(threads ?? []).map((thread) => {
            const area =
              thread.areaId === undefined
                ? undefined
                : areaById.get(thread.areaId);
            return (
              <CommandItem
                key={thread._id}
                value={`thread-${thread._id}`}
                keywords={area ? [thread.title, area.name] : [thread.title]}
                onSelect={() =>
                  run(() =>
                    navigate({
                      to: ".",
                      search: (prev: ProductSearch): ProductSearch => ({
                        ...prev,
                        thread: thread.slug,
                      }),
                    }),
                  )
                }
              >
                <MessageSquare />
                <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                {area && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {area.name}
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading="Filter">
          {(areas ?? []).map((area) => (
            <CommandItem
              key={area._id}
              value={`filter-${area._id}`}
              keywords={[`Filter: ${area.name}`, area.name]}
              onSelect={() => filterBy(area.slug)}
            >
              <AreaIcon icon={area.icon} className="size-4" />
              <span className="min-w-0 flex-1 truncate">
                Filter: {area.name}
              </span>
            </CommandItem>
          ))}
          {areaFilter !== undefined && (
            <CommandItem
              value="filter-clear"
              keywords={["Clear filter", "all"]}
              onSelect={() => filterBy(undefined)}
            >
              <FilterX />
              Clear filter
            </CommandItem>
          )}
        </CommandGroup>
        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => run(() => navigate({ to: "/" }))}>
            <LayoutDashboard />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenInbox)}>
            <Inbox />
            Notes
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Create">
          <CommandItem
            keywords={["create", "add"]}
            onSelect={() => run(onNewNote)}
          >
            <Plus />
            New note
            <CommandShortcut>Q</CommandShortcut>
          </CommandItem>
          <CommandItem
            keywords={["create", "add"]}
            onSelect={() => run(onNewThread)}
          >
            <MessageSquare />
            New thread
          </CommandItem>
          <CommandItem
            keywords={["areas", "rename", "reorder", "delete", "labels"]}
            onSelect={() => run(onManageAreas)}
          >
            <Tags />
            Manage areas
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
