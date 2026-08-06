// PROTOTYPE (issue #247) — THROWAWAY CODE, do not ship.
// Direction 4: a ⌘K command palette as jump-to-any-thread, decoupled from
// whatever persistent nav remains. Built on the existing Dialog + Input to
// avoid a cmdk dependency in a throwaway.

import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@vita-os/ui/components/dialog";
import { Input } from "@vita-os/ui/components/input";
import {
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";
import { cn } from "@/lib/utils";

import type {
  NavPrototypeData,
  NavPrototypeDialogsController,
} from "./nav-prototype-shared";

interface PaletteItem {
  id: string;
  group: "Actions" | "Go to" | "Areas" | "Threads";
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

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
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { areas, threads } = data;

  const items = useMemo<PaletteItem[]>(() => {
    const areaById = new Map((areas ?? []).map((a) => [a._id, a]));
    const close = () => onOpenChange(false);
    return [
      {
        id: "action-new-task",
        group: "Actions" as const,
        label: "New task",
        hint: "Q",
        icon: <Plus className="size-4" />,
        run: () => {
          close();
          dialogs.openNewTask();
        },
      },
      {
        id: "action-new-thread",
        group: "Actions" as const,
        label: "New thread",
        icon: <MessageSquare className="size-4" />,
        run: () => {
          close();
          dialogs.openCreateThread(undefined);
        },
      },
      {
        id: "go-dashboard",
        group: "Go to" as const,
        label: "Dashboard",
        icon: <LayoutDashboard className="size-4" />,
        run: () => {
          close();
          navigate({ to: "/" });
        },
      },
      {
        id: "go-inbox",
        group: "Go to" as const,
        label: "Inbox",
        icon: <Inbox className="size-4" />,
        run: () => {
          close();
          navigate({ to: "/inbox" });
        },
      },
      ...(areas ?? []).map((area) => ({
        id: `area-${area._id}`,
        group: "Areas" as const,
        label: area.name,
        icon: <AreaIcon icon={area.icon} className="size-4" />,
        run: () => {
          close();
          navigate({
            to: "/$areaSlug",
            params: { areaSlug: area.slug ?? area._id },
          });
        },
      })),
      ...(threads ?? []).map((thread) => {
        const area = areaById.get(thread.areaId);
        return {
          id: `thread-${thread._id}`,
          group: "Threads" as const,
          label: thread.title,
          hint: [
            area?.name,
            thread.state === "resolved" ? "resolved" : undefined,
          ]
            .filter(Boolean)
            .join(" · "),
          icon: <MessageSquare className="size-4 text-muted-foreground" />,
          run: () => {
            close();
            if (!area) return;
            navigate({
              to: "/$areaSlug/$threadSlug",
              params: {
                areaSlug: area.slug ?? area._id,
                threadSlug: thread.slug ?? thread._id,
              },
            });
          },
        };
      }),
    ];
  }, [areas, threads, dialogs, navigate, onOpenChange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.hint?.toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => setSelectedIndex(0), [query, open]);
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[selectedIndex]?.run();
    }
  }

  let lastGroup: string | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Jump to</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to an area, thread, or action…"
            autoFocus
            className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          )}
          {filtered.map((item, index) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {showGroup && (
                  <p className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                    {item.group}
                  </p>
                )}
                <button
                  type="button"
                  data-selected={index === selectedIndex}
                  onClick={item.run}
                  onMouseMove={() => setSelectedIndex(index)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm",
                    index === selectedIndex &&
                      "bg-accent text-accent-foreground",
                  )}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
