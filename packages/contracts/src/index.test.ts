import { expect, it } from "vitest";

import type { ApplicationClient, ThreadId } from "./index";

it("models the Thread proof as asynchronous application operations", async () => {
  const client = {
    getThreadDetail: async () => ({
      ok: false,
      error: {
        code: "not_found",
        message: "Thread not found.",
        retryable: false,
      },
    }),
    getThreadActivityPage: async () => ({
      ok: true,
      value: { entries: [], nextCursor: "cursor-2" },
    }),
    completeNextMove: async (input) => ({
      ok: true,
      value:
        input.expectedNextMove === null
          ? { status: "unchanged" as const }
          : { status: "completed" as const },
    }),
  } satisfies ApplicationClient;

  await expect(
    client.completeNextMove({
      threadId: "thread-1" as ThreadId,
      expectedNextMove: "Call clinic",
      expectedRevision: 0,
    }),
  ).resolves.toEqual({ ok: true, value: { status: "completed" } });
});
