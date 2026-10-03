import type { Note, NoteId } from "@vita-os/contracts";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { act, renderHook } from "../../test/render-with-providers";
import { useStandaloneNoteActions } from "./use-standalone-note-actions";

const mocks = vi.hoisted(() => ({
  archiveNote: vi.fn(),
  unarchiveNote: vi.fn(),
  removeNote: vi.fn(),
  updateNoteBody: vi.fn(),
  updateNoteWhen: vi.fn(),
}));

vi.mock("../use-archive-note", () => ({
  useArchiveNote: () => mocks.archiveNote,
}));

vi.mock("../use-unarchive-note", () => ({
  useUnarchiveNote: () => mocks.unarchiveNote,
}));

vi.mock("../use-remove-note", () => ({
  useRemoveNote: () => mocks.removeNote,
}));

vi.mock("../use-update-note-body", () => ({
  useUpdateNoteBody: () => mocks.updateNoteBody,
}));

vi.mock("../use-update-note-when", () => ({
  useUpdateNoteWhen: () => mocks.updateNoteWhen,
}));

const openNote = {
  _id: "note1" as NoteId,
  body: "Buy milk",
  state: "open",
  createdAt: Date.now(),
} satisfies Note;

const archivedNote = {
  ...openNote,
  state: "done",
  completedAt: Date.now(),
} satisfies Note;

describe("useStandaloneNoteActions", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("returns failed saves to the caller without a second error toast", async () => {
    mocks.updateNoteBody.mockRejectedValue(new Error("Could not save note"));
    const { result, feedback } = renderHook(() =>
      useStandaloneNoteActions(openNote),
    );
    await act(async () => {
      await expect(result.current.saveBody("Changed")).rejects.toThrow(
        "Could not save note",
      );
    });
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("archives an Open Note", async () => {
    const { result } = renderHook(() => useStandaloneNoteActions(openNote));

    await act(() => result.current.toggleArchived());

    expect(mocks.archiveNote).toHaveBeenCalledExactlyOnceWith("note1");
    expect(mocks.unarchiveNote).not.toHaveBeenCalled();
  });

  it("unarchives an Archived Note with the whole record", async () => {
    const { result } = renderHook(() => useStandaloneNoteActions(archivedNote));

    await act(() => result.current.toggleArchived());

    expect(mocks.unarchiveNote).toHaveBeenCalledExactlyOnceWith(archivedNote);
    expect(mocks.archiveNote).not.toHaveBeenCalled();
  });
});
