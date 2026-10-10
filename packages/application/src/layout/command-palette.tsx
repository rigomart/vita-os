import type { Note } from "@vita-os/contracts";

import { useNavigate, useSearch } from "@tanstack/react-router";
import { boundNoteSearch, matchesNoteSearch } from "@vita-os/core";
import { Button } from "@vita-os/ui/components/button";
import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { defaultFilter } from "cmdk";
import { format, isSameYear } from "date-fns";
import {
  FilterX,
  History,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Plus,
  StickyNote,
  Tags,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ProductSearch } from "../navigation/search-params";

import { AreaIcon } from "../areas/components/area-icon";
import { useAreas } from "../areas/hooks";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { clock } from "../lib/clock";
import { NOTES_FILTER, withDashboardFilter } from "../navigation/search-params";
import { useArchivedNotes } from "../notes/hooks";
import { useOpenThreads, useResolvedThreads } from "../threads/hooks";
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
  /** Read an Archived Note chosen from History over the current page. */
  onOpenNote: (note: Note) => void;
}

/** How long typing settles before History searches Archived Notes. */
const ARCHIVED_SEARCH_DELAY = 250;

// Equal History scores retain the API's order when searching. Archived Notes
// are searched on the service; the same rule here narrows what is already on
// screen while that answer is on its way.
function paletteFilter(value: string, search: string, keywords?: string[]) {
  if (value.startsWith("resolved-thread-")) {
    return defaultFilter((keywords ?? []).join(" "), search) > 0 ? 1 : 0;
  }
  if (value.startsWith("archived-note-")) {
    return matchesNoteSearch((keywords ?? []).join(" "), search) ? 1 : 0;
  }
  const score = defaultFilter(value, search, keywords);
  if (score === 0) return 0;
  if (value.startsWith("thread-")) return 0.75 + score / 4;
  return score / 4;
}

