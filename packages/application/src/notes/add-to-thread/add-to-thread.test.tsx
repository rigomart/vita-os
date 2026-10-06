import type {
  Note,
  NoteAddedToThread,
  NoteId,
  OperationResult,
  TaskId,
  Thread,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

import { useRouterState } from "@tanstack/react-router";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FeedbackMock } from "../../test/render-with-providers";

import { DashboardOverview } from "../../dashboard/components/dashboard-overview";
import { queryKeys } from "../../query-keys";
import {
  createQuietApplicationClient,
  deferred,
  failure,
  success,
} from "../../test/fake-application-client";
import { aThread, aThreadNote } from "../../test/fixtures";
import {
  act,
  createTestQueryClient,
  render,
  screen,
  waitFor,
  within,
} from "../../test/render-with-providers";
import { useOpenThreads } from "../../threads/hooks";
import { useOpenNotes } from "../hooks";
import { NoteDialog } from "../note-view/note-dialog";

const currentDate = new Date(2026, 6, 17, 12).getTime();
const jul23 = new Date(2026, 6, 23, 15, 0).getTime();
const aug1 = new Date(2026, 7, 1).getTime();
const note: Note = {
  _id: "dated-note" as NoteId,
  body: "# Dentist\nCall on Monday",
  followUp: jul23,
  state: "open",
  createdAt: 1_000,
  updatedAt: 2_000,
};
const undatedThread = aThread({
  _id: "undated" as Thread["_id"],
  title: "Teeth",
  areaId: undefined,
});
const laterThread = aThread({
  _id: "later" as Thread["_id"],
  title: "Insurance",
  slug: "insurance-1",
  tasks: [{ _id: "renew" as TaskId, text: "Renew policy", date: aug1 }],
  areaId: undefined,
  order: 1,
});
const earlierThread = aThread({
  _id: "earlier" as Thread["_id"],
  title: "Clinic",
  slug: "clinic-1",
  tasks: [
    {
      _id: "confirm" as TaskId,
      text: "Confirm the visit",
      date: new Date(2026, 6, 20).getTime(),
    },
  ],
  areaId: undefined,
  order: 2,
});
const existingThreadNote = aThreadNote({ createdAt: 500, updatedAt: 500 });

function Location() {
  const thread = useRouterState({
    select: (state) =>
      (state.location.search as Record<string, unknown>).thread,
  });
  return <output aria-label="Open thread">{String(thread ?? "")}</output>;
}

function Dashboard() {
  const notes = useOpenNotes();
  const threads = useOpenThreads();
  return (
    <>
      <DashboardOverview
        areas={[]}
        threads={threads.data ?? []}
        notes={notes.data ?? []}
        currentDate={currentDate}
      />
      <Location />
    </>
  );
}

/** What the fake service holds; a committed command updates it. */
const server = { notes: [note], threads: [] as Thread[] };

function commit(added: NoteAddedToThread) {
  server.notes = [];
  server.threads = [
    ...server.threads.filter((thread) => thread._id !== added.thread._id),
    added.thread,
  ];
  return success(added);
}

function setup(
  overrides: Parameters<typeof createQuietApplicationClient>[0] = {},
  undoable: FeedbackMock["undoable"] = vi.fn(async () => true),
) {
  const queryClient = createTestQueryClient();
  const threads = [undatedThread, laterThread, earlierThread];
  server.notes = [note];
  server.threads = threads;
  queryClient.setQueryData(queryKeys.notes.open(), [note]);
  queryClient.setQueryData(queryKeys.threads.open(), threads);
  queryClient.setQueryData(queryKeys.threadNotes.open(undatedThread._id), [
    existingThreadNote,
  ]);
  const applicationClient = createQuietApplicationClient({
    listOpenNotes: async () => success(server.notes),
    listOpenThreads: async () => success(server.threads),
    ...overrides,
  });
  const feedback = { success: vi.fn(), error: vi.fn(), undoable };
  render(<Dashboard />, { applicationClient, queryClient, feedback });
  return { queryClient, feedback };
}

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^Open note: Dentist/ }));
  await user.click(screen.getByRole("button", { name: "More actions" }));
  return user;
}

