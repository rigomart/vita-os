import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { describe, expect, it, vi } from "vitest";

import { act, renderHook, waitFor } from "@/test/render-with-providers";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("useGuardedAsyncAction", () => {
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

    const { result, feedback } = renderHook(() =>
      useGuardedAsyncAction(action, { successMessage: "Task added" }),
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

    const { result, feedback } = renderHook(() =>
      useGuardedAsyncAction(action),
    );

    await act(async () => {
      await result.current.run();
    });

    expect(feedback.success).not.toHaveBeenCalled();
  });

  it("shows an error toast by default when the action fails", async () => {
    const action = vi.fn(() => Promise.reject(new Error("Save failed")));

    const { result, feedback } = renderHook(() =>
      useGuardedAsyncAction(action),
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

  it("unwraps concise Convex domain errors", async () => {
    const action = vi.fn(() =>
      Promise.reject(
        new Error(
          [
            "[CONVEX M(threads:update)] Server Error",
            "Uncaught Error: Thread not found",
            "    at handler (convex/threads.ts:109:13)",
          ].join("\n"),
        ),
      ),
    );

    const { result, feedback } = renderHook(() =>
      useGuardedAsyncAction(action),
    );

    let outcome!: Awaited<ReturnType<typeof result.current.run>>;
    await act(async () => {
      outcome = await result.current.run();
    });

    expect(outcome).toEqual({
      ok: false,
      skipped: false,
      error: "Thread not found",
    });
    expect(result.current.error).toBe("Thread not found");
    expect(feedback.error).toHaveBeenCalledWith("Thread not found");
  });

  it("hides raw Convex schema errors from toasts", async () => {
    const action = vi.fn(() =>
      Promise.reject(
        new Error(
          [
            "[CONVEX M(threads:update)] Server Error",
            'Uncaught Error: Failed to insert or update a document in table "threads" because it does not match the schema: Object contains extra field `id` that is not in the validator.',
            "Validator: v.object({title, followUp})",
            "    at async applyThreadPatch (convex/lib/threadChanges.ts:173:2)",
          ].join("\n"),
        ),
      ),
    );

    const { result, feedback } = renderHook(() =>
      useGuardedAsyncAction(action),
    );

    let outcome!: Awaited<ReturnType<typeof result.current.run>>;
    await act(async () => {
      outcome = await result.current.run();
    });

    expect(outcome).toEqual({
      ok: false,
      skipped: false,
      error: "Something went wrong. Please try again.",
    });
    expect(result.current.error).toBe(
      "Something went wrong. Please try again.",
    );
    expect(feedback.error).toHaveBeenCalledWith(
      "Something went wrong. Please try again.",
    );
  });

  it("suppresses the error toast when errorToast is false", async () => {
    const action = vi.fn(() => Promise.reject(new Error("Save failed")));

    const { result, feedback } = renderHook(() =>
      useGuardedAsyncAction(action, { errorToast: false }),
    );

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.error).toBe("Save failed");
    expect(feedback.error).not.toHaveBeenCalled();
  });
});
