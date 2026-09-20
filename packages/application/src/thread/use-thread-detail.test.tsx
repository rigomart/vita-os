import type {
  ApplicationError,
  OperationResult,
  ThreadDetail,
} from "@vita-os/contracts";
import type { PropsWithChildren } from "react";

import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApplicationClientProvider } from "../application-client-provider";
import {
  createFakeApplicationClient,
  deferred,
  success,
} from "../test/fake-application-client";
import { threadQueryKeys } from "./query-keys";
import { useThreadDetail } from "./use-thread-detail";

const detail: ThreadDetail = {
  thread: {
    _id: "thread-1" as ThreadDetail["thread"]["_id"],
    title: "Book checkup",
    slug: "book-checkup",
    areaId: "area-1" as ThreadDetail["thread"]["areaId"],
    order: 1,
    state: "open",
    nextMove: "Call clinic",
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

function wrapperFor(result: Promise<OperationResult<ThreadDetail>>) {
  const client = createFakeApplicationClient({
    getThreadDetail: () => result,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: PropsWithChildren) => (
      <ApplicationClientProvider client={client} queryClient={queryClient}>
        {children}
      </ApplicationClientProvider>
    ),
  };
}

describe("useThreadDetail", () => {
  it("moves from loading to ready and caches the detail", async () => {
    const pending = deferred<OperationResult<ThreadDetail>>();
    const { wrapper, queryClient } = wrapperFor(pending.promise);
    const { result } = renderHook(() => useThreadDetail("book-checkup"), {
      wrapper,
    });

    expect(result.current.isPending).toBe(true);
    pending.resolve(success(detail));
    await waitFor(() => expect(result.current.data).toEqual(detail));
    expect(
      queryClient.getQueryData(threadQueryKeys.detail("book-checkup")),
    ).toEqual(detail);
  });

  it.each([
    {
      code: "not_found",
      message: "Thread not found.",
      retryable: false,
    },
    {
      code: "unavailable",
      message: "Temporarily unavailable.",
      retryable: true,
    },
  ] satisfies ApplicationError[])(
    "preserves the $code error",
    async (error) => {
      const { wrapper } = wrapperFor(Promise.resolve({ ok: false, error }));
      const { result } = renderHook(() => useThreadDetail("book-checkup"), {
        wrapper,
      });

      await waitFor(() => expect(result.current.error).toEqual(error));
    },
  );
});