async function chooseThread(title: string) {
  const user = await openMenu();
  await user.click(
    await screen.findByRole("menuitem", { name: "Add to thread…" }),
  );
  const picker = await screen.findByRole("dialog", { name: "Add to thread" });
  await user.click(
    within(picker).getByRole("option", { name: new RegExp(title) }),
  );
}

function addedTo(thread: Thread, revision = thread.revision + 1) {
  return {
    thread: {
      ...thread,
      tasks: [
        ...(thread.tasks ?? []),
        { _id: "from-note-task" as TaskId, text: "Dentist", date: jul23 },
      ],
      lastActivityAt: 9_000,
      revision,
    },
    threadNote: aThreadNote({
      _id: "from-note" as ThreadNoteId,
      body: note.body,
      createdAt: note.createdAt,
      updatedAt: 2_000,
    }),
  } satisfies NoteAddedToThread;
}

describe("the Note view's add actions", () => {
  it("offers them only on an Open Standalone Note", async () => {
    const user = userEvent.setup();
    const actions = { onAddToThread: vi.fn(), onNewThread: vi.fn() };
    const { unmount } = render(
      <NoteDialog open onOpenChange={vi.fn()} note={note} {...actions} />,
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      await screen.findByRole("menuitem", { name: "Add to thread…" }),
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "New thread from note" }),
    ).toBeVisible();
    unmount();

    render(
      <NoteDialog
        open
        onOpenChange={vi.fn()}
        note={{ ...note, state: "done", completedAt: 5_000 }}
        {...actions}
      />,
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await screen.findByRole("menuitem", { name: "Copy Markdown" });
    expect(
      screen.queryByRole("menuitem", { name: "Add to thread…" }),
    ).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: "New thread from note" }),
    ).toBeNull();
  });
});

