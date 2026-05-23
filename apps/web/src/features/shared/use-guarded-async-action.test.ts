import { act, renderHook, waitFor } from "@testing-library/react";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@vita-os/ui/lib/toast", () => ({
  toast: toastMocks,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("useGuardedAsyncAction", () => {
  beforeEach(() => {
    toastMocks.success.mockClear();
    toastMocks.error.mockClear();
  });

  it("ignores duplicate runs while the action is pending", async () => {
    const pending = deferred<void>();
    const action = vi.fn(() => pending.promise);

    const { result } = renderHook(() => useGuardedAsyncAction(action));

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

    const { result } = renderHook(() =>
      useGuardedAsyncAction(action, { successMessage: "Task added" }),
    );

    let outcome!: Awaited<ReturnType<typeof result.current.run>>;
    await act(async () => {
      outcome = await result.current.run();
    });

    expect(outcome).toEqual({ ok: true, value: "done" });
    expect(toastMocks.success).toHaveBeenCalledWith("Task added");
  });

  it("stays quiet on success when no success message is configured", async () => {
    const action = vi.fn(async () => "done");

    const { result } = renderHook(() => useGuardedAsyncAction(action));

    await act(async () => {
      await result.current.run();
    });

    expect(toastMocks.success).not.toHaveBeenCalled();
  });
});
