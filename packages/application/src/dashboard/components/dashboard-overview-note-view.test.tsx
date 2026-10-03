import type { Note, NoteId } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useOpenNotes } from "../../notes/hooks";
import { queryKeys } from "../../query-keys";
import {
  createQuietApplicationClient,
  deferred,
  failure,
  success,
} from "../../test/fake-application-client";
import {
  act,
  createTestQueryClient,
  render,
  screen,
  waitFor,
  within,
} from "../../test/render-with-providers";
import { DashboardOverview } from "./dashboard-overview";

const currentDate = new Date(2026, 6, 17, 12).getTime();
const saved: Note = {
  _id: "last-note" as NoteId,
  body: "Last thought",
  state: "open",
  createdAt: currentDate,
};

function Dashboard() {
  const notes = useOpenNotes();
  return (
    <DashboardOverview
      areas={[]}
      threads={[]}
      notes={notes.data ?? []}
      currentDate={currentDate}
    />
  );
}

describe("the last Dashboard Note", () => {
  it("keeps its Note view open through archiving and can unarchive it from the empty Dashboard", async () => {
    const user = userEvent.setup();
    const pending = deferred<ReturnType<typeof success<Note>>>();
    let serverNotes = [saved];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.notes.open(), [saved]);
    const applicationClient = createQuietApplicationClient({
      listOpenNotes: async () => success(serverNotes),
      markNoteDone: async ({ noteId }) => {
        expect(noteId).toBe("last-note");
        return pending.promise;
      },
      markNoteOpen: async ({ noteId }) => {
        expect(noteId).toBe("last-note");
        serverNotes = [saved];
        return success(saved);
      },
    });
    render(<Dashboard />, { applicationClient, queryClient });
    await user.click(
      screen.getByRole("button", { name: "Open note: Last thought" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Archive",
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Nothing is asking for you."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    await act(async () => {
      serverNotes = [];
      pending.resolve(
        success({ ...saved, state: "done", completedAt: currentDate }),
      );
    });
    await user.click(await screen.findByRole("button", { name: "Unarchive" }));
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Archive",
        }),
      ).toBeVisible(),
    );
    await user.keyboard("{Escape}");
    expect(
      await screen.findByRole("button", { name: "Open note: Last thought" }),
    ).toBeVisible();
    expect(screen.queryByText("Nothing is asking for you.")).toBeNull();
  });

  it("restores its card and keeps the view open when archiving fails", async () => {
    const user = userEvent.setup();
    const pending = deferred<ReturnType<typeof failure<Note>>>();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.notes.open(), [saved]);
    const applicationClient = createQuietApplicationClient({
      listOpenNotes: async () => success([saved]),
      markNoteDone: async () => pending.promise,
    });
    const { feedback } = render(<Dashboard />, {
      applicationClient,
      queryClient,
    });
    await user.click(
      screen.getByRole("button", { name: "Open note: Last thought" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Archive",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByText("Nothing is asking for you."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    await act(async () => {
      pending.resolve(
        failure({
          code: "unexpected",
          message: "Could not archive note",
          retryable: false,
        }),
      );
    });
    await waitFor(() => expect(feedback.error).toHaveBeenCalledOnce());
    expect(feedback.success).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Archive",
      }),
    ).toBeEnabled();
    expect(screen.queryByText("Nothing is asking for you.")).toBeNull();
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: "Open note: Last thought" }),
    ).toBeVisible();
  });
});

describe("deleting a Dashboard Note", () => {
  async function deleteFromView(undoable: () => Promise<boolean>) {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.notes.open(), [saved]);
    const removeNote = vi.fn(async () =>
      success({ acknowledged: true as const }),
    );
    const feedback = {
      success: vi.fn(),
      error: vi.fn(),
      undoable: vi.fn(undoable),
    };
    const applicationClient = createQuietApplicationClient({
      listOpenNotes: async () => success([saved]),
      removeNote,
    });
    render(<Dashboard />, { applicationClient, queryClient, feedback });
    await user.click(
      screen.getByRole("button", { name: "Open note: Last thought" }),
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Delete note" }),
    );
    return { feedback, removeNote };
  }

  it("hides the Note at once and restores it on Undo without reaching the service", async () => {
    const offer = deferred<boolean>();
    const { feedback, removeNote } = await deleteFromView(() => offer.promise);
    await waitFor(() =>
      expect(feedback.undoable).toHaveBeenCalledWith("Note deleted"),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open note: Last thought" }),
    ).toBeNull();
    await act(async () => offer.resolve(false));
    expect(
      await screen.findByRole("button", { name: "Open note: Last thought" }),
    ).toBeVisible();
    expect(removeNote).not.toHaveBeenCalled();
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("deletes the Note once the Undo offer lapses", async () => {
    const offer = deferred<boolean>();
    const { feedback, removeNote } = await deleteFromView(() => offer.promise);
    await waitFor(() => expect(feedback.undoable).toHaveBeenCalledOnce());
    expect(removeNote).not.toHaveBeenCalled();
    await act(async () => offer.resolve(true));
    await waitFor(() =>
      expect(removeNote).toHaveBeenCalledExactlyOnceWith({
        noteId: "last-note",
      }),
    );
    expect(feedback.error).not.toHaveBeenCalled();
  });
});
