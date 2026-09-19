import type { AreaId, Thread, ThreadId } from "@vita-os/contracts";
import type { ReactNode } from "react";

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ConvexApplicationClient } from "@/application/convex/convex-application-client-compatibility";

import { ApplicationClientProvider } from "@/application/application-client-context";

import { useCompleteNextMove } from "./use-complete-next-move";

const thread = {
  _id: "thread1" as ThreadId,
  title: "Book checkup",
  slug: "book-checkup",
  areaId: "area1" as AreaId,
  order: 0,
  state: "open",
  nextMove: "Call clinic",
  createdAt: 1,
} satisfies Thread;

function renderCompleteNextMove(client: ConvexApplicationClient) {
  return renderHook(() => useCompleteNextMove(thread), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ApplicationClientProvider client={client}>
        {children}
      </ApplicationClientProvider>
    ),
  });
}

describe("useCompleteNextMove", () => {
  it("completes through the injected application client", async () => {
    const completeNextMove = vi
      .fn()
      .mockResolvedValue({ ok: true, value: { status: "completed" } });
    const client: ConvexApplicationClient = {
      watchThreadDetail: vi.fn(),
      watchThreadActivity: vi.fn(),
      completeNextMove,
    };
    const { result } = renderCompleteNextMove(client);

    await act(() => result.current());

    expect(completeNextMove).toHaveBeenCalledWith({
      threadId: thread._id,
      thread,
    });
  });

  it("rejects with the public application error", async () => {
    const client: ConvexApplicationClient = {
      watchThreadDetail: vi.fn(),
      watchThreadActivity: vi.fn(),
      completeNextMove: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: "unavailable",
          message: "The service is temporarily unavailable.",
          retryable: true,
        },
      }),
    };
    const { result } = renderCompleteNextMove(client);

    await expect(result.current()).rejects.toThrow(
      "The service is temporarily unavailable.",
    );
  });
});
