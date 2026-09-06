import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedNote } from "@convex/lib/validators";

import { describe, expect, it, vi, beforeEach } from "vitest";

import { act, renderHook, waitFor } from "@/test/render-with-providers";

import { useNoteRowActions } from "./use-note-row-actions";

const mocks = vi.hoisted(() => ({
  completeNote: vi.fn(),
  uncompleteNote: vi.fn(),
  removeNote: vi.fn(),
  updateNoteBody: vi.fn(),
  updateNoteWhen: vi.fn(),
}));

vi.mock("@/features/notes/use-complete-note", () => ({
  useCompleteNote: () => mocks.completeNote,
}));

vi.mock("@/features/notes/use-uncomplete-note", () => ({
  useUncompleteNote: () => mocks.uncompleteNote,
}));

vi.mock("@/features/notes/use-remove-note", () => ({
  useRemoveNote: () => mocks.removeNote,
}));

vi.mock("@/features/notes/use-update-note-body", () => ({
  useUpdateNoteBody: () => mocks.updateNoteBody,
}));

vi.mock("@/features/notes/use-update-note-when", () => ({
  useUpdateNoteWhen: () => mocks.updateNoteWhen,
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const openNote = {
  _id: "note1" as Id<"tasks">,
  _creationTime: 0,
  body: "Buy milk",
  state: "open",
  createdAt: Date.now(),
} satisfies ProjectedNote;

const doneNote = {
  ...openNote,
  state: "done",
  completedAt: Date.now(),
} satisfies ProjectedNote;

describe("useNoteRowActions", () => {
  beforeEach(() => {
    mocks.completeNote.mockReset();
    mocks.uncompleteNote.mockReset();
    mocks.removeNote.mockReset();
    mocks.updateNoteBody.mockReset();
    mocks.updateNoteWhen.mockReset();
  });

  it("ignores duplicate complete toggles while pending", async () => {
    const pendingComplete = deferred();
    mocks.completeNote.mockImplementation(() => pendingComplete.promise);

    const { result } = renderHook(() => useNoteRowActions(openNote));

    act(() => {
      result.current.handleToggleComplete();
      result.current.handleToggleComplete();
    });

    expect(mocks.completeNote).toHaveBeenCalledTimes(1);
    expect(result.current.isTogglePending).toBe(true);

    await act(async () => {
      pendingComplete.resolve();
      await pendingComplete.promise;
    });

    await waitFor(() => expect(result.current.isTogglePending).toBe(false));
    expect(mocks.completeNote).toHaveBeenCalledTimes(1);
  });

  it("ignores duplicate reopen toggles while pending", async () => {
    const pendingReopen = deferred();
    mocks.uncompleteNote.mockImplementation(() => pendingReopen.promise);

    const { result } = renderHook(() => useNoteRowActions(doneNote));

    act(() => {
      result.current.handleToggleComplete();
      result.current.handleToggleComplete();
    });

    expect(mocks.uncompleteNote).toHaveBeenCalledTimes(1);
    expect(result.current.isTogglePending).toBe(true);

    await act(async () => {
      pendingReopen.resolve();
      await pendingReopen.promise;
    });

    await waitFor(() => expect(result.current.isTogglePending).toBe(false));
    expect(mocks.uncompleteNote).toHaveBeenCalledTimes(1);
  });

  it("ignores duplicate discard actions while pending", async () => {
    const pendingRemove = deferred();
    mocks.removeNote.mockImplementation(() => pendingRemove.promise);

    const { result } = renderHook(() => useNoteRowActions(openNote));

    act(() => {
      result.current.handleRemove();
      result.current.handleRemove();
    });

    expect(mocks.removeNote).toHaveBeenCalledTimes(1);
    expect(result.current.isDeletePending).toBe(true);

    await act(async () => {
      pendingRemove.resolve();
      await pendingRemove.promise;
    });

    await waitFor(() => expect(result.current.isDeletePending).toBe(false));
    expect(mocks.removeNote).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when discard fails", async () => {
    mocks.removeNote.mockRejectedValue(new Error("Could not discard note"));

    const { result, feedback } = renderHook(() => useNoteRowActions(openNote));

    act(() => {
      result.current.handleRemove();
    });

    await waitFor(() =>
      expect(feedback.error).toHaveBeenCalledWith("Could not discard note"),
    );
  });

  it("shows a success toast when discard succeeds", async () => {
    mocks.removeNote.mockResolvedValue(undefined);

    const { result, feedback } = renderHook(() => useNoteRowActions(openNote));

    act(() => {
      result.current.handleRemove();
    });

    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Note deleted"),
    );
  });

  it("ignores duplicate body saves while pending", async () => {
    const pendingSave = deferred();
    mocks.updateNoteBody.mockImplementation(() => pendingSave.promise);

    const { result } = renderHook(() => useNoteRowActions(openNote));

    act(() => {
      void result.current.handleUpdateText("Buy oat milk");
      void result.current.handleUpdateText("Buy oat milk");
    });

    expect(mocks.updateNoteBody).toHaveBeenCalledTimes(1);
    expect(result.current.isSavingText).toBe(true);

    await act(async () => {
      pendingSave.resolve();
      await pendingSave.promise;
    });

    await waitFor(() => expect(result.current.isSavingText).toBe(false));
    expect(mocks.updateNoteBody).toHaveBeenCalledTimes(1);
  });

  it("stays quiet on successful body saves", async () => {
    mocks.updateNoteBody.mockResolvedValue(undefined);

    const { result, feedback } = renderHook(() => useNoteRowActions(openNote));

    act(() => {
      result.current.handleUpdateText("Buy oat milk");
    });

    await waitFor(() => expect(result.current.isSavingText).toBe(false));
    expect(feedback.success).not.toHaveBeenCalled();
  });

  it("ignores duplicate When updates while pending", async () => {
    const pendingWhen = deferred();
    mocks.updateNoteWhen.mockImplementation(() => pendingWhen.promise);

    const { result } = renderHook(() => useNoteRowActions(openNote));

    act(() => {
      void result.current.handleUpdateWhen(Date.now());
      void result.current.handleUpdateWhen(Date.now());
    });

    expect(mocks.updateNoteWhen).toHaveBeenCalledTimes(1);
    expect(result.current.isWhenPending).toBe(true);

    await act(async () => {
      pendingWhen.resolve();
      await pendingWhen.promise;
    });

    await waitFor(() => expect(result.current.isWhenPending).toBe(false));
    expect(mocks.updateNoteWhen).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when When update fails", async () => {
    mocks.updateNoteWhen.mockRejectedValue(new Error("Could not update When"));

    const { result, feedback } = renderHook(() => useNoteRowActions(openNote));

    act(() => {
      result.current.handleUpdateWhen(Date.now());
    });

    await waitFor(() =>
      expect(feedback.error).toHaveBeenCalledWith("Could not update When"),
    );
  });
});
