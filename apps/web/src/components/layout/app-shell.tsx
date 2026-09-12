import type { Id } from "@convex/_generated/dataModel";
import type { ReactNode } from "react";

import { api } from "@convex/_generated/api";
import { useMatch, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";

import { CreateAreaDialog } from "@/features/areas/area-form/create-area-dialog";
import { InboxSurface } from "@/features/inbox/surface/inbox-surface";
import { useInboxSurface } from "@/features/inbox/surface/use-inbox-surface";
import { useCommandPaletteShortcut } from "@/features/navigation/use-command-palette-shortcut";
import { useCreateDialogs } from "@/features/navigation/use-create-dialogs";
import { useGlobalNewNoteShortcut } from "@/features/navigation/use-global-new-note-shortcut";
import { NewNoteDialog } from "@/features/notes/new-note/new-note-dialog";
import { useCreateNote } from "@/features/notes/use-create-note";
import { ThreadDetailView } from "@/features/threads/thread-detail/thread-detail-view";
import { CreateThreadDialog } from "@/features/threads/thread-form/create-thread-dialog";

import { AppChrome } from "./app-chrome";
import { CommandPalette } from "./command-palette";

export function AppShell({ children }: { children: ReactNode }) {
  const noteCount = useQuery(api.notes.count);
  const navigate = useNavigate();
  const createNote = useCreateNote();
  const dialogs = useCreateDialogs();
  const inbox = useInboxSurface();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // The area list is only read by the create-thread dialog here; the palette
  // subscribes for itself while it is mounted.
  const createThreadAreas = useQuery(
    api.areas.list,
    dialogs.showCreateThread ? {} : "skip",
  );

  useGlobalNewNoteShortcut(dialogs.openNewNote);
  useCommandPaletteShortcut(() => setPaletteOpen(true));

  // The thread pane opens from two sources: the global `?thread=<slug>`
  // search param (any page, in place) or the /$areaSlug/$threadSlug deep
  // link. When both are present, the search param wins.
  const { thread: searchThreadSlug } = useSearch({ from: "/_authenticated" });
  const threadRouteMatch = useMatch({
    from: "/_authenticated/$areaSlug/$threadSlug",
    shouldThrow: false,
  });
  const routeAreaSlug = threadRouteMatch?.params.areaSlug;
  const isSearchSource = searchThreadSlug !== undefined;
  const openThreadSlug =
    searchThreadSlug ?? threadRouteMatch?.params.threadSlug;

  const openThreadInPlace = (slug: string) => {
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, thread: slug }),
    });
  };

  // Close must leave the thread route when one is matched underneath, even if
  // the pane was showing a search-param thread on top of it — stripping only
  // the param would let the route match reopen the pane with the stale thread.
  const closeThreadPane = () => {
    if (routeAreaSlug !== undefined) {
      navigate({
        to: "/$areaSlug",
        params: { areaSlug: routeAreaSlug },
        search: (prev) => ({ ...prev, thread: undefined }),
        replace: true,
      });
    } else {
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, thread: undefined }),
        replace: true,
      });
    }
  };

  const handleThreadLocationChange = ({
    areaSlug,
    threadSlug,
  }: {
    areaSlug: string;
    threadSlug: string;
  }) => {
    if (isSearchSource) {
      navigate({
        to: ".",
        search: (prev) => ({ ...prev, thread: threadSlug }),
        replace: true,
      });
    } else {
      navigate({
        to: "/$areaSlug/$threadSlug",
        params: { areaSlug, threadSlug },
        replace: true,
      });
    }
  };

  return (
    <div className="flex min-h-svh">
      {/* The content column sits beside the thread rail's width spacer. The
          chrome is fixed rather than in this column, so it clears the rail by
          its own offset instead of being pushed — see AppChrome. */}
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        <AppChrome
          noteCount={noteCount}
          inboxOpen={inbox.isOpen}
          onToggleInbox={inbox.toggle}
          onNewNote={dialogs.openNewNote}
          onNewThread={() => dialogs.openCreateThread()}
          onNewArea={dialogs.openCreateArea}
          onOpenPalette={() => setPaletteOpen(true)}
          railOpen={openThreadSlug !== undefined}
        />
        {/* Inside the column, not beside it — see InboxPopoverPanel. */}
        <InboxSurface />
        {/* The chrome floats over the page, so this padding is what keeps the
            content clear of it: identity cluster above, dock below. */}
        <main className="w-full min-w-0 flex-1 px-4 pt-20 pb-24">
          {children}
        </main>
      </div>
      {openThreadSlug !== undefined && (
        <ThreadDetailView
          threadSlug={openThreadSlug}
          areaSlug={isSearchSource ? undefined : routeAreaSlug}
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
          // The palette's Area drill-in scopes the new Thread; the plain
          // "New thread" row passes nothing and the picker stays unscoped.
          onNewThread={(areaId) =>
            dialogs.openCreateThread(areaId as Id<"areas"> | undefined)
          }
          onNewArea={dialogs.openCreateArea}
          onOpenInbox={inbox.open}
        />
      )}

      {/* Also held until the gated list resolves — never an empty picker. */}
      {dialogs.showCreateThread && createThreadAreas !== undefined && (
        <CreateThreadDialog
          open
          onOpenChange={dialogs.setShowCreateThread}
          areas={createThreadAreas}
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
      {dialogs.showCreateArea && (
        <CreateAreaDialog open onOpenChange={dialogs.setShowCreateArea} />
      )}
    </div>
  );
}
