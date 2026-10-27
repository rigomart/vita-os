import type { Note } from "@vita-os/contracts";
import type { CSSProperties, ReactNode } from "react";

import { useMatch, useNavigate, useSearch } from "@tanstack/react-router";
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import type { ProductSearch } from "../navigation/search-params";

import { useAreas } from "../areas/hooks";
import { ManageAreasDialog } from "../areas/manage-areas/manage-areas-dialog";
import { filteredAreaId } from "../dashboard/components/dashboard-filter-model";
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
import { type HostCommand, useHostCommands } from "./host-commands";

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
 * the palette on ⌘K, a new Note on Q, `1..9` for the Areas, the create and
 * Manage areas dialogs, and the commands a host's own chrome sends, like the
 * desktop's menu bar. `AppShell` draws the product's chrome inside it;
 * anything else that draws chrome reaches the same actions with
 * `useShellActions`.
 */
export function ShellBehavior({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const createNote = useCreateNote();
  const createThread = useCreateThread();
  const dialogs = useCreateDialogs();
  const openThreadInPlace = useOpenThreadInPlace();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // A Completed Note chosen from the palette's History, read over the page.
  const [historyNote, setHistoryNote] = useState<Note | null>(null);
  const areas = useAreas().data;

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

  const paneFocus = useThreadPaneFocusReturn(openThreadSlug);
  const openPalette = () => {
    paneFocus.holdOpener();
    setPaletteOpen(true);
  };

  useGlobalNewNoteShortcut(dialogs.openNewNote);
  useCommandPaletteShortcut(openPalette);
  useAreaFilterShortcuts(areas);

  // `?inbox=true` summoned the Notes panel over any page. Notes now live on
  // the Dashboard, so the old address lands there filtered to Notes, keeping
  // a Thread that was open.
  useEffect(() => {
    if (inbox !== true) return;
    void navigate({
      to: "/",
      search: (prev: ProductSearch): ProductSearch =>
        toNotesFilter({ ...prev, thread: openThreadSlug }),
      replace: true,
    });
  }, [inbox, navigate, openThreadSlug]);

  // A Thread captured while the Dashboard is filtered to an Area starts in
  // that Area; the dialog's chip can clear it before saving. The Notes filter
  // is not an Area, so it gives none.
  const createForAreaId = filteredAreaId({ area, show }, areas ?? []);

  // Close must leave the thread route when one is matched underneath, even if
  // the pane was showing a search-param thread on top of it — stripping only
  // the param would let the route match reopen the pane with the stale thread.
  const closeThreadPane = () => {
    navigate({
      to: threadRouteMatch === undefined ? "." : "/",
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
    onNewThread: () => {
      paneFocus.holdOpener();
      dialogs.openCreateThread(createForAreaId);
    },
    onOpenPalette: openPalette,
    onManageAreas: dialogs.openManageAreas,
  };

  const subscribeToHost = useHostCommands();
  const runHostCommand = useEffectEvent((command: HostCommand) => {
    if (command === "new-note") actions.onNewNote();
    else if (command === "new-thread") actions.onNewThread();
    else actions.onOpenPalette();
  });
  useEffect(() => subscribeToHost?.(runHostCommand), [subscribeToHost]);

  return (
    <ShellActionsContext value={actions}>
      {/* The thread rail covers the page rather than pushing it (ADR 0023).
          The page keeps its full width; `--rail` is the rail's width for
          anything that must clear it. */}
      <div
        ref={paneFocus.pageRef}
        onFocus={paneFocus.trackOpener}
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
          onOpenChange={(open) => {
            if (!open) paneFocus.releaseOpener();
            setPaletteOpen(open);
          }}
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
          onOpenChange={(open) => {
            if (!open) paneFocus.releaseOpener();
            dialogs.setShowCreateThread(open);
          }}
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

/** A closing dialog may hand focus back to an older element, so the opener is held while the palette or New thread dialog is open. */
function useThreadPaneFocusReturn(openThreadSlug: string | undefined) {
  const pageRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const heldRef = useRef(false);
  const wasOpenRef = useRef(openThreadSlug !== undefined);

  const onPage = (element: Element | null): element is HTMLElement =>
    element instanceof HTMLElement &&
    pageRef.current?.contains(element) === true;

  // React's focus events bubble through portals; only the page's own count.
  const trackOpener = (event: React.FocusEvent) => {
    if (!heldRef.current && onPage(event.target)) {
      openerRef.current = event.target;
    }
  };

  const holdOpener = () => {
    const active = document.activeElement;
    if (onPage(active)) openerRef.current = active;
    heldRef.current = true;
  };
  const releaseOpener = () => {
    heldRef.current = false;
  };

  useEffect(() => {
    const paneOpen = openThreadSlug !== undefined;
    const closed = wasOpenRef.current && !paneOpen;
    wasOpenRef.current = paneOpen;
    if (paneOpen) {
      releaseOpener();
      return;
    }
    if (!closed) return;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const opener = openerRef.current;
    if (opener?.isConnected) {
      opener.focus();
      if (document.activeElement === opener) return;
    }
    pageRef.current
      ?.querySelector<HTMLElement>("main")
      ?.focus({ preventScroll: true });
  }, [openThreadSlug]);

  return { pageRef, trackOpener, holdOpener, releaseOpener };
}
