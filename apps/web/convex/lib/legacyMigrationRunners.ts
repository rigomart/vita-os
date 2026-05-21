import type { Doc } from "../_generated/dataModel";
import {
  buildAreaConditionPatch,
  buildGeneratedActivityLogEntries,
  buildMigratedActivityLogFromProjectLog,
  buildMigratedTask,
  buildMigratedThread,
  type GeneratedActivityLogEntry,
  type LegacyAreaForMigration,
} from "./legacyMigration";

type IndexBuilder = {
  eq: (field: string, value: unknown) => IndexBuilder;
};

type UniqueQuery = {
  unique: () => Promise<Record<string, unknown> | null>;
};

type Query = {
  withIndex: (
    indexName: string,
    build: (q: IndexBuilder) => IndexBuilder,
  ) => UniqueQuery;
};

export type LegacyMigrationDb = {
  get?: (id: unknown) => Promise<Record<string, unknown> | null>;
  patch: (id: unknown, patch: object) => Promise<void>;
  insert: (tableName: string, value: object) => Promise<unknown>;
  query: (tableName: string) => Query;
};

export type LegacyMigrationCtx = {
  db: LegacyMigrationDb;
};

export type MigrationStepResult =
  | { status: "inserted" }
  | { status: "patched" }
  | { status: "skipped"; reason: string };

async function findOneByIndex(
  db: LegacyMigrationDb,
  tableName: string,
  indexName: string,
  fields: Array<{ field: string; value: unknown }>,
): Promise<Record<string, unknown> | null> {
  return db
    .query(tableName)
    .withIndex(indexName, (q) =>
      fields.reduce((query, { field, value }) => query.eq(field, value), q),
    )
    .unique();
}

async function insertGeneratedActivityLogIfMissing(
  ctx: LegacyMigrationCtx,
  threadId: unknown,
  entry: GeneratedActivityLogEntry,
): Promise<MigrationStepResult> {
  const existing = await findOneByIndex(
    ctx.db,
    "activityLogs",
    "by_legacy_project_source",
    [
      { field: "legacyProjectId", value: entry.legacyProjectId },
      { field: "migrationSourceKey", value: entry.migrationSourceKey },
    ],
  );

  if (existing) return { status: "skipped", reason: "activity_log_exists" };

  await ctx.db.insert("activityLogs", {
    ...entry,
    threadId,
  });
  return { status: "inserted" };
}

export async function backfillAreaCondition(
  ctx: LegacyMigrationCtx,
  area: LegacyAreaForMigration,
): Promise<MigrationStepResult> {
  const patch = buildAreaConditionPatch(area);
  if (!patch) return { status: "skipped", reason: "condition_current" };

  await ctx.db.patch(area._id, patch);
  return { status: "patched" };
}

export async function copyProjectToThread(
  ctx: LegacyMigrationCtx,
  project: Doc<"projects">,
): Promise<MigrationStepResult> {
  const existingThread = await findOneByIndex(
    ctx.db,
    "threads",
    "by_legacy_project",
    [{ field: "legacyProjectId", value: project._id }],
  );

  const threadId =
    existingThread?._id ??
    (await ctx.db.insert("threads", buildMigratedThread(project)));

  const generatedLogs = buildGeneratedActivityLogEntries(project);
  for (const entry of generatedLogs) {
    await insertGeneratedActivityLogIfMissing(ctx, threadId, entry);
  }

  if (existingThread) return { status: "skipped", reason: "thread_exists" };
  return { status: "inserted" };
}

export async function copyProjectLogToActivityLog(
  ctx: LegacyMigrationCtx,
  projectLog: Doc<"projectLogs">,
): Promise<MigrationStepResult> {
  const existingLog = await findOneByIndex(
    ctx.db,
    "activityLogs",
    "by_legacy_project_log",
    [{ field: "legacyProjectLogId", value: projectLog._id }],
  );
  if (existingLog) {
    return { status: "skipped", reason: "activity_log_exists" };
  }

  const thread = await findOneByIndex(ctx.db, "threads", "by_legacy_project", [
    { field: "legacyProjectId", value: projectLog.projectId },
  ]);
  if (!thread?._id) return { status: "skipped", reason: "thread_missing" };

  await ctx.db.insert(
    "activityLogs",
    buildMigratedActivityLogFromProjectLog(projectLog, thread._id),
  );
  return { status: "inserted" };
}

export async function copyItemToTask(
  ctx: LegacyMigrationCtx,
  item: Doc<"items">,
): Promise<MigrationStepResult> {
  const existingTask = await findOneByIndex(ctx.db, "tasks", "by_legacy_item", [
    { field: "legacyItemId", value: item._id },
  ]);
  if (existingTask) return { status: "skipped", reason: "task_exists" };

  await ctx.db.insert("tasks", buildMigratedTask(item));
  return { status: "inserted" };
}
