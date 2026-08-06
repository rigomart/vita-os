import type { Doc } from "@convex/_generated/dataModel";

import { useNavigate } from "@tanstack/react-router";
import {
  FolderPlus,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Plus,
} from "lucide-react";
import { useMemo } from "react";

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
  areas: Doc<"areas">[] | undefined;
  threads: Doc<"threads">[] | undefined;
  onNewTask: () => void;
  onNewThread: () => void;
  onNewArea: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  areas,
  threads,
  onNewTask,
  onNewThread,
  onNewArea,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const areaById = useMemo(
    () => new Map((areas ?? []).map((area) => [area._id, area])),
    [areas],
  );

  const run = (action: () => void) => {
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
          <CommandItem onSelect={() => run(() => navigate({ to: "/inbox" }))}>
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
                    params: { areaSlug: area.slug ?? area._id },
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
            if (!area) return null;
            return (
              <CommandItem
                key={thread._id}
                value={`thread-${thread._id}`}
                keywords={[thread.title, area.name]}
                onSelect={() =>
                  run(() =>
                    navigate({
                      to: "/$areaSlug/$threadSlug",
                      params: {
                        areaSlug: area.slug ?? area._id,
                        threadSlug: thread.slug ?? thread._id,
                      },
                    }),
                  )
                }
              >
                <MessageSquare />
                <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {[
                    area.name,
                    thread.state === "resolved" ? "resolved" : undefined,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
