import type {
  ActivityLogEntryId,
  ActivityLogPage,
  ApplicationClient,
  ThreadId,
} from "@vita-os/contracts";
import type { PropsWithChildren } from "react";

import { QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApplicationClientProvider } from "../application-client-provider";
import { threadQueryKeys } from "../query-keys";
import {
  createFakeApplicationClient,
  success,
} from "../test/fake-application-client";
import { useThreadActivity } from "./hooks";

const threadId = "thread-1" as ThreadId;
const firstPage: ActivityLogPage = {
  entries: [
    {
      _id: "log-2" as ActivityLogEntryId,
      type: "next_move_change",
      content: "Second",
      createdAt: 2,
    },
  ],
  nextCursor: "opaque-cursor",
};
const lastPage: ActivityLogPage = {
  entries: [
    {
      _id: "log-1" as ActivityLogEntryId,
      type: "next_move_change",
      content: "First",
      createdAt: 1,
    },
  ],
};

function createHarness(
  getThreadActivityPage: ApplicationClient["getThreadActivityPage"],
) {
  const client = createFakeApplicationClient({ getThreadActivityPage });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <ApplicationClientProvider client={client} queryClient={queryClient}>
      {children}
    </ApplicationClientProvider>
  );
  return { queryClient, wrapper };
}

describe("useThreadActivity", () => {
  it("forwards the opaque cursor and accumulates pages in order", async () => {
    const getThreadActivityPage = vi.fn(
      async (
        input: Parameters<ApplicationClient["getThreadActivityPage"]>[0],
      ) => success(input.cursor === undefined ? firstPage : lastPage),
    );
    const { wrapper } = createHarness(getThreadActivityPage);
    const { result } = renderHook(() => useThreadActivity(threadId, 1), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current.entries).toEqual(firstPage.entries),
    );
    expect(getThreadActivityPage).toHaveBeenNthCalledWith(1, {
      threadId,
      limit: 1,
    });
    expect(getThreadActivityPage.mock.calls[0]?.[0]).not.toHaveProperty(
      "cursor",
    );
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(getThreadActivityPage).toHaveBeenNthCalledWith(2, {
      threadId,
      limit: 1,
      cursor: "opaque-cursor",
    });
    await waitFor(() => {
      expect(result.current.entries).toEqual([
        ...firstPage.entries,
        ...lastPage.entries,
      ]);
      expect(result.current.hasNextPage).toBe(false);
    });
  });

  it("keeps different page sizes in separate caches", async () => {
    const getThreadActivityPage = vi.fn(async () => success(lastPage));
    const { wrapper, queryClient } = createHarness(getThreadActivityPage);
    const first = renderHook(() => useThreadActivity(threadId, 1), { wrapper });
    const second = renderHook(() => useThreadActivity(threadId, 20), {
      wrapper,
    });

    await waitFor(() => {
      expect(first.result.current.isSuccess).toBe(true);
      expect(second.result.current.isSuccess).toBe(true);
    });
    expect(
      queryClient.getQueryData(threadQueryKeys.activityPage(threadId, 1)),
    ).toBeDefined();
    expect(
      queryClient.getQueryData(threadQueryKeys.activityPage(threadId, 20)),
    ).toBeDefined();
  });
});
