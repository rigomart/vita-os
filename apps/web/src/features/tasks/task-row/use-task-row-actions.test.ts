import type { Doc, Id } from "@convex/_generated/dataModel";

import { describe, expect, it, vi, beforeEach } from "vitest";

import { act, renderHook, waitFor } from "@/test/render-with-providers";

import { useTaskRowActions } from "./use-task-row-actions";

const mocks = vi.hoisted(() => ({
  completeTask: vi.fn(),
  uncompleteTask: vi.fn(),
  removeTask: vi.fn(),
  updateTaskText: vi.fn(),
  updateTaskWhen: vi.fn(),
}));

vi.mock("@/features/tasks/use-complete-task", () => ({
  useCompleteTask: () => mocks.completeTask,
}));

vi.mock("@/features/tasks/use-uncomplete-task", () => ({
  useUncompleteTask: () => mocks.uncompleteTask,
}));

vi.mock("@/features/tasks/use-remove-task", () => ({
  useRemoveTask: () => mocks.removeTask,
}));

vi.mock("@/features/tasks/use-update-task-text", () => ({
  useUpdateTaskText: () => mocks.updateTaskText,
}));

vi.mock("@/features/tasks/use-update-task-when", () => ({
  useUpdateTaskWhen: () => mocks.updateTaskWhen,
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const openTask = {
  _id: "task1" as Id<"tasks">,
  _creationTime: 0,
  userId: "user1",
  text: "Buy milk",
  state: "open",
  createdAt: Date.now(),
} satisfies Doc<"tasks">;

const doneTask = {
  ...openTask,
  state: "done",
  completedAt: Date.now(),
} satisfies Doc<"tasks">;

describe("useTaskRowActions", () => {
  beforeEach(() => {
    mocks.completeTask.mockReset();
    mocks.uncompleteTask.mockReset();
    mocks.removeTask.mockReset();
    mocks.updateTaskText.mockReset();
    mocks.updateTaskWhen.mockReset();
  });

  it("ignores duplicate complete toggles while pending", async () => {
    const pendingComplete = deferred();
    mocks.completeTask.mockImplementation(() => pendingComplete.promise);

    const { result } = renderHook(() => useTaskRowActions(openTask));

    act(() => {
      result.current.handleToggleComplete();
      result.current.handleToggleComplete();
    });

    expect(mocks.completeTask).toHaveBeenCalledTimes(1);
    expect(result.current.isTogglePending).toBe(true);

    await act(async () => {
      pendingComplete.resolve();
      await pendingComplete.promise;
    });

    await waitFor(() => expect(result.current.isTogglePending).toBe(false));
    expect(mocks.completeTask).toHaveBeenCalledTimes(1);
  });

  it("ignores duplicate reopen toggles while pending", async () => {
    const pendingReopen = deferred();
    mocks.uncompleteTask.mockImplementation(() => pendingReopen.promise);

    const { result } = renderHook(() => useTaskRowActions(doneTask));

    act(() => {
      result.current.handleToggleComplete();
      result.current.handleToggleComplete();
    });

    expect(mocks.uncompleteTask).toHaveBeenCalledTimes(1);
    expect(result.current.isTogglePending).toBe(true);

    await act(async () => {
      pendingReopen.resolve();
      await pendingReopen.promise;
    });

    await waitFor(() => expect(result.current.isTogglePending).toBe(false));
    expect(mocks.uncompleteTask).toHaveBeenCalledTimes(1);
  });

  it("ignores duplicate discard actions while pending", async () => {
    const pendingRemove = deferred();
    mocks.removeTask.mockImplementation(() => pendingRemove.promise);

    const { result } = renderHook(() => useTaskRowActions(openTask));

    act(() => {
      result.current.handleRemove();
      result.current.handleRemove();
    });

    expect(mocks.removeTask).toHaveBeenCalledTimes(1);
    expect(result.current.isDiscardPending).toBe(true);

    await act(async () => {
      pendingRemove.resolve();
      await pendingRemove.promise;
    });

    await waitFor(() => expect(result.current.isDiscardPending).toBe(false));
    expect(mocks.removeTask).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when discard fails", async () => {
    mocks.removeTask.mockRejectedValue(new Error("Could not discard task"));

    const { result, feedback } = renderHook(() => useTaskRowActions(openTask));

    act(() => {
      result.current.handleRemove();
    });

    await waitFor(() =>
      expect(feedback.error).toHaveBeenCalledWith("Could not discard task"),
    );
  });

  it("shows a success toast when discard succeeds", async () => {
    mocks.removeTask.mockResolvedValue(undefined);

    const { result, feedback } = renderHook(() => useTaskRowActions(openTask));

    act(() => {
      result.current.handleRemove();
    });

    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Task discarded"),
    );
  });

  it("ignores duplicate text saves while pending", async () => {
    const pendingSave = deferred();
    mocks.updateTaskText.mockImplementation(() => pendingSave.promise);

    const { result } = renderHook(() => useTaskRowActions(openTask));

    act(() => {
      void result.current.handleUpdateText("Buy oat milk");
      void result.current.handleUpdateText("Buy oat milk");
    });

    expect(mocks.updateTaskText).toHaveBeenCalledTimes(1);
    expect(result.current.isSavingText).toBe(true);

    await act(async () => {
      pendingSave.resolve();
      await pendingSave.promise;
    });

    await waitFor(() => expect(result.current.isSavingText).toBe(false));
    expect(mocks.updateTaskText).toHaveBeenCalledTimes(1);
  });

  it("stays quiet on successful text saves", async () => {
    mocks.updateTaskText.mockResolvedValue(undefined);

    const { result, feedback } = renderHook(() => useTaskRowActions(openTask));

    act(() => {
      result.current.handleUpdateText("Buy oat milk");
    });

    await waitFor(() => expect(result.current.isSavingText).toBe(false));
    expect(feedback.success).not.toHaveBeenCalled();
  });

  it("ignores duplicate When updates while pending", async () => {
    const pendingWhen = deferred();
    mocks.updateTaskWhen.mockImplementation(() => pendingWhen.promise);

    const { result } = renderHook(() => useTaskRowActions(openTask));

    act(() => {
      void result.current.handleUpdateWhen(Date.now());
      void result.current.handleUpdateWhen(Date.now());
    });

    expect(mocks.updateTaskWhen).toHaveBeenCalledTimes(1);
    expect(result.current.isWhenPending).toBe(true);

    await act(async () => {
      pendingWhen.resolve();
      await pendingWhen.promise;
    });

    await waitFor(() => expect(result.current.isWhenPending).toBe(false));
    expect(mocks.updateTaskWhen).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when When update fails", async () => {
    mocks.updateTaskWhen.mockRejectedValue(new Error("Could not update When"));

    const { result, feedback } = renderHook(() => useTaskRowActions(openTask));

    act(() => {
      result.current.handleUpdateWhen(Date.now());
    });

    await waitFor(() =>
      expect(feedback.error).toHaveBeenCalledWith("Could not update When"),
    );
  });
});
