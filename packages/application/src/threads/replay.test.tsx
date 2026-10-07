import type { OperationResult, Thread, ThreadDetail } from "@vita-os/contracts";

import { act, renderHook, waitFor } from "@testing-library/react";
import { commandAcknowledged } from "@vita-os/contracts";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "../query-keys";
import {
  createFakeApplicationClient,
  deferred,
  failure,
  success,
} from "../test/fake-application-client";
import { aThread } from "../test/fixtures";
import { createHarness } from "../test/harness";
import { useRemoveThread, useUpdateThread } from "./hooks";

describe("independent commands while reads overlap", () => {
  it("does not bring back a Thread deleted while its reopen is still pending", async () => {
    const resolved = aThread({ state: "resolved" });
    const reopening = deferred<OperationResult<Thread>>();
    const removeThread = vi.fn(async () => success(commandAcknowledged));
    const { cache, wrapper } = createHarness(
      createFakeApplicationClient({
        updateThread: () => reopening.promise,
        removeThread,
        listOpenThreads: async () => success([]),
        listResolvedThreads: async () => success([]),
        getThreadActivityPage: async () => success({ entries: [] }),
      }),
      (cache) => {
        cache.setQueryData<Thread[]>(queryKeys.threads.open(), []);
        cache.setQueryData<ThreadDetail>(
          queryKeys.threads.detail(resolved.slug),
          { thread: resolved },
        );
      },
    );
    const { result: update } = renderHook(() => useUpdateThread(resolved._id), {
      wrapper,
    });
    const { result: remove } = renderHook(() => useRemoveThread(), {
      wrapper,
    });
    const open = () => cache.getQueryData<Thread[]>(queryKeys.threads.open());

    act(() => {
      void update.current
        .mutateAsync({ thread: resolved, state: "open" })
        .catch(() => undefined);
    });
    await waitFor(() =>
      expect(open()?.map((t) => t._id)).toEqual([resolved._id]),
    );

    await act(async () => {
      await remove.current.mutateAsync({ thread: resolved });
    });

    expect(removeThread).toHaveBeenCalledTimes(1);
    expect(open()).toEqual([]);
    expect(
      cache.getQueryData(queryKeys.threads.detail(resolved.slug)),
    ).toBeNull();
    reopening.resolve(
      failure({ code: "not_found", message: "gone", retryable: false }),
    );
  });
});
