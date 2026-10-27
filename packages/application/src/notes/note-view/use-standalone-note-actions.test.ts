import type { Note, NoteId } from "@vita-os/contracts";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { act, renderHook } from "../../test/render-with-providers";
import { useStandaloneNoteActions } from "./use-standalone-note-actions";

const mocks = vi.hoisted(() => ({
  markNoteDone: vi.fn(),
  markNoteOpen: vi.fn(),
  removeNote: vi.fn(),
  updateNoteBody: vi.fn(),
  updateNoteWhen: vi.fn(),
}));

vi.mock("../use-mark-note-done", () => ({
  useMarkNoteDone: () => mocks.markNoteDone,
}));

vi.mock("../use-mark-note-open", () => ({
  useMarkNoteOpen: () => mocks.markNoteOpen,
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

const completedNote = {
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

  it("completes an Open Note", async () => {
    const { result } = renderHook(() => useStandaloneNoteActions(openNote));

    await act(() => result.current.toggleCompleted());

    expect(mocks.markNoteDone).toHaveBeenCalledExactlyOnceWith("note1");
    expect(mocks.markNoteOpen).not.toHaveBeenCalled();
  });

  it("reopens a Completed Note with the whole record", async () => {
    const { result } = renderHook(() =>
      useStandaloneNoteActions(completedNote),
    );

    await act(() => result.current.toggleCompleted());

    expect(mocks.markNoteOpen).toHaveBeenCalledExactlyOnceWith(completedNote);
    expect(mocks.markNoteDone).not.toHaveBeenCalled();
  });
});
