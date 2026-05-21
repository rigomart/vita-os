import { type MigrationStatus, Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  backfillAreaCondition,
  copyItemToTask,
  copyProjectLogToActivityLog,
  copyProjectToThread,
  type LegacyMigrationCtx,
} from "./lib/legacyMigrationRunners";

export const migrations = new Migrations<DataModel>(components.migrations, {
  internalMutation,
  defaultBatchSize: 50,
  migrationsLocationPrefix: "migrations:",
});

export const backfillAreaConditions = migrations.define({
  table: "areas",
  migrateOne: async (ctx, area) => {
    await backfillAreaCondition(ctx as unknown as LegacyMigrationCtx, area);
  },
});

export const copyProjectsToThreads = migrations.define({
  table: "projects",
  migrateOne: async (ctx, project) => {
    await copyProjectToThread(ctx as unknown as LegacyMigrationCtx, project);
  },
});

export const copyProjectLogsToActivityLogs = migrations.define({
  table: "projectLogs",
  migrateOne: async (ctx, projectLog) => {
    await copyProjectLogToActivityLog(
      ctx as unknown as LegacyMigrationCtx,
      projectLog,
    );
  },
});

export const copyItemsToTasks = migrations.define({
  table: "items",
  migrateOne: async (ctx, item) => {
    await copyItemToTask(ctx as unknown as LegacyMigrationCtx, item);
  },
});

const allMigrations = [
  internal.migrations.backfillAreaConditions,
  internal.migrations.copyProjectsToThreads,
  internal.migrations.copyProjectLogsToActivityLogs,
  internal.migrations.copyItemsToTasks,
];

export const runAll = migrations.runner(allMigrations);

export const checkStatus = internalQuery({
  args: {},
  handler: async (ctx): Promise<MigrationStatus[]> => {
    return migrations.getStatus(ctx, {
      migrations: allMigrations,
    });
  },
});
