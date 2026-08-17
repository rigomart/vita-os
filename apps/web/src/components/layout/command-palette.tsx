import type { ProjectedArea } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import {
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Plus,
} from "lucide-react";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useAreaActions } from "@/features/areas/area-actions";
import { AreaIcon } from "@/features/areas/components/area-icon";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewTask: () => void;
  /** The optional Area scopes the new Thread; the root row passes nothing. */
  onNewThread: (areaId?: string) => void;
  onNewArea: () => void;
  onOpenInbox: () => void;
}

/**
 * Marks an Area row as a drill-in target. Read back off the currently selected
 * row when ArrowRight/Tab is pressed, so the keyboard entry does not need cmdk's
 * controlled `value` (whose encoding is an implementation detail of this file).
 */
const AREA_ID_ATTRIBUTE = "data-area-id";

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

  // `null` is the root list; an Area id is that Area's drill-in page. The search
  // is controlled so a page change can clear it — a query typed against the root
  // list means nothing against one Area's actions.
  const [pageAreaId, setPageAreaId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const pageArea = (areas ?? []).find((area) => area._id === pageAreaId);

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

  const openPage = (areaId: string) => {
    setPageAreaId(areaId);
    setSearch("");
  };

  const closePage = () => {
    setPageAreaId(null);
    setSearch("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) closePage();
    onOpenChange(next);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (pageArea) {
      // Escape and Backspace both step back one level rather than dismissing
      // the whole palette: the drill-in is a place inside the palette, and
      // losing the query along with the surface would be the bigger surprise.
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePage();
      }
      if (event.key === "Backspace" && search === "") {
        event.preventDefault();
        closePage();
      }
      return;
    }

    if (event.key !== "Tab" && event.key !== "ArrowRight") return;
    // ArrowRight still belongs to the text caret whenever there is text to its
    // right; only at the end of the query does it mean "go deeper".
    if (
      event.key === "ArrowRight" &&
      event.currentTarget.selectionStart !== search.length
    ) {
      return;
    }
    const selected = document.querySelector(
      `[cmdk-item][data-selected="true"][${AREA_ID_ATTRIBUTE}]`,
    );
    const areaId = selected?.getAttribute(AREA_ID_ATTRIBUTE);
    if (!areaId) return;
    event.preventDefault();
    openPage(areaId);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Jump to"
      description="Jump to an area, thread, or action"
      showCloseButton={false}
      // Function form: Base UI reads it at close time, after `run` has set the
      // flag, which a plain value could not see in the same commit.
      finalFocus={() => !skipFocusReturn.current}
      // Sit high so the on-screen keyboard never covers the input on mobile.
      className="top-[15%] translate-y-0"
    >
      {pageArea && (
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <button
            type="button"
            aria-label="Back to all results"
            onClick={closePage}
            className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <AreaIcon icon={pageArea.icon} className="size-4" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {pageArea.name}
          </span>
        </div>
      )}
      <CommandInput
        placeholder={
          pageArea
            ? `Actions in ${pageArea.name}…`
            : "Jump to an area, thread, or action…"
        }
        value={search}
        onValueChange={setSearch}
        onKeyDown={handleInputKeyDown}
      />
      {pageArea ? (
        <CommandList key={pageArea._id}>
          <CommandEmpty>No actions found.</CommandEmpty>
          <AreaActionsPage
            area={pageArea}
            onNewThread={onNewThread}
            run={run}
          />
          <AreaStandard standard={pageArea.standard} />
        </CommandList>
      ) : (
        <CommandList key="root">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => run(onNewTask)}>
              <Plus />
              New task
              <CommandShortcut>Q</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => run(() => onNewThread())}>
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
                // Kept in sync with AREA_ID_ATTRIBUTE above.
                data-area-id={area._id}
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
                <span className="min-w-0 flex-1 truncate">{area.name}</span>
                {/* Enter still navigates; this is the pointer's way in. */}
                <button
                  type="button"
                  aria-label={`Actions for ${area.name}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openPage(area._id);
                  }}
                  className="-my-1 flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  <ChevronRight className="size-4" />
                </button>
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
                  <span className="min-w-0 flex-1 truncate">
                    {thread.title}
                  </span>
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
      )}
    </CommandDialog>
  );
}

/**
 * The Area's actions, from the shared model. Condition writes stay on the page —
 * setting a Condition is a glance-and-adjust, and closing the palette to confirm
 * it would cost more than it tells. The two actions that open another surface go
 * through `run`, which closes first so focus lands in what they opened.
 */
function AreaActionsPage({
  area,
  onNewThread,
  run,
}: {
  area: ProjectedArea;
  onNewThread: (areaId?: string) => void;
  run: (action: () => void) => void;
}) {
  const navigate = useNavigate();
  const { actions } = useAreaActions(
    {
      condition: area.condition,
      id: area._id,
      name: area.name,
      slug: area.slug,
    },
    {
      onNewThread: (areaId) => run(() => onNewThread(areaId)),
      onOpenArea: (target) =>
        run(() =>
          navigate({ to: "/$areaSlug", params: { areaSlug: target.slug } }),
        ),
    },
  );

  return (
    <CommandGroup heading="Actions">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <CommandItem
            key={action.id}
            value={action.id}
            keywords={[action.label, ...action.keywords]}
            onSelect={action.run}
          >
            <Icon />
            <span className="min-w-0 flex-1 truncate">{action.label}</span>
            {action.active && (
              <span className="shrink-0 text-xs text-muted-foreground">
                Current
              </span>
            )}
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}

/**
 * The Standard, read-only. Deliberately not a `CommandItem`: it is the reference
 * you check an action against, so it must never be filtered away by a query or
 * land under the selection ring on its way down the list.
 */
function AreaStandard({ standard }: { standard: string | undefined }) {
  return (
    <div className="border-t px-3 py-2.5">
      <p className="text-xs font-medium text-muted-foreground">Standard</p>
      {standard ? (
        <p className="mt-1 text-sm whitespace-pre-wrap">{standard}</p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          No Standard yet — write it on the Area page.
        </p>
      )}
    </div>
  );
}
