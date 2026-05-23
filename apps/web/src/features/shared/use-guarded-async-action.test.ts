import { act, waitFor } from "@testing-library/react";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createFeedbackMock,
  type FeedbackMock,
  renderHookWithProviders,
} from "@/test/render-with-providers";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("useGuardedAsyncAction", () => {
  let feedback: FeedbackMock;

  beforeEach(() => {
    feedback = createFeedbackMock();
  });

  it("ignores duplicate runs while the action is pending", async () => {
    const pending = deferred<void>();
    const action = vi.fn(() => pending.promise);

    const { result } = renderHookWithProviders(
      () => useGuardedAsyncAction(action),
      { feedback },
    );

    let first!: ReturnType<typeof result.current.run>;
    let second!: ReturnType<typeof result.current.run>;
    act(() => {
      first = result.current.run();
      second = result.current.run();
    });

    expect(action).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(result.current.isPending).toBe(true));

    await act(async () => {
      pending.resolve(undefined);
      await Promise.all([first, second]);
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("shows a structural success toast when configured", async () => {
    const action = vi.fn(async () => "done");

    const { result } = renderHookWithProviders(
      () => useGuardedAsyncAction(action, { successMessage: "Task added" }),
      { feedback },
    );

    let outcome!: Awaited<ReturnType<typeof result.current.run>>;
    await act(async () => {
      outcome = await result.current.run();
    });

    expect(outcome).toEqual({ ok: true, value: "done" });
    expect(feedback.success).toHaveBeenCalledWith("Task added");
  });

  it("stays quiet on success when no success message is configured", async () => {
    const action = vi.fn(async () => "done");

    const { result } = renderHookWithProviders(
      () => useGuardedAsyncAction(action),
      { feedback },
    );

    await act(async () => {
      await result.current.run();
    });

    expect(feedback.success).not.toHaveBeenCalled();
  });

  it("shows an error toast by default when the action fails", async () => {
    const action = vi.fn(() => Promise.reject(new Error("Save failed")));

    const { result } = renderHookWithProviders(
      () => useGuardedAsyncAction(action),
      { feedback },
    );

    let outcome!: Awaited<ReturnType<typeof result.current.run>>;
    await act(async () => {
      outcome = await result.current.run();
    });

    expect(outcome).toEqual({
      ok: false,
      skipped: false,
      error: "Save failed",
    });
    expect(result.current.error).toBe("Save failed");
    expect(feedback.error).toHaveBeenCalledWith("Save failed");
  });

  it("suppresses the error toast when errorToast is false", async () => {
    const action = vi.fn(() => Promise.reject(new Error("Save failed")));

    const { result } = renderHookWithProviders(
      () => useGuardedAsyncAction(action, { errorToast: false }),
      { feedback },
    );

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.error).toBe("Save failed");
    expect(feedback.error).not.toHaveBeenCalled();
  });
});
