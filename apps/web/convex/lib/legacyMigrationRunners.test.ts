import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  backfillAreaCondition,
  copyItemToTask,
  copyProjectLogToActivityLog,
  copyProjectToThread,
  type LegacyMigrationCtx,
} from "./legacyMigrationRunners";

const areaId = "area1" as Id<"areas">;
const projectId = "project1" as Id<"projects">;
const itemId = "item1" as Id<"items">;
const projectLogId = "projectLog1" as Id<"projectLogs">;
const threadId = "thread1";

type TableRows = Record<string, Array<Record<string, unknown>>>;

function makeProject(
  overrides: Partial<Doc<"projects">> = {},
): Doc<"projects"> {
  return {
    _id: projectId,
    _creationTime: 0,
    userId: "user1",
    name: "Book checkup",
    slug: "book-checkup",
    definitionOfDone: "Annual physical is complete",
    areaId,
    order: 0,
    state: "open",
    createdAt: 1000,
    ...overrides,
  };
}

function makeItem(overrides: Partial<Doc<"items">> = {}): Doc<"items"> {
  return {
    _id: itemId,
    _creationTime: 0,
    userId: "user1",
    text: "Call clinic",
    isCompleted: false,
    createdAt: 1000,
    ...overrides,
  };
}

function makeProjectLog(
  overrides: Partial<Doc<"projectLogs">> = {},
): Doc<"projectLogs"> {
  return {
    _id: projectLogId,
    _creationTime: 0,
    userId: "user1",
    projectId,
    type: "note",
    content: "Called clinic",
    createdAt: 500,
    ...overrides,
  };
}

function makeCtx(seed: TableRows = {}): {
  ctx: LegacyMigrationCtx;
  tables: TableRows;
  inserted: Array<{ tableName: string; value: Record<string, unknown> }>;
  patched: Array<{ id: unknown; patch: object }>;
} {
  const tables: TableRows = {
    areas: [],
    projects: [],
    projectLogs: [],
    items: [],
    threads: [],
    tasks: [],
    activityLogs: [],
    ...seed,
  };
  const inserted: Array<{ tableName: string; value: Record<string, unknown> }> =
    [];
  const patched: Array<{ id: unknown; patch: object }> = [];

  const ctx: LegacyMigrationCtx = {
    db: {
      patch: async (id, patch) => {
        patched.push({ id, patch });
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === id);
          if (row) Object.assign(row, patch);
        }
      },
      insert: async (tableName, value) => {
        const id = `${tableName}${tables[tableName]?.length ?? 0}`;
        const row = { _id: id, ...value };
        tables[tableName] = [...(tables[tableName] ?? []), row];
        inserted.push({ tableName, value: row });
        return id;
      },
      query: (tableName) => ({
        withIndex: (_indexName, build) => {
          const filters: Array<{ field: string; value: unknown }> = [];
          const q = {
            eq: (field: string, value: unknown) => {
              filters.push({ field, value });
              return q;
            },
          };
          build(q);
          return {
            unique: async () =>
              tables[tableName]?.find((row) =>
                filters.every(({ field, value }) => row[field] === value),
              ) ?? null,
          };
        },
      }),
    },
  };

  return { ctx, tables, inserted, patched };
}

describe("legacy migration runners", () => {
  it("patches missing Area Condition values", async () => {
    const { ctx, patched } = makeCtx();

    const result = await backfillAreaCondition(ctx, {
      _id: areaId,
      _creationTime: 0,
      userId: "user1",
      name: "Health",
      healthStatus: "critical",
      order: 0,
      createdAt: 0,
    });

    expect(result).toEqual({ status: "patched" });
    expect(patched).toEqual([{ id: areaId, patch: { condition: "critical" } }]);
  });

  it("inserts a missing Thread and generated continuity logs", async () => {
    const { ctx, inserted } = makeCtx();

    const result = await copyProjectToThread(ctx, makeProject());

    expect(result).toEqual({ status: "inserted" });
    expect(inserted[0]).toEqual({
      tableName: "threads",
      value: expect.objectContaining({
        title: "Book checkup",
        summary: "Annual physical is complete",
        legacyProjectId: projectId,
      }),
    });
    expect(inserted[1]).toEqual({
      tableName: "activityLogs",
      value: expect.objectContaining({
        threadId: "threads0",
        legacyProjectId: projectId,
        migrationSourceKey: "legacy:definitionOfDone",
      }),
    });
  });

  it("skips an already migrated Thread by legacyProjectId", async () => {
    const { ctx, inserted } = makeCtx({
      threads: [{ _id: threadId, legacyProjectId: projectId }],
      activityLogs: [
        {
          _id: "log1",
          legacyProjectId: projectId,
          migrationSourceKey: "legacy:definitionOfDone",
        },
      ],
    });

    const result = await copyProjectToThread(ctx, makeProject());

    expect(result).toEqual({ status: "skipped", reason: "thread_exists" });
    expect(inserted).toEqual([]);
  });

  it("copies existing Project logs to Activity Logs with original createdAt", async () => {
    const { ctx, inserted } = makeCtx({
      threads: [{ _id: threadId, legacyProjectId: projectId }],
    });

    const result = await copyProjectLogToActivityLog(
      ctx,
      makeProjectLog({ createdAt: 500 }),
    );

    expect(result).toEqual({ status: "inserted" });
    expect(inserted).toEqual([
      {
        tableName: "activityLogs",
        value: expect.objectContaining({
          threadId,
          legacyProjectLogId: projectLogId,
          legacyProjectId: projectId,
          createdAt: 500,
        }),
      },
    ]);
  });

  it("skips Project logs already copied by legacyProjectLogId", async () => {
    const { ctx, inserted } = makeCtx({
      activityLogs: [{ _id: "log1", legacyProjectLogId: projectLogId }],
      threads: [{ _id: threadId, legacyProjectId: projectId }],
    });

    const result = await copyProjectLogToActivityLog(ctx, makeProjectLog());

    expect(result).toEqual({
      status: "skipped",
      reason: "activity_log_exists",
    });
    expect(inserted).toEqual([]);
  });

  it("inserts a missing Task from an Item", async () => {
    const { ctx, inserted } = makeCtx();

    const result = await copyItemToTask(
      ctx,
      makeItem({ date: 500, isCompleted: true, completedAt: 600 }),
    );

    expect(result).toEqual({ status: "inserted" });
    expect(inserted).toEqual([
      {
        tableName: "tasks",
        value: expect.objectContaining({
          text: "Call clinic",
          when: 500,
          state: "done",
          completedAt: 600,
          legacyItemId: itemId,
        }),
      },
    ]);
  });

  it("skips an already migrated Task by legacyItemId", async () => {
    const { ctx, inserted } = makeCtx({
      tasks: [{ _id: "task1", legacyItemId: itemId }],
    });

    const result = await copyItemToTask(ctx, makeItem());

    expect(result).toEqual({ status: "skipped", reason: "task_exists" });
    expect(inserted).toEqual([]);
  });
});
