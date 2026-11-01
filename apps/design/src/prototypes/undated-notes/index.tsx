import type { Note } from "@vita-os/contracts";

import { Link } from "@tanstack/react-router";
import { useAreas } from "@vita-os/application/internal/areas/hooks.ts";
import {
  boardItems,
  buildAttentionBoard,
} from "@vita-os/application/internal/dashboard/components/attention-board-model.ts";
import { filterDashboard } from "@vita-os/application/internal/dashboard/components/dashboard-filter-model.ts";
import { DashboardFilter } from "@vita-os/application/internal/dashboard/components/dashboard-filter.tsx";
import { DashboardList } from "@vita-os/application/internal/dashboard/components/dashboard-list.tsx";
import { DashboardOverviewSkeleton } from "@vita-os/application/internal/dashboard/components/dashboard-overview-skeleton.tsx";
import {
  FoldedNoDate,
  NoDate,
} from "@vita-os/application/internal/dashboard/components/no-date.tsx";
import { ThreadCopies } from "@vita-os/application/internal/dashboard/components/thread-copies.tsx";
import { useDashboardCursor } from "@vita-os/application/internal/dashboard/components/use-dashboard-cursor.ts";
import { DashboardScreen } from "@vita-os/application/internal/dashboard/screens/dashboard-screen.tsx";
import { useAttentionClock } from "@vita-os/application/internal/hooks/use-attention-clock.ts";
import {
  NOTES_FILTER,
  withDashboardFilter,
} from "@vita-os/application/internal/navigation/search-params.ts";
import { useDashboardFilterParams } from "@vita-os/application/internal/navigation/use-dashboard-filter-params.ts";
import { useOpenNotes } from "@vita-os/application/internal/notes/hooks.ts";
import { NoteMarker } from "@vita-os/application/internal/notes/note-marker.tsx";
import { StandaloneNoteDialog } from "@vita-os/application/internal/notes/note-view/standalone-note-dialog.tsx";
import { useOpenThreads } from "@vita-os/application/internal/threads/hooks.ts";
import { markdownToPlainText } from "@vita-os/ui/components/markdown";
import { ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

import { definePrototype } from "@/lab/prototype";

/**
 * A date puts a Standalone Note on the board: All shows only dated Notes, and
 * the Notes filter is where undated ones are read. The variants differ in how
 * All admits undated Notes exist and how the Notes filter lays them out.
 */
export default definePrototype({
  title: "Undated notes off the board",
  description:
    "Only dated Notes stand on All; undated Notes are read under the Notes filter.",
  shell: true,
  variants: [
    {
      key: "current",
      name: "Current",
      description: "As it ships: every open Note is on All.",
      component: DashboardScreen,
    },
    {
      key: "off-all",
      name: "Off All",
      description:
        "All shows only dated Notes. The Notes filter is unchanged: dated Notes in the list, undated ones in No date.",
      component: () => <Overview mode="off-all" />,
    },
    {
      key: "shelf",
      name: "Notes shelf",
      description:
        "As Off All, but the Notes filter lays undated Notes out as readable cards under the list, not one-line rows in the side column.",
      component: () => <Overview mode="shelf" />,
    },
    {
      key: "summary-line",
      name: "One line on All",
      description:
        "All keeps one line in No date, '8 undated notes', that opens the Notes filter.",
      component: () => <Overview mode="summary-line" />,
    },
  ],
});

type Mode = "off-all" | "shelf" | "summary-line";

const isDated = (note: Note) => note.followUp != null;

function Overview({ mode }: { mode: Mode }) {
  const currentDate = useAttentionClock();
  const params = useDashboardFilterParams();
  const areas = useAreas().data;
  const threads = useOpenThreads().data;
  const notes = useOpenNotes().data;
  const [openNote, setOpenNote] = useState<Note | null>(null);
  const [laterOpen, setLaterOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useDashboardCursor(root);

  if (areas === undefined || threads === undefined || notes === undefined) {
    return <DashboardOverviewSkeleton />;
  }

  const filtered = filterDashboard({ threads, notes, areas, params });
  const kind = filtered.filter.kind;
  const undated = notes.filter((note) => !isDated(note));
  const shelf = mode === "shelf" && kind === "notes";
  // The rule: All shows a Note only once it has a date. The Notes filter
  // still shows every open Note, unless the shelf draws the undated ones.
  const boardNotes =
    kind === "all" || shelf ? filtered.notes.filter(isDated) : filtered.notes;
  const options = filtered.options.map((option) =>
    option.key === "all"
      ? { ...option, count: threads.length + notes.filter(isDated).length }
      : option,
  );
  const board = buildAttentionBoard(filtered.threads, boardNotes, currentDate);
  const empty = boardItems(board).length === 0;
  const showSummary =
    mode === "summary-line" && kind === "all" && undated.length > 0;
  const scope = {
    areaById: new Map(areas.map((area) => [area._id, area])),
    currentDate,
    onOpenNote: setOpenNote,
  };

  return (
    <div
      ref={root}
      className="mx-auto grid max-w-[76rem] gap-x-12 px-4 outline-none sm:px-6 lg:min-h-full lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div className="min-w-0 lg:pb-16">
        <h1 className="sr-only">Dashboard</h1>
        <div className="sticky top-0 z-20 -mx-4 bg-surface-1/90 px-4 pt-5 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-3 lg:px-3">
          <DashboardFilter options={options} />
        </div>

        {showSummary && (
          <div className="pb-3 lg:hidden">
            <UndatedLine count={undated.length} />
          </div>
        )}

        {empty && !(shelf && undated.length > 0) ? (
          <section className="mt-2 flex min-h-48 flex-col items-center justify-center rounded-2xl bg-surface-2 px-6 text-center">
            <p className="text-sm font-medium">
              {kind === "notes"
                ? "No Note is asking for you."
                : "Nothing is asking for you."}
            </p>
            {kind === "all" && (
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {undated.length > 0 ? (
                  <>
                    Undated notes are under{" "}
                    <Link
                      to="/"
                      search={withDashboardFilter({ show: NOTES_FILTER })}
                      className="underline underline-offset-2"
                    >
                      Notes
                    </Link>
                    .
                  </>
                ) : (
                  "Every Thread is resolved and every Note is completed."
                )}
              </p>
            )}
          </section>
        ) : (
          <ThreadCopies>
            <FoldedNoDate board={board} scope={scope} />
            {!(shelf && empty) && (
              <DashboardList
                board={board}
                laterOpen={laterOpen}
                scope={scope}
                onLaterOpenChange={setLaterOpen}
              />
            )}
          </ThreadCopies>
        )}

        {shelf && <Shelf notes={undated} onOpen={setOpenNote} />}
      </div>

      {!empty && !shelf && (
        <aside
          aria-label="No date"
          className="hidden min-w-0 pt-6 pb-24 [scrollbar-width:thin] lg:sticky lg:top-0 lg:-mr-3 lg:block lg:max-h-svh lg:overflow-y-auto lg:border-l lg:pr-3 lg:pl-8 lg:[contain:size]"
        >
          <NoDate board={board} scope={scope} />
          {showSummary && (
            <section aria-label="Notes" className="pt-4">
              <h3 className="px-1 pb-0.5 text-[13px] font-semibold text-muted-foreground">
                Notes
              </h3>
              <UndatedLine count={undated.length} />
            </section>
          )}
        </aside>
      )}

      {openNote && (
        <StandaloneNoteDialog
          key={openNote._id}
          note={openNote}
          onOpenChange={(open) => {
            if (!open) setOpenNote(null);
          }}
        />
      )}
    </div>
  );
}

function UndatedLine({ count }: { count: number }) {
  return (
    <Link
      to="/"
      search={withDashboardFilter({ show: NOTES_FILTER })}
      className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-[15px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
    >
      <NoteMarker />
      <span className="min-w-0 flex-1 truncate">
        {count} undated {count === 1 ? "note" : "notes"}
      </span>
      <ChevronRight aria-hidden className="size-4" />
    </Link>
  );
}

/** Undated Notes as cards to read, newest first, under the dated list. */
function Shelf({
  notes,
  onOpen,
}: {
  notes: Note[];
  onOpen: (note: Note) => void;
}) {
  if (notes.length === 0) return null;
  const newestFirst = [...notes].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <section aria-label="No date" className="pt-8">
      <h2 className="flex items-baseline gap-2 border-b pb-2">
        <span className="font-heading text-xl font-semibold tracking-tight">
          No date
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {notes.length}
        </span>
      </h2>
      <ul className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-3">
        {newestFirst.map((note) => (
          <li key={note._id}>
            <button
              type="button"
              onClick={() => onOpen(note)}
              className="flex h-full w-full flex-col gap-2 rounded-xl bg-surface-2 p-4 text-left ring-1 ring-border/60 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <span className="line-clamp-5 text-sm whitespace-pre-line">
                {markdownToPlainText(note.body).trim()}
              </span>
              <span className="mt-auto text-xs text-muted-foreground">
                {new Date(note.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
