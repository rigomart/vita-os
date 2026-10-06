import type {
  Thread,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

import { newRecordId } from "@vita-os/core";
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
    note: { id: newRecordId() as ThreadNoteId, body: "  Called  " },
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
          _id: input.note.id,
        }),
      ]);
      expect(state.threads[0]).not.toHaveProperty("lastActivityContent");
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

  it("omits the activity quote when a Note is captured", async () => {
    const { state, client, input } = setup();
    state.threads[0]!.lastActivityContent = "Old quote";
    await client.completeTask(input);
    expect(state.threads[0]).not.toHaveProperty("lastActivityContent");
  });

  it.each([false, true])(
    "records a completion Activity entry (note=%s)",
    async (withNote) => {
      const { client, input } = setup();
      await client.completeTask({
        ...input,
        note: withNote ? input.note : undefined,
      });
      expect(
        await client.getThreadActivityPage({
          threadId: input.threadId,
          limit: 50,
        }),
      ).toEqual({
        ok: true,
        value: {
          entries: [
            expect.objectContaining({
              type: "move_completed",
              content: 'Completed "Call"',
              previousValue: "Call",
              createdAt: expect.any(Number),
            }),
          ],
        },
      });
    },
  );

  it("refuses a reused Note ID without changing any collection", async () => {
    const { state, client, input } = setup(true);
    await client.completeTask(input);
    const before = structuredClone(state);
    expect(
      await client.completeTask({ ...input, expectedRevision: 2 }),
    ).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(state).toEqual(before);
  });

  it("refuses blank Notes without changing either collection", async () => {
    const { state, client, input } = setup();
    const before = structuredClone(state);
    expect(
      await client.completeTask({
        ...input,
        note: { id: newRecordId() as ThreadNoteId, body: "  " },
      }),
    ).toMatchObject({ ok: false, error: { code: "validation" } });
    expect(state).toEqual(before);
  });
});
