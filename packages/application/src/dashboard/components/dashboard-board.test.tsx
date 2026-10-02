import type { Note, NoteId } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createQuietApplicationClient,
  success,
} from "../../test/fake-application-client";
import {
  render,
  screen,
  waitFor,
  within,
} from "../../test/render-with-providers";
import { buildAttentionBoard } from "./attention-board-model";
import { DashboardBoard } from "./dashboard-board";

const currentDate = new Date(2026, 6, 17, 12).getTime();
const saved: Note = {
  _id: "note1" as NoteId,
  body: "# Consultation\n[Clinic](https://example.com)",
  state: "open",
  createdAt: currentDate,
};

describe("DashboardBoard Note view", () => {
  it("keeps the Note view open when completion removes its board card", async () => {
    const user = userEvent.setup();
    const markNoteDone = vi.fn(async () => {
      rerender(
        <DashboardBoard
          areas={[]}
          board={buildAttentionBoard([], [], currentDate)}
          currentDate={currentDate}
        />,
      );
      return success<Note>({
        ...saved,
        state: "done",
        completedAt: currentDate,
      });
    });
    const applicationClient = createQuietApplicationClient({ markNoteDone });
    const { rerender } = render(
      <DashboardBoard
        areas={[]}
        board={buildAttentionBoard([], [saved], currentDate)}
        currentDate={currentDate}
      />,
      { applicationClient },
    );
    await user.click(
      screen.getByRole("button", { name: /Open note: Consultation/ }),
    );
    expect(screen.getByRole("link", { name: "Clinic" })).toBeVisible();
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Mark done",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reopen" })).toBeVisible(),
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(markNoteDone).toHaveBeenCalledExactlyOnceWith({ noteId: "note1" });
  });

  it("keeps the Note view open when an Attention Date moves its card to another lane", async () => {
    const user = userEvent.setup();
    const nextDate = new Date(2026, 6, 18).getTime();
    const datedNote = {
      ...saved,
      attentionDate: new Date(2026, 6, 17).getTime(),
    };
    const updateNoteAttentionDate = vi.fn(async () => {
      const updated = { ...saved, attentionDate: nextDate };
      rerender(
        <DashboardBoard
          areas={[]}
          board={buildAttentionBoard([], [updated], currentDate)}
          currentDate={currentDate}
        />,
      );
      return success(updated);
    });
    const applicationClient = createQuietApplicationClient({
      updateNoteAttentionDate,
    });
    const { rerender } = render(
      <DashboardBoard
        areas={[]}
        board={buildAttentionBoard([], [datedNote], currentDate)}
        currentDate={currentDate}
      />,
      { applicationClient },
    );
    await user.click(
      screen.getByRole("button", { name: /Open note: Consultation/ }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Change attention date",
      }),
    );
    await user.click(screen.getByRole("button", { name: /July 18/i }));
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Change attention date",
        }),
      ).toBeVisible(),
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(updateNoteAttentionDate).toHaveBeenCalledExactlyOnceWith({
      noteId: "note1",
      attentionDate: nextDate,
    });
  });
});
