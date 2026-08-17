import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import {
  FolderPlus,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Plus,
} from "lucide-react";
import { useMemo, useRef } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { AreaIcon } from "@/features/areas/components/area-icon";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewTask: () => void;
  onNewThread: () => void;
  onNewArea: () => void;
  onOpenInbox: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onNewTask,
  onNewThread,
  onNewArea,
  onOpenInbox,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  // The palette is mounted only while it is open, so these subscriptions live
  // exactly as long as the surface that reads them.
  const areas = useQuery(api.areas.list, open ? {} : "skip");
  const threads = useQuery(api.threads.list, open ? {} : "skip");
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

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Jump to"
      description="Jump to an area, thread, or action"
      showCloseButton={false}
      // Function form: Base UI reads it at close time, after `run` has set the
      // flag, which a plain value could not see in the same commit.
      finalFocus={() => !skipFocusReturn.current}
      // Sit high so the on-screen keyboard never covers the input on mobile.
      className="top-[15%] translate-y-0"
    >
      <CommandInput placeholder="Jump to an area, thread, or action…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(onNewTask)}>
            <Plus />
            New task
            <CommandShortcut>Q</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(onNewThread)}>
            <MessageSquare />
            New thread
          </CommandItem>
          <CommandItem onSelect={() => run(onNewArea)}>
            <FolderPlus />
            New area
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => run(() => navigate({ to: "/" }))}>
            <LayoutDashboard />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenInbox)}>
            <Inbox />
            Inbox
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Areas">
          {(areas ?? []).map((area) => (
            <CommandItem
              key={area._id}
              value={`area-${area._id}`}
              keywords={[area.name]}
              onSelect={() =>
                run(() =>
                  navigate({
                    to: "/$areaSlug",
                    params: { areaSlug: area.slug },
                  }),
                )
              }
            >
              <AreaIcon icon={area.icon} className="size-4" />
              {area.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Threads">
          {(threads ?? []).map((thread) => {
            const area = areaById.get(thread.areaId);
            const meta = area?.name ?? "";
            return (
              <CommandItem
                key={thread._id}
                value={`thread-${thread._id}`}
                keywords={area ? [thread.title, area.name] : [thread.title]}
                onSelect={() =>
                  run(() =>
                    navigate({
                      to: ".",
                      search: (prev) => ({
                        ...prev,
                        thread: thread.slug,
                      }),
                    }),
                  )
                }
              >
                <MessageSquare />
                <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                {meta && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {meta}
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