export function CommandPalette({
  open,
  onOpenChange,
  onNewNote,
  onNewThread,
  onManageAreas,
  onOpenNote,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { area: areaFilter, show }: ProductSearch = useSearch({
    strict: false,
  });
  // The palette is mounted only while it is open, so these subscriptions live
  // exactly as long as the surface that reads them.
  const areas = useAreas({ enabled: open }).data;
  const threads = useOpenThreads({ enabled: open }).data;
  const [search, setSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const archivedSearch = useDebouncedValue(
    boundNoteSearch(search),
    ARCHIVED_SEARCH_DELAY,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const resolvedQuery = useResolvedThreads({ enabled: open && showHistory });
  const archivedQuery = useArchivedNotes({
    query: archivedSearch,
    enabled: open && showHistory,
  });
  const visibleThreads = showHistory ? resolvedQuery.data : threads;
  const archivedNotes = showHistory ? archivedQuery.notes : [];
  // Pagination belongs to the settled search, never the previous results
  // retained while a new search is on its way. Empty History stays one page.
  const canLoadMoreArchived =
    archivedSearch !== "" &&
    archivedSearch === boundNoteSearch(search) &&
    !archivedQuery.isPlaceholderData &&
    archivedQuery.hasNextPage;
  useEffect(() => {
    inputRef.current?.focus();
  }, [showHistory]);
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

  const filterBy = (filter: Parameters<typeof withDashboardFilter>[0]) =>
    run(() => navigate({ to: "/", search: withDashboardFilter(filter) }));
  const historyLoading =
    showHistory && (resolvedQuery.isPending || archivedQuery.isPending);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Jump to"
      description="Jump to a thread, filter the board, or run an action"
      showCloseButton={false}
      filter={paletteFilter}
      // Each view owns its selection. Otherwise cmdk can retain an item from
      // the previous view and leave Enter without a visible target.
      commandKey={showHistory ? "history" : "open"}
      // Function form: Base UI reads it at close time, after `run` has set the
      // flag, which a plain value could not see in the same commit.
      finalFocus={() => !skipFocusReturn.current}
      // Sit high so the on-screen keyboard never covers the input on mobile.
      className="top-[15%] translate-y-0"
    >
      <CommandInput
        ref={inputRef}
        placeholder={
          showHistory
            ? "Search resolved threads and archived notes…"
            : "Jump to a thread, area, or action…"
        }
        value={search}
        onValueChange={setSearch}
      />
      <div className="border-b px-3 py-2">
        <Button
          size="xs"
          variant={showHistory ? "secondary" : "outline"}
          aria-pressed={showHistory}
          // cmdk handles Enter for list selection. The chip owns its keyboard
          // activation, so it must not also select the current Thread.
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ")
              event.stopPropagation();
          }}
          onClick={() => {
            setShowHistory((previous) => !previous);
            setSearch("");
          }}
        >
          <History aria-hidden />
          History
        </Button>
      </div>
      <CommandList>
        <CommandEmpty>
          {historyLoading
            ? "Loading history…"
            : showHistory && !search.trim()
              ? "No resolved threads or archived notes yet."
              : "No results found."}
        </CommandEmpty>
        {/* Jumping first: Threads are the work. Create lives last because the
            dock already offers those one-tap actions; keeping the rows means
            "new thread" still matches when someone searches rather than taps. */}
        <CommandGroup heading={showHistory ? "Resolved threads" : "Threads"}>
          {(visibleThreads ?? []).map((thread) => {
            const area =
              thread.areaId === undefined
                ? undefined
                : areaById.get(thread.areaId);
            return (
              <CommandItem
                key={thread._id}
                value={`${showHistory ? "resolved-thread" : "thread"}-${thread._id}`}
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
        {showHistory && (
          <CommandGroup heading="Archived notes">
            {archivedNotes.map((note) => (
              <ArchivedNoteItem
                key={note._id}
                note={note}
                onSelect={() => run(() => onOpenNote(note))}
              />
            ))}
            {canLoadMoreArchived && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 w-full"
                aria-label="Load more archived notes"
                aria-busy={archivedQuery.isFetching || undefined}
                disabled={archivedQuery.isFetching}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ")
                    event.stopPropagation();
                }}
                onClick={() => {
                  if (archivedQuery.isFetching) return;
                  inputRef.current?.focus();
                  void archivedQuery.fetchNextPage();
                }}
              >
                {archivedQuery.isFetching ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Plus />
                )}
                {archivedQuery.isFetching
                  ? "Loading…"
                  : "Load more archived notes"}
              </Button>
            )}
          </CommandGroup>
        )}
        {!showHistory && (
          <>
            <CommandGroup heading="Filter">
              {(areas ?? []).map((area) => (
                <CommandItem
                  key={area._id}
                  value={`filter-${area._id}`}
                  keywords={[`Filter: ${area.name}`, area.name]}
                  onSelect={() => filterBy({ area: area.slug })}
                >
                  <AreaIcon icon={area.icon} className="size-4" />
                  <span className="min-w-0 flex-1 truncate">
                    Filter: {area.name}
                  </span>
                </CommandItem>
              ))}
              {(areaFilter !== undefined || show !== undefined) && (
                <CommandItem
                  value="filter-clear"
                  keywords={["Clear filter", "all"]}
                  onSelect={() => filterBy({})}
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
              {/* Notes live on the Dashboard: going to them filters it. */}
              <CommandItem
                keywords={["Filter: Notes", "notes"]}
                onSelect={() => filterBy({ show: NOTES_FILTER })}
              >
                <StickyNote />
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
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** An Archived Note in History: one line of its text and when it was archived. */
function ArchivedNoteItem({
  note,
  onSelect,
}: {
  note: Note;
  onSelect: () => void;
}) {
  const preview = markdownToPlainText(note.body).replace(/\s+/g, " ").trim();
  const archivedAt =
    note.completedAt === undefined ? undefined : new Date(note.completedAt);
  return (
    <CommandItem
      value={`archived-note-${note._id}`}
      keywords={[note.body]}
      onSelect={onSelect}
    >
      <StickyNote />
      <span className="min-w-0 flex-1 truncate">{preview}</span>
      {archivedAt && (
        <time
          dateTime={archivedAt.toISOString()}
          className="shrink-0 text-xs text-muted-foreground"
        >
          {format(
            archivedAt,
            isSameYear(archivedAt, clock.now()) ? "MMM d" : "MMM d, yyyy",
          )}
        </time>
      )}
    </CommandItem>
  );
}
