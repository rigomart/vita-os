import type { ReactNode } from "react";

import { useMatch, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";

import type { ProductSearch } from "../navigation/search-params";

import { useAreas } from "../areas/hooks";
import { ManageAreasDialog } from "../areas/manage-areas/manage-areas-dialog";
import { readDashboardFilter } from "../dashboard/components/dashboard-filter-model";
import { InboxSurface } from "../inbox/surface/inbox-surface";
import { useInboxSurface } from "../inbox/surface/use-inbox-surface";
import { useAreaFilterShortcuts } from "../navigation/use-area-filter-shortcuts";
import { useCommandPaletteShortcut } from "../navigation/use-command-palette-shortcut";
import { useCreateDialogs } from "../navigation/use-create-dialogs";
import { useGlobalNewNoteShortcut } from "../navigation/use-global-new-note-shortcut";
import { useOpenNoteCount } from "../notes/hooks";
import { NewNoteDialog } from "../notes/new-note/new-note-dialog";
import { useCreateNote } from "../notes/use-create-note";
import { ThreadDetailView } from "../threads/thread-detail/thread-detail-view";
import { CreateThreadDialog } from "../threads/thread-form/create-thread-dialog";
import { AppChrome } from "./app-chrome";
import { CommandPalette } from "./command-palette";

export function AppShell({ children }: { children: ReactNode }) {
  const noteCount = useOpenNoteCount().data;
  const navigate = useNavigate();
  const createNote = useCreateNote();
  const dialogs = useCreateDialogs();
  const inbox = useInboxSurface();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const areas = useAreas().data;

  useGlobalNewNoteShortcut(dialogs.openNewNote);
  useCommandPaletteShortcut(() => setPaletteOpen(true));
  useAreaFilterShortcuts(areas);

  // The thread pane opens from two sources: the global `?thread=<slug>`
  // search param (any page, in place) or the /threads/$threadSlug deep link.
  // When both are present, the search param wins.
  const { thread: searchThreadSlug, area: areaFilter }: ProductSearch =
    useSearch({ from: "/_authenticated" });
  const threadRouteMatch = useMatch({
    from: "/_authenticated/threads/$threadSlug",
    shouldThrow: false,
  });
  const isSearchSource = searchThreadSlug !== undefined;
  const openThreadSlug =
    searchThreadSlug ?? threadRouteMatch?.params.threadSlug;

  // A Thread captured while the Dashboard is filtered to an Area starts in
  // that Area; the dialog's chip can clear it before saving.
  const filter = readDashboardFilter(areaFilter, areas ?? []);
  const filteredAreaId = filter.kind === "area" ? filter.area._id : undefined;

  const openThreadInPlace = (slug: string) => {
    navigate({
      to: ".",
      search: (prev: ProductSearch): ProductSearch => ({
        ...prev,
        thread: slug,
      }),
    });
  };

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

  return (
    <div className="flex min-h-svh">
      {/* The content column sits beside the thread rail's width spacer; the
          chrome is fixed and clears the rail by its own offset instead. */}
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <AppChrome
          noteCount={noteCount}
          inboxOpen={inbox.isOpen}
          onToggleInbox={inbox.toggle}
          onNewNote={dialogs.openNewNote}
          onNewThread={() => dialogs.openCreateThread(filteredAreaId)}
          onManageAreas={dialogs.openManageAreas}
          onOpenPalette={() => setPaletteOpen(true)}
          railOpen={openThreadSlug !== undefined}
        />
        {/* Inside the column, not beside it — see InboxPopoverPanel. */}
        <InboxSurface />
        {/* The chrome floats, so this padding is what clears it. */}
        <main className="w-full min-w-0 flex-1 px-4 pt-20 pb-24">
          {children}
        </main>
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
          onNewNote={dialogs.openNewNote}
          onNewThread={() => dialogs.openCreateThread(filteredAreaId)}
          onManageAreas={dialogs.openManageAreas}
          onOpenInbox={inbox.open}
        />
      )}

      {dialogs.showCreateThread && (
        <CreateThreadDialog
          open
          onOpenChange={dialogs.setShowCreateThread}
          defaultAreaId={dialogs.createForAreaId}
          onCreated={({ slug }) => {
            openThreadInPlace(slug);
          }}
        />
      )}
      {dialogs.showNewNote && (
        <NewNoteDialog
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
    </div>
  );
}
