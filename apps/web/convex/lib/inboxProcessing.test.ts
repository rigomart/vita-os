import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  buildProjectNoteFromItem,
  getInboxProcessingResultType,
  getItemProcessingDisposition,
  type InboxProcessingAction,
  processInboxItem,
} from "./inboxProcessing";

const areaId = "area1" as Id<"areas">;
const projectId = "project1" as Id<"projects">;

function makeItem(overrides: Partial<Doc<"items">> = {}): Doc<"items"> {
  return {
    _id: "item1" as Id<"items">,
    _creationTime: 0,
    userId: "user1",
    text: "Call clinic",
    isCompleted: false,
    createdAt: 0,
    ...overrides,
  };
}

function makeProject(
  overrides: Partial<Doc<"projects">> = {},
): Doc<"projects"> {
  return {
    _id: projectId,
    _creationTime: 0,
    userId: "user1",
    name: "Book checkup",
    slug: "book-checkup",
    areaId: "area1" as Id<"areas">,
    state: "open",
    order: 0,
    createdAt: 0,
    ...overrides,
  };
}

describe("getItemProcessingDisposition", () => {
  it.each<InboxProcessingAction>([
    {
      type: "create_project",
      name: "Book health check",
      areaId,
    },
    { type: "add_activity_log_entry", projectId },
    { type: "set_next_move", projectId },
    { type: "discard" },
  ])("deletes the Item after %s processing", (action) => {
    expect(getItemProcessingDisposition(action)).toBe("delete_item");
  });
});

describe("getInboxProcessingResultType", () => {
  it.each<[InboxProcessingAction, string]>([
    [{ type: "create_project", name: "Book health check", areaId }, "created"],
    [{ type: "add_activity_log_entry", projectId }, "added"],
    [{ type: "set_next_move", projectId }, "set_next_move"],
    [{ type: "discard" }, "discarded"],
  ])("maps processing action %# to its mutation result", (action, result) => {
    expect(getInboxProcessingResultType(action)).toBe(result);
  });
});

describe("buildProjectNoteFromItem", () => {
  it("copies Item text into a Project log note", () => {
    expect(buildProjectNoteFromItem(makeItem())).toEqual({
      type: "note",
      content: "Call clinic",
    });
  });
});

describe("processInboxItem", () => {
  it("creates a new Thread from a Task, logs the original Task text, and consumes the Task", async () => {
    const item = makeItem({ text: "Schedule a physical" });
    const inserted: Array<{ table: string; value: Record<string, unknown> }> =
      [];
    const deleted: string[] = [];
    const area = {
      _id: areaId,
      _creationTime: 0,
      userId: "user1",
      name: "Health",
      slug: "health",
      healthStatus: "healthy",
      order: 0,
      createdAt: 0,
    };
    const ctx = {
      db: {
        get: async (id: string) => (id === areaId ? area : null),
        query: () => ({
          withIndex: () => ({
            order: () => ({
              first: async () => null,
            }),
          }),
        }),
        insert: async (table: string, value: Record<string, unknown>) => {
          inserted.push({ table, value });
          return table === "projects" ? projectId : "log1";
        },
        delete: async (id: string) => {
          deleted.push(id);
        },
      },
    };

    const result = await processInboxItem(ctx as never, {
      userId: "user1",
      item,
      action: {
        type: "create_project",
        name: "Annual health check",
        areaId,
      },
    });

    expect(result).toEqual({
      type: "created",
      slug: expect.stringMatching(/^annual-health-check-[a-f0-9]{8}$/),
    });
    expect(inserted).toEqual([
      {
        table: "projects",
        value: {
          userId: "user1",
          name: "Annual health check",
          slug: expect.stringMatching(/^annual-health-check-[a-f0-9]{8}$/),
          areaId,
          order: 0,
          state: "open",
          createdAt: expect.any(Number),
        },
      },
      {
        table: "projectLogs",
        value: {
          userId: "user1",
          projectId,
          type: "note",
          content: "Schedule a physical",
          createdAt: expect.any(Number),
        },
      },
    ]);
    expect(inserted[0]?.value).not.toHaveProperty("nextMove");
    expect(inserted[0]?.value).not.toHaveProperty("actionQueue");
    expect(deleted).toEqual([item._id]);
  });

  it("adds a Task to an existing Thread Activity Log and consumes the Task", async () => {
    const item = makeItem();
    const project = makeProject();
    const inserted: Array<{ table: string; value: unknown }> = [];
    const deleted: string[] = [];
    const ctx = {
      db: {
        get: async (id: string) => (id === project._id ? project : null),
        insert: async (table: string, value: unknown) => {
          inserted.push({ table, value });
          return "inserted";
        },
        delete: async (id: string) => {
          deleted.push(id);
        },
      },
    };

    const result = await processInboxItem(ctx as never, {
      userId: "user1",
      item,
      action: { type: "add_activity_log_entry", projectId: project._id },
    });

    expect(result).toEqual({ type: "added" });
    expect(inserted).toEqual([
      {
        table: "projectLogs",
        value: {
          userId: "user1",
          projectId: project._id,
          type: "note",
          content: "Call clinic",
          createdAt: expect.any(Number),
        },
      },
    ]);
    expect(deleted).toEqual([item._id]);
  });

  it("sets a Task as an existing Thread Next Move and consumes the Task", async () => {
    const item = makeItem();
    const project = makeProject();
    const inserted: Array<{ table: string; value: unknown }> = [];
    const patched: Array<{ id: string; patch: unknown }> = [];
    const deleted: string[] = [];
    const ctx = {
      db: {
        get: async (id: string) => (id === project._id ? project : null),
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

    const result = await processInboxItem(ctx as never, {
      userId: "user1",
      item,
      action: { type: "set_next_move", projectId: project._id },
    });

    expect(result).toEqual({ type: "set_next_move" });
    expect(patched).toEqual([
      { id: project._id, patch: { nextMove: "Call clinic" } },
    ]);
    expect(inserted).toEqual([
      {
        table: "projectLogs",
        value: {
          userId: "user1",
          projectId: project._id,
          type: "next_action_change",
          content: 'Next move set to "Call clinic"',
          previousValue: undefined,
          newValue: "Call clinic",
          createdAt: expect.any(Number),
        },
      },
    ]);
    expect(deleted).toEqual([item._id]);
  });
});