describe("adding a Note to a Thread", () => {
  it("tells which Threads the Note would bring back earlier", async () => {
    setup();
    const user = await openMenu();
    await user.click(
      await screen.findByRole("menuitem", { name: "Add to thread…" }),
    );
    const picker = await screen.findByRole("dialog", { name: "Add to thread" });

    const options = within(picker).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "TeethBrings this thread back Thu Jul 23 · 3 PM",
      "InsuranceBrings this thread back Thu Jul 23 · 3 PM",
      "Clinic",
    ]);
  });

  it("takes the Note out of Notes and shows it on the Thread at once, then commits", async () => {
    const pending = deferred<OperationResult<NoteAddedToThread>>();
    const addNoteToThread = vi.fn(() => pending.promise);
    const { queryClient, feedback } = setup({ addNoteToThread });

    await chooseThread("Teeth");

    expect(
      screen.queryByRole("button", { name: /^Open note: Dentist/ }),
    ).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(queryClient.getQueryData(queryKeys.notes.open())).toEqual([]);
    const shown = queryClient
      .getQueryData<Thread[]>(queryKeys.threads.open())
      ?.find((thread) => thread._id === undatedThread._id);
    expect(shown?.tasks).toEqual([
      { _id: expect.any(String), text: "Dentist", date: jul23 },
    ]);
    expect(shown).not.toHaveProperty("lastActivityContent");
    expect(
      queryClient
        .getQueryData<ThreadNote[]>(
          queryKeys.threadNotes.open(undatedThread._id),
        )
        ?.map((threadNote) => [threadNote.body, threadNote.createdAt]),
    ).toEqual([
      [note.body, note.createdAt],
      [existingThreadNote.body, existingThreadNote.createdAt],
    ]);
    expect(feedback.undoable).toHaveBeenCalledWith("Note added to thread", {
      action: { label: "Open thread", onClick: expect.any(Function) },
    });

    await waitFor(() =>
      expect(addNoteToThread).toHaveBeenCalledExactlyOnceWith({
        noteId: note._id,
        threadId: undatedThread._id,
      }),
    );
    await act(async () => pending.resolve(commit(addedTo(undatedThread))));
    await waitFor(() =>
      expect(
        queryClient
          .getQueryData<Thread[]>(queryKeys.threads.open())
          ?.find((thread) => thread._id === undatedThread._id)?.revision,
      ).toBe(1),
    );
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("restores the Note and the Thread on Undo without reaching the service", async () => {
    const offer = deferred<boolean>();
    const addNoteToThread = vi.fn();
    const { queryClient } = setup({ addNoteToThread }, () => offer.promise);

    await chooseThread("Insurance");
    expect(
      queryClient
        .getQueryData<Thread[]>(queryKeys.threads.open())
        ?.find((thread) => thread._id === laterThread._id)
        ?.tasks?.map((task) => task.text),
    ).toEqual(["Renew policy", "Dentist"]);
    await act(async () => offer.resolve(false));

    expect(
      await screen.findByRole("button", { name: /^Open note: Dentist/ }),
    ).toBeVisible();
    expect(
      queryClient
        .getQueryData<Thread[]>(queryKeys.threads.open())
        ?.find((thread) => thread._id === laterThread._id),
    ).toEqual(laterThread);
    expect(queryClient.getQueryData(queryKeys.notes.open())).toEqual([note]);
    expect(addNoteToThread).not.toHaveBeenCalled();
  });

  it("opens the Thread from the toast", async () => {
    const undoable = vi.fn(
      async (
        _message: string,
        options?: { action?: { onClick: () => void } },
      ) => {
        options?.action?.onClick();
        return true;
      },
    );
    setup(
      { addNoteToThread: async () => commit(addedTo(earlierThread)) },
      undoable,
    );

    await chooseThread("Clinic");

    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Open thread" }),
      ).toHaveTextContent("clinic-1"),
    );
  });

  it("brings the Note back with an error when the service refuses", async () => {
    const { feedback } = setup({
      addNoteToThread: async () =>
        failure({
          code: "not_found",
          message: "Thread not found.",
          retryable: false,
        }),
    });

    await chooseThread("Clinic");

    await waitFor(() =>
      expect(feedback.error).toHaveBeenCalledWith(
        "The note was not added to the thread. Please try again.",
      ),
    );
    expect(
      await screen.findByRole("button", { name: /^Open note: Dentist/ }),
    ).toBeVisible();
  });
});

describe("starting a Thread from a Note", () => {
  it("suggests a title, creates the Thread with the Note, and opens its pane", async () => {
    const created = {
      thread: aThread({
        _id: "new-thread" as Thread["_id"],
        title: "Dentist visit",
        slug: "dentist-visit-1",
        areaId: undefined,
        tasks: [
          { _id: "from-note-task" as TaskId, text: "Dentist", date: jul23 },
        ],
        revision: 1,
      }),
      threadNote: aThreadNote({ _id: "from-note" as ThreadNoteId }),
    };
    const createThreadFromNote = vi.fn(async () => commit(created));
    const { queryClient } = setup({ createThreadFromNote });
    const user = await openMenu();
    await user.click(
      await screen.findByRole("menuitem", { name: "New thread from note" }),
    );

    const title = await screen.findByRole("textbox", { name: "Thread title" });
    expect(title).toHaveValue("Dentist");
    await user.clear(title);
    await user.type(title, "Dentist visit");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(createThreadFromNote).toHaveBeenCalledExactlyOnceWith({
        noteId: note._id,
        title: "Dentist visit",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Open thread" }),
      ).toHaveTextContent("dentist-visit-1"),
    );
    expect(
      screen.queryByRole("button", { name: /^Open note: Dentist/ }),
    ).toBeNull();
    expect(
      queryClient.getQueryData(queryKeys.threadNotes.open(created.thread._id)),
    ).toEqual([created.threadNote]);
  });
});
