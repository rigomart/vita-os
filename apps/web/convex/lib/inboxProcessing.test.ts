import { describe, expect, it } from "vitest";

import type { Doc, Id } from "../_generated/dataModel";

import {
  buildThreadNoteFromTask,
  getInboxProcessingResultType,
  getTaskProcessingDisposition,
  type InboxProcessingAction,
  processInboxTask,
} from "./inboxProcessing";

const areaId = "area1" as Id<"areas">;
const threadId = "thread1" as Id<"threads">;

function makeTask(overrides: Partial<Doc<"tasks">> = {}): Doc<"tasks"> {
  return {
    _id: "task1" as Id<"tasks">,
    _creationTime: 0,
    userId: "user1",
    text: "Call clinic",
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

function makeThread(overrides: Partial<Doc<"threads">> = {}): Doc<"threads"> {
  return {
    _id: threadId,
    _creationTime: 0,
    userId: "user1",
    title: "Book checkup",
    slug: "book-checkup",
    areaId: "area1" as Id<"areas">,
    state: "open",
    order: 0,
    createdAt: 0,
    ...overrides,
  };
}

describe("getTaskProcessingDisposition", () => {
  it.each<InboxProcessingAction>([
    {
      type: "create_thread",
      title: "Book health check",
      areaId,
    },
    { type: "add_activity_log_entry", threadId },
    { type: "set_next_move", threadId },
    { type: "discard" },
  ])("deletes the Task after %s processing", (action) => {
    expect(getTaskProcessingDisposition(action)).toBe("delete_task");
  });
});

describe("getInboxProcessingResultType", () => {
  it.each<[InboxProcessingAction, string]>([
    [{ type: "create_thread", title: "Book health check", areaId }, "created"],
    [{ type: "add_activity_log_entry", threadId }, "added"],
    [{ type: "set_next_move", threadId }, "set_next_move"],
    [{ type: "discard" }, "discarded"],
  ])("maps processing action %# to its mutation result", (action, result) => {
    expect(getInboxProcessingResultType(action)).toBe(result);
  });
});

describe("buildThreadNoteFromTask", () => {
  it("copies Task text into a Thread log note", () => {
    expect(buildThreadNoteFromTask(makeTask())).toEqual({
      type: "note",
      content: "Call clinic",
    });
  });
});

describe("processInboxTask", () => {
  it("creates a new Thread from a Task, logs the original Task text, and consumes the Task", async () => {
    const task = makeTask({ text: "Schedule a physical" });
    const inserted: Array<{ table: string; value: Record<string, unknown> }> =
      [];
    const deleted: string[] = [];
    const area = {
      _id: areaId,
      _creationTime: 0,
      userId: "user1",
      name: "Health",
      slug: "health",
      condition: "healthy",
      order: 0,
      createdAt: 0,
    };
    const ctx = {
      db: {
        get: async (_table: string, id: string) =>
          id === areaId ? area : null,
        query: () => ({
          withIndex: () => ({
            order: () => ({
              first: async () => null,
            }),
          }),
        }),
        insert: async (table: string, value: Record<string, unknown>) => {
          inserted.push({ table, value });
          return table === "threads" ? threadId : "log1";
        },
        delete: async (id: string) => {
          deleted.push(id);
        },
      },
    };

    const result = await processInboxTask(ctx as never, {
      userId: "user1",
      task,
      action: {
        type: "create_thread",
        title: "Annual health check",
        areaId,
      },
    });

    expect(result).toEqual({
      type: "created",
      slug: expect.stringMatching(/^annual-health-check-[a-f0-9]{8}$/),
    });
    expect(inserted).toEqual([
      {
        table: "threads",
        value: {
          userId: "user1",
          title: "Annual health check",
          slug: expect.stringMatching(/^annual-health-check-[a-f0-9]{8}$/),
          areaId,
          order: 0,
          state: "open",
          createdAt: expect.any(Number),
        },
      },
      {
        table: "activityLogs",
        value: {
          userId: "user1",
          threadId,
          type: "note",
          content: "Schedule a physical",
          createdAt: expect.any(Number),
        },
      },
    ]);
    expect(inserted[0]?.value).not.toHaveProperty("nextMove");
    expect(inserted[0]?.value).not.toHaveProperty("actionQueue");
    expect(deleted).toEqual([task._id]);
  });

  it("adds a Task to an existing Thread Activity Log and consumes the Task", async () => {
    const task = makeTask();
    const thread = makeThread();
    const inserted: Array<{ table: string; value: unknown }> = [];
    const deleted: string[] = [];
    const ctx = {
      db: {
        get: async (_table: string, id: string) =>
          id === thread._id ? thread : null,
        insert: async (table: string, value: unknown) => {
          inserted.push({ table, value });
          return "inserted";
        },
        delete: async (id: string) => {
          deleted.push(id);
        },
      },
    };

    const result = await processInboxTask(ctx as never, {
      userId: "user1",
      task,
      action: { type: "add_activity_log_entry", threadId: thread._id },
    });

    expect(result).toEqual({ type: "added" });
    expect(inserted).toEqual([
      {
        table: "activityLogs",
        value: {
          userId: "user1",
          threadId: thread._id,
          type: "note",
          content: "Call clinic",
          createdAt: expect.any(Number),
        },
      },
    ]);
    expect(deleted).toEqual([task._id]);
  });

  it("sets a Task as an existing Thread Next Move and consumes the Task", async () => {
    const task = makeTask();
    const thread = makeThread();
    const inserted: Array<{ table: string; value: unknown }> = [];
    const patched: Array<{ id: string; patch: unknown }> = [];
    const deleted: string[] = [];
    const ctx = {
      db: {
        get: async (_table: string, id: string) =>
          id === thread._id ? thread : null,
        insert: async (table: string, value: unknown) => {
          inserted.push({ table, value });
          return "inserted";
        },
        patch: async (id: string, patch: unknown) => {
          patched.push({ id, patch });
        },
        delete: async (id: string) => {
          deleted.push(id);
        },
      },
    };

    const result = await processInboxTask(ctx as never, {
      userId: "user1",
      task,
      action: { type: "set_next_move", threadId: thread._id },
    });

    expect(result).toEqual({ type: "set_next_move" });
    expect(patched).toEqual([
      { id: thread._id, patch: { nextMove: "Call clinic" } },
    ]);
    expect(inserted).toEqual([
      {
        table: "activityLogs",
        value: {
          userId: "user1",
          threadId: thread._id,
          type: "next_action_change",
          content: 'Next move set to "Call clinic"',
          previousValue: undefined,
          newValue: "Call clinic",
          createdAt: expect.any(Number),
        },
      },
    ]);
    expect(deleted).toEqual([task._id]);
  });
});
