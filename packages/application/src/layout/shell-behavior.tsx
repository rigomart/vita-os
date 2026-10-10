import type { Note } from "@vita-os/contracts";
import type { CSSProperties, ReactNode } from "react";

import { useMatch, useNavigate, useSearch } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";

import type { ProductSearch } from "../navigation/search-params";

import { useAreas } from "../areas/hooks";
import { ManageAreasDialog } from "../areas/manage-areas/manage-areas-dialog";
import { filteredAreaId } from "../dashboard/components/dashboard-filter-model";
import { useDashboardPath } from "../navigation/dashboard-path";
import { toNotesFilter } from "../navigation/search-params";
import { useAreaFilterShortcuts } from "../navigation/use-area-filter-shortcuts";
import { useCommandPaletteShortcut } from "../navigation/use-command-palette-shortcut";
import { useCreateDialogs } from "../navigation/use-create-dialogs";
import { useGlobalNewNoteShortcut } from "../navigation/use-global-new-note-shortcut";
import { useOpenThreadInPlace } from "../navigation/use-open-thread-in-place";
import { NoteDialog } from "../notes/note-view/note-dialog";
import { StandaloneNoteDialog } from "../notes/note-view/standalone-note-dialog";
import { useCreateNote } from "../notes/use-create-note";
import { NewThreadDialog } from "../threads/new-thread/new-thread-dialog";
import { ThreadDetailView } from "../threads/thread-detail/thread-detail-view";
import { useCreateThread } from "../threads/use-create-thread";
import { CommandPalette } from "./command-palette";

// Matches the thread pane's width in ThreadDetailPane.
const RAIL_WIDTH = "clamp(28rem,34vw,34rem)";

/** What chrome can ask of the shell. */
export interface ShellActions {
  onNewNote: () => void;
  onNewThread: () => void;
  onOpenPalette: () => void;
  onManageAreas: () => void;
}

const ShellActionsContext = createContext<ShellActions | null>(null);

export function useShellActions(): ShellActions {
  const actions = useContext(ShellActionsContext);
  if (actions === null) throw new Error("ShellBehavior is missing.");
  return actions;
}

/**
 * The shell's behavior without its chrome: the Thread pane over `?thread=`,
 * the palette on ⌘K, a new Note on Q, `1..9` for the Areas, and the create
 * and Manage areas dialogs. `AppShell` draws the product's chrome inside it;
 * anything else that draws chrome reaches the same actions with
 * `useShellActions`.
 */
export function ShellBehavior({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const dashboard = useDashboardPath();
  const createNote = useCreateNote();
  const createThread = useCreateThread();
  const dialogs = useCreateDialogs();
  const openThreadInPlace = useOpenThreadInPlace();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // An Archived Note chosen from the palette's History, read over the page.
  const [historyNote, setHistoryNote] = useState<Note | null>(null);
  const areas = useAreas().data;

  useGlobalNewNoteShortcut(dialogs.openNewNote);
  useCommandPaletteShortcut(() => setPaletteOpen(true));
  useAreaFilterShortcuts(areas);

  // The thread pane opens from two sources: the global `?thread=<slug>`
  // search param (any page, in place) or the /threads/$threadSlug deep link.
  // When both are present, the search param wins. Not strict, so the shell
  // works under any route that carries the product's search.
  const {
    thread: searchThreadSlug,
    area,
    show,
    inbox,
  }: ProductSearch = useSearch({ strict: false });
  const threadRouteMatch = useMatch({
    from: "/_authenticated/threads/$threadSlug",
    shouldThrow: false,
  });
  const isSearchSource = searchThreadSlug !== undefined;
  const openThreadSlug =
    searchThreadSlug ?? threadRouteMatch?.params.threadSlug;

  // `?inbox=true` summoned the Notes panel over any page. Notes now live on
  // the Dashboard, so the old address lands there filtered to Notes, keeping
  // a Thread that was open.
  useEffect(() => {
    if (inbox !== true) return;
    void navigate({
      to: dashboard,
      search: (prev: ProductSearch): ProductSearch =>
        toNotesFilter({ ...prev, thread: openThreadSlug }),
      replace: true,
    });
  }, [inbox, navigate, dashboard, openThreadSlug]);

  // A Thread captured while the Dashboard is filtered to an Area starts in
  // that Area; the dialog's chip can clear it before saving. The Notes filter
  // is not an Area, so it gives none.
  const createForAreaId = filteredAreaId({ area, show }, areas ?? []);

  // Close must leave the thread route when one is matched underneath, even if
  // the pane was showing a search-param thread on top of it — stripping only
  // the param would let the route match reopen the pane with the stale thread.
  const closeThreadPane = () => {
    navigate({
      to: threadRouteMatch === undefined ? "." : dashboard,
      search: (prev: ProductSearch): ProductSearch => ({
        ...prev,
        thread: undefined,
      }),
      replace: true,
    });
  };

  const handleThreadLocationChange = ({
    threadSlug,
  }: {
    threadSlug: string;
  }) => {
    if (isSearchSource) {
      navigate({
        to: ".",
        search: (prev: ProductSearch): ProductSearch => ({
          ...prev,
          thread: threadSlug,
        }),
        replace: true,
      });
    } else {
      navigate({
        to: "/threads/$threadSlug",
        params: { threadSlug },
        replace: true,
      });
    }
  };

  const actions: ShellActions = {
    onNewNote: dialogs.openNewNote,
    onNewThread: () => dialogs.openCreateThread(createForAreaId),
    onOpenPalette: () => setPaletteOpen(true),
    onManageAreas: dialogs.openManageAreas,
  };

  return (
    <ShellActionsContext value={actions}>
      {/* The thread rail covers the page rather than pushing it (ADR 0023).
          The page keeps its full width; `--rail` is the rail's width for
          anything that must clear it. */}
      <div
        style={
          {
            "--rail": openThreadSlug === undefined ? "0px" : RAIL_WIDTH,
          } as CSSProperties
        }
      >
        {children}
      </div>
      {openThreadSlug !== undefined && (
        <ThreadDetailView
          threadSlug={openThreadSlug}
          onClose={closeThreadPane}
          onThreadLocationChange={handleThreadLocationChange}
        />
      )}

      {/* Mounted on demand: each surface holds form state and subscriptions
          that should not exist — or survive a close — while it is hidden. */}
      {paletteOpen && (
        <CommandPalette
          open
          onOpenChange={setPaletteOpen}
          onNewNote={actions.onNewNote}
          onNewThread={actions.onNewThread}
          onManageAreas={actions.onManageAreas}
          onOpenNote={setHistoryNote}
        />
      )}
      {historyNote && (
        <StandaloneNoteDialog
          key={historyNote._id}
          note={historyNote}
          onOpenChange={(open) => {
            if (!open) setHistoryNote(null);
          }}
        />
      )}

      {dialogs.showCreateThread && (
        <NewThreadDialog
          open
          onOpenChange={dialogs.setShowCreateThread}
          defaultAreaId={dialogs.createForAreaId}
          onSubmit={async (value) => {
            const { slug } = await createThread(value);
            dialogs.setShowCreateThread(false);
            openThreadInPlace(slug);
          }}
        />
      )}
      {dialogs.showNewNote && (
        <NoteDialog
          open
          onOpenChange={dialogs.setShowNewNote}
          onSubmit={async (value) => {
            await createNote(value);
            dialogs.setShowNewNote(false);
          }}
        />
      )}
      {dialogs.showManageAreas && (
        <ManageAreasDialog open onOpenChange={dialogs.setShowManageAreas} />
      )}
    </ShellActionsContext>
  );
}
