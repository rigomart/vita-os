import type {
  ActivityLogEntryId,
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
import { threadQueryKeys } from "../query-keys";
import {
  createFakeApplicationClient,
  deferred,
  success,
} from "../test/fake-application-client";
import { useCompleteNextMove } from "./hooks";
import { useThreadActivity } from "./hooks";
import { useThreadDetail } from "./hooks";

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
          _id: "log-2" as ActivityLogEntryId,
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
          _id: "log-1" as ActivityLogEntryId,
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
      mutations: { retry: 2, retryDelay: 0 },
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
      completion: useCompleteNextMove({ threadId }),
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
  it("restores and invalidates the mutation's original Thread after navigation", async () => {
    const secondThreadId = "thread-2" as ThreadId;
    const secondSlug = "dentist-checkup";
    const secondDetail: ThreadDetail = {
      ...initialDetail,
      thread: {
        ...initialDetail.thread,
        _id: secondThreadId,
        slug: secondSlug,
        title: "Dentist checkup",
        nextMove: "Choose dentist",
      },
    };
    const pending = deferred<OperationResult<{ status: "completed" }>>();
    const client = createFakeApplicationClient({
      completeNextMove: () => pending.promise,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(threadQueryKeys.detail(slug), initialDetail);
    queryClient.setQueryData(threadQueryKeys.detail(secondSlug), secondDetail);
    const wrapper = ({ children }: PropsWithChildren) => (
      <ApplicationClientProvider client={client} queryClient={queryClient}>
        {children}
      </ApplicationClientProvider>
    );
    const { result, rerender } = renderHook(
      ({ currentThreadId }) =>
        useCompleteNextMove({ threadId: currentThreadId }),
      {
        initialProps: { currentThreadId: threadId, currentSlug: slug },
        wrapper,
      },
    );

    let mutation!: Promise<unknown>;
    act(() => {
      mutation = result.current.mutateAsync(completionInput);
      void mutation.catch(() => undefined);
    });
    await waitFor(() =>
      expect(
        queryClient.getQueryData<ThreadDetail>(threadQueryKeys.detail(slug))
          ?.thread.nextMove,
      ).toBe("Book appointment"),
    );

    rerender({
      currentThreadId: secondThreadId,
      currentSlug: secondSlug,
    });
    const error: ApplicationError = {
      code: "unavailable",
      message: "Temporarily unavailable.",
      retryable: true,
    };
    pending.resolve({ ok: false, error });
    await expect(mutation).rejects.toEqual(error);

    expect(queryClient.getQueryData(threadQueryKeys.detail(slug))).toEqual(
      initialDetail,
    );
    expect(
      queryClient.getQueryData(threadQueryKeys.detail(secondSlug)),
    ).toEqual(secondDetail);
    expect(
      queryClient.getQueryState(threadQueryKeys.detail(slug))?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(threadQueryKeys.detail(secondSlug))
        ?.isInvalidated,
    ).toBe(false);
  });

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

  it("cancels stale in-flight reads before applying the optimistic snapshot", async () => {
    const staleDetail = deferred<ThreadDetail>();
    const staleActivity = deferred<ActivityLogPage>();
    const completion =
      deferred<OperationResult<{ status: "completed" | "unchanged" }>>();
    const client = createFakeApplicationClient({
      completeNextMove: () => completion.promise,
    });
    const { result, queryClient } = createHarness(client);

    const detailFetch = queryClient
      .fetchQuery({
        queryKey: threadQueryKeys.detail(slug),
        queryFn: () => staleDetail.promise,
        staleTime: 0,
      })
      .catch(() => undefined);
    const activityFetch = queryClient
      .fetchInfiniteQuery({
        queryKey: threadQueryKeys.activityPage(threadId, 2),
        queryFn: () => staleActivity.promise,
        initialPageParam: undefined,
        getNextPageParam: () => undefined,
        staleTime: 0,
      })
      .catch(() => undefined);

    act(() => result.current.completion.mutate(completionInput));
    await waitFor(() =>
      expect(
        queryClient.getQueryData<ThreadDetail>(threadQueryKeys.detail(slug))
          ?.thread.nextMove,
      ).toBe("Book appointment"),
    );

    staleDetail.resolve({
      ...initialDetail,
      thread: { ...initialDetail.thread, nextMove: "Stale server value" },
    });
    staleActivity.resolve({
      entries: [
        {
          _id: "stale-log" as ActivityLogEntryId,
          type: "next_action_change",
          content: "Stale",
          createdAt: 99,
        },
      ],
    });
    await Promise.all([detailFetch, activityFetch]);

    expect(
      queryClient.getQueryData<ThreadDetail>(threadQueryKeys.detail(slug))
        ?.thread.nextMove,
    ).toBe("Book appointment");
    expect(
      queryClient.getQueryData(threadQueryKeys.activityPage(threadId, 2)),
    ).toEqual(initialActivity);
    completion.resolve(success({ status: "completed" }));
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
          _id: "log-3" as ActivityLogEntryId,
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
      let queryClientForRefetch!: QueryClient;
      let detailAtRefetch: unknown;
      let activityAtRefetch: unknown;
      const completeNextMove = vi.fn(
        async () => ({ ok: false, error }) as const,
      );
      const client = createFakeApplicationClient({
        completeNextMove,
        getThreadDetail: () => {
          detailAtRefetch = queryClientForRefetch.getQueryData(
            threadQueryKeys.detail(slug),
          );
          return detailRefetch.promise;
        },
        getThreadActivityPage: () => {
          activityAtRefetch = queryClientForRefetch.getQueryData(
            threadQueryKeys.activityPage(threadId, 2),
          );
          return activityRefetch.promise;
        },
      });
      const { result, queryClient } = createHarness(client);
      queryClientForRefetch = queryClient;

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
      expect(detailAtRefetch).toEqual(initialDetail);
      expect(activityAtRefetch).toEqual(initialActivity);
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
