import type { Note, NoteId } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

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
  it("keeps its Note view open through completion and can reopen it from the empty Dashboard", async () => {
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
        name: "Done",
        exact: true,
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
    await user.click(await screen.findByRole("button", { name: "Reopen" }));
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Done",
          exact: true,
        }),
      ).toBeVisible(),
    );
    await user.keyboard("{Escape}");
    expect(
      await screen.findByRole("button", { name: "Open note: Last thought" }),
    ).toBeVisible();
    expect(screen.queryByText("Nothing is asking for you.")).toBeNull();
  });

  it("restores its card and keeps the view open when completion fails", async () => {
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
        name: "Done",
        exact: true,
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
          message: "Could not complete note",
          retryable: false,
        }),
      );
    });
    await waitFor(() => expect(feedback.error).toHaveBeenCalledOnce());
    expect(feedback.success).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Done",
        exact: true,
      }),
    ).toBeEnabled();
    expect(screen.queryByText("Nothing is asking for you.")).toBeNull();
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: "Open note: Last thought" }),
    ).toBeVisible();
  });
});
