import type { AreaSummary, Note } from "@vita-os/contracts";

import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAreas } from "@vita-os/application";
import { ManageAreasDialog } from "@vita-os/application/internal/areas/manage-areas/manage-areas-dialog.tsx";
import { filteredAreaId } from "@vita-os/application/internal/dashboard/components/dashboard-filter-model.ts";
import { CommandPalette } from "@vita-os/application/internal/layout/command-palette.tsx";
import {
  readProductSearch,
  withDashboardFilter,
} from "@vita-os/application/internal/navigation/search-params.ts";
import { useCommandPaletteShortcut } from "@vita-os/application/internal/navigation/use-command-palette-shortcut.ts";
import { useCreateDialogs } from "@vita-os/application/internal/navigation/use-create-dialogs.ts";
import { useGlobalNewNoteShortcut } from "@vita-os/application/internal/navigation/use-global-new-note-shortcut.ts";
import { useOpenThreadInPlace } from "@vita-os/application/internal/navigation/use-open-thread-in-place.ts";
import { NoteDialog } from "@vita-os/application/internal/notes/note-view/note-dialog.tsx";
import { StandaloneNoteDialog } from "@vita-os/application/internal/notes/note-view/standalone-note-dialog.tsx";
import { useCreateNote } from "@vita-os/application/internal/notes/use-create-note.ts";
import { NewThreadDialog } from "@vita-os/application/internal/threads/new-thread/new-thread-dialog.tsx";
import { ThreadDetailView } from "@vita-os/application/internal/threads/thread-detail/thread-detail-view.tsx";
import { useCreateThread } from "@vita-os/application/internal/threads/use-create-thread.ts";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/** What a direction's chrome can ask of the shell. */
interface ShellActions {
  openPalette: () => void;
  newNote: () => void;
  newThread: () => void;
  manageAreas: () => void;
  openNote: (note: Note) => void;
}

const ShellContext = createContext<ShellActions | null>(null);

export function useShell(): ShellActions {
  const shell = useContext(ShellContext);
  if (shell === null) throw new Error("PrototypeShell is missing.");
  return shell;
}

/**
 * The product's shell without its chrome, so each direction draws its own:
 * the Thread pane over `?thread=`, the palette on ⌘K, a new Note on Q, the
 * create and Manage areas dialogs, and 1–9 for the Areas.
 *
 * The product's `AppShell` can't be reused here because it draws the chrome
 * these directions replace. Unlike it, this one never navigates to `/`, which
 * would leave the lab for the shipped Dashboard.
 */
export function PrototypeShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const search = useRouterState({
    select: (state) =>
      readProductSearch(state.location.search as Record<string, unknown>),
  });
  const areas = useAreas().data;
  const dialogs = useCreateDialogs();
  const createNote = useCreateNote();
  const createThread = useCreateThread();
  const openThreadInPlace = useOpenThreadInPlace();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [openedNote, setOpenedNote] = useState<Note | null>(null);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  useCommandPaletteShortcut(openPalette);
  useGlobalNewNoteShortcut(dialogs.openNewNote);
  useAreaDigits(areas);

  const createForAreaId = filteredAreaId(search, areas ?? []);
  const actions: ShellActions = {
    openPalette,
    newNote: dialogs.openNewNote,
    newThread: () => dialogs.openCreateThread(createForAreaId),
    manageAreas: dialogs.openManageAreas,
    openNote: setOpenedNote,
  };

  const setThread = (thread: string | undefined) =>
    void navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => ({ ...previous, thread }),
      replace: true,
    } as never);

  return (
    <ShellContext value={actions}>
      {children}

      {search.thread !== undefined && (
        <ThreadDetailView
          threadSlug={search.thread}
          onClose={() => setThread(undefined)}
          onThreadLocationChange={({ threadSlug }) => setThread(threadSlug)}
        />
      )}
      {paletteOpen && (
        <CommandPalette
          open
          onOpenChange={setPaletteOpen}
          onNewNote={dialogs.openNewNote}
          onNewThread={actions.newThread}
          onManageAreas={dialogs.openManageAreas}
          onOpenNote={setOpenedNote}
        />
      )}
      {openedNote && (
        <StandaloneNoteDialog
          key={openedNote._id}
          note={openedNote}
          onOpenChange={(open) => {
            if (!open) setOpenedNote(null);
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
    </ShellContext>
  );
}

/** `1..9` filter to the Nth Area and `0` returns to All, as in the product. */
function useAreaDigits(areas: readonly AreaSummary[] | undefined) {
  const navigate = useNavigate();

  useEffect(() => {
    if (areas === undefined) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (!event.code.startsWith("Digit")) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      const digit = Number(event.code.slice("Digit".length));
      const area = digit === 0 ? undefined : areas[digit - 1];
      if (digit !== 0 && area === undefined) return;
      event.preventDefault();
      void navigate({
        to: ".",
        search: withDashboardFilter({ area: area?.slug }),
      } as never);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [areas, navigate]);
}
