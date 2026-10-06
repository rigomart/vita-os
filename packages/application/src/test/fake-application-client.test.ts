import type { Thread, ThreadId, ThreadNote } from "@vita-os/contracts";

import { describe, expect, it } from "vitest";

import { createFakeApplicationClient } from "./fake-application-client";

function setup(repeats = false) {
  const thread: Thread = {
    _id: "thread" as ThreadId,
    title: "Check",
    slug: "check",
    state: "open",
    order: 0,
    revision: 1,
    createdAt: 1,
    tasks: [
      {
        _id: "task" as NonNullable<Thread["tasks"]>[number]["_id"],
        text: "Call",
        ...(repeats
          ? {
              date: Date.parse("2099-01-01T15:30Z"),
              repeat: { kind: "days" as const, every: 1 },
            }
          : {}),
      },
    ],
  };
  const state = {
    threads: [thread],
    threadNotes: new Map<ThreadId, ThreadNote[]>(),
  };
  const client = createFakeApplicationClient({}, state);
  const input = {
    threadId: thread._id,
    taskId: thread.tasks![0]!._id,
    expectedRevision: 1,
    note: { body: "  Called  " },
    ...(repeats ? { timeZone: "UTC" } : {}),
  };
  return { state, client, input };
}

describe("in-memory completion with a Note", () => {
  it.each([false, true])(
    "changes the Task and captures exactly one Note (repeat=%s)",
    async (repeats) => {
      const { state, client, input } = setup(repeats);
      const result = await client.completeTask(input);
      expect(result.ok).toBe(true);
      expect(state.threadNotes.get(input.threadId)).toEqual([
        expect.objectContaining({
          body: "Called",
          state: "open",
          _id: expect.any(String),
        }),
      ]);
      if (repeats)
        expect(state.threads[0]!.tasks![0]!.date).toBe(
          Date.parse("2099-01-02T15:30Z"),
        );
      else expect(state.threads[0]!.tasks).toBeUndefined();
      expect(await client.completeTask(input)).toMatchObject({
        ok: false,
        error: { code: "conflict" },
      });
      expect(state.threadNotes.get(input.threadId)).toHaveLength(1);
      expect(
        await client.listOpenThreadNotes({ threadId: input.threadId }),
      ).toEqual({ ok: true, value: state.threadNotes.get(input.threadId) });
    },
  );

  it("refuses blank Notes without changing either collection", async () => {
    const { state, client, input } = setup();
    const before = structuredClone(state);
    expect(
      await client.completeTask({ ...input, note: { body: "  " } }),
    ).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(state).toEqual(before);
  });
});
