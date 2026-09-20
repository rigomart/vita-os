import type {
  ActivityLogPage,
  ApplicationClient,
  ApplicationError,
  OperationResult,
  ThreadDetail,
  ThreadId,
} from "@vita-os/contracts";
import type { PropsWithChildren } from "react";

import { type InfiniteData, QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApplicationClientProvider } from "../application-client-provider";
import {
  createFakeApplicationClient,
  deferred,
  success,
} from "../test/fake-application-client";
import { threadQueryKeys } from "./query-keys";
import { useCompleteNextMove } from "./use-complete-next-move";
import { useThreadActivity } from "./use-thread-activity";
import { useThreadDetail } from "./use-thread-detail";

const threadId = "thread-1" as ThreadId;
const slug = "book-checkup";
const initialDetail: ThreadDetail = {
  thread: {
    _id: threadId,
    title: "Book checkup",
    slug,
    areaId: "area-1" as ThreadDetail["thread"]["areaId"],
    order: 1,
    state: "open",
    nextMove: "Call clinic",
    upNext: ["Book appointment", "Collect results"],
    revision: 0,
    createdAt: 1,
  },
  area: {
    _id: "area-1" as ThreadDetail["area"]["_id"],
    name: "Health",
    slug: "health",
    condition: "healthy",
    icon: "HeartPulse",
    order: 1,
    createdAt: 1,
  },
};
const initialActivity: InfiniteData<ActivityLogPage, string | undefined> = {
  pages: [
    {
      entries: [
        {
          _id: "log-2",
          type: "next_action_change",
          content: "Captured Call clinic",
          createdAt: 2,
        },
      ],
      nextCursor: "cursor-1",
    },
    {
      entries: [
        {
          _id: "log-1",
          type: "next_action_change",
          content: "Earlier",
          createdAt: 1,
        },
      ],
    },
  ],
  pageParams: [undefined, "cursor-1"],
};

function createHarness(client: ApplicationClient) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(threadQueryKeys.detail(slug), initialDetail);
  queryClient.setQueryData(
    threadQueryKeys.activityPage(threadId, 2),
    initialActivity,
  );
  const wrapper = ({ children }: PropsWithChildren) => (
    <ApplicationClientProvider client={client} queryClient={queryClient}>
      {children}
    </ApplicationClientProvider>
  );
  const hook = renderHook(
    () => ({
      detail: useThreadDetail(slug),
      activity: useThreadActivity(threadId, 2),
      completion: useCompleteNextMove({ threadId, slug }),
    }),
    { wrapper },
  );
  return { ...hook, queryClient };
}

const completionInput = {
  expectedNextMove: "Call clinic",
  expectedRevision: 0,
};

describe("useCompleteNextMove", () => {
  it("optimistically promotes detail without fabricating Activity Log data", async () => {
    const pending =
      deferred<OperationResult<{ status: "completed" | "unchanged" }>>();
    const completeNextMove = vi.fn(() => pending.promise);
    const client = createFakeApplicationClient({ completeNextMove });
    const { result, queryClient } = createHarness(client);

    act(() => result.current.completion.mutate(completionInput));

    await waitFor(() => {
      expect(queryClient.getQueryData(threadQueryKeys.detail(slug))).toEqual({
        ...initialDetail,
        thread: {
          ...initialDetail.thread,
          nextMove: "Book appointment",
          upNext: ["Collect results"],
        },
      });
    });
    expect(
      queryClient.getQueryData(threadQueryKeys.activityPage(threadId, 2)),
    ).toEqual(initialActivity);
    expect(completeNextMove).toHaveBeenCalledWith({
      threadId,
      ...completionInput,
    });

    pending.resolve(success({ status: "completed" }));
  });

  it("refetches authoritative detail and Activity Log data after success", async () => {
    const authoritativeDetail: ThreadDetail = {
      ...initialDetail,
      thread: {
        ...initialDetail.thread,
        nextMove: "Book appointment",
        upNext: ["Collect results"],
        revision: 1,
      },
    };
    const authoritativePage: ActivityLogPage = {
      entries: [
        {
          _id: "log-3",
          type: "next_action_change",
          content: "Completed Call clinic",
          createdAt: 3,
        },
      ],
    };
    const client = createFakeApplicationClient({
      completeNextMove: async () => success({ status: "completed" }),
      getThreadDetail: async () => success(authoritativeDetail),
      getThreadActivityPage: async () => success(authoritativePage),
    });
    const { result } = createHarness(client);

    await act(async () => {
      await result.current.completion.mutateAsync(completionInput);
    });

    await waitFor(() => {
      expect(result.current.detail.data).toEqual(authoritativeDetail);
      expect(result.current.activity.entries).toEqual(
        authoritativePage.entries,
      );
    });
  });

  it.each([
    {
      code: "unavailable",
      message: "Temporarily unavailable.",
      retryable: true,
    },
    {
      code: "conflict",
      message: "Next Move has changed.",
      retryable: false,
    },
  ] satisfies ApplicationError[])(
    "restores exact snapshots before reconciling a $code error",
    async (error) => {
      const detailRefetch = deferred<OperationResult<ThreadDetail>>();
      const activityRefetch = deferred<OperationResult<ActivityLogPage>>();
      const completeNextMove = vi.fn(
        async () => ({ ok: false, error }) as const,
      );
      const client = createFakeApplicationClient({
        completeNextMove,
        getThreadDetail: () => detailRefetch.promise,
        getThreadActivityPage: () => activityRefetch.promise,
      });
      const { result, queryClient } = createHarness(client);

      let mutation!: Promise<unknown>;
      act(() => {
        mutation = result.current.completion.mutateAsync(completionInput);
        void mutation.catch(() => undefined);
      });

      await waitFor(() => {
        expect(result.current.detail.isFetching).toBe(true);
        expect(result.current.activity.isFetching).toBe(true);
      });
      expect(queryClient.getQueryData(threadQueryKeys.detail(slug))).toEqual(
        initialDetail,
      );
      expect(
        queryClient.getQueryData(threadQueryKeys.activityPage(threadId, 2)),
      ).toEqual(initialActivity);
      expect(completeNextMove).toHaveBeenCalledTimes(1);

      detailRefetch.resolve(success(initialDetail));
      activityRefetch.resolve(success(initialActivity.pages[0]));
      await expect(mutation).rejects.toEqual(error);
      await waitFor(() =>
        expect(result.current.completion.error).toEqual(error),
      );
    },
  );
});
