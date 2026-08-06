// PROTOTYPE (issue #247) — THROWAWAY CODE, do not ship.
// Direction 4: a ⌘K command palette as jump-to-any-thread, decoupled from
// whatever persistent nav remains. Built on the shadcn Command component
// (cmdk), adapted to the project's Base UI dialog.

import { useNavigate } from "@tanstack/react-router";
import { Inbox, LayoutDashboard, MessageSquare, Plus } from "lucide-react";
import { useEffect } from "react";

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

import type {
  NavPrototypeData,
  NavPrototypeDialogsController,
} from "./nav-prototype-shared";

export function usePaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpen();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpen]);
}

export function NavPrototypePalette({
  open,
  onOpenChange,
  data,
  dialogs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: NavPrototypeData;
  dialogs: NavPrototypeDialogsController;
}) {
  const navigate = useNavigate();
  const { areas, threads } = data;
  const areaById = new Map((areas ?? []).map((a) => [a._id, a]));

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
          <CommandItem onSelect={() => run(dialogs.openNewTask)}>
            <Plus />
            New task
            <CommandShortcut>Q</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => dialogs.openCreateThread(undefined))}
          >
            <MessageSquare />
            New thread
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
            return (
              <CommandItem
                key={thread._id}
                value={`thread-${thread._id}`}
                keywords={[thread.title, area?.name ?? ""]}
                onSelect={() =>
                  run(() => {
                    if (!area) return;
                    navigate({
                      to: "/$areaSlug/$threadSlug",
                      params: {
                        areaSlug: area.slug ?? area._id,
                        threadSlug: thread.slug ?? thread._id,
                      },
                    });
                  })
                }
              >
                <MessageSquare />
                <span className="min-w-0 flex-1 truncate">{thread.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {[
                    area?.name,
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
