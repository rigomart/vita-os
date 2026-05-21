import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  type Condition,
  DEFAULT_CONDITION,
  isCondition,
} from "./lib/condition";

const legacyMetadataFields = [
  "healthStatus",
  "legacyProjectId",
  "legacyItemId",
  "legacyProjectLogId",
  "migrationSourceKey",
] as const;

type LegacyMetadataField = (typeof legacyMetadataFields)[number];
type CleanupPatch = Partial<Record<LegacyMetadataField, undefined>> & {
  condition?: Condition;
};

export const removeLegacyMetadata = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const stats = {
      areas: 0,
      threads: 0,
      tasks: 0,
      activityLogs: 0,
    };

    for (const area of await ctx.db.query("areas").collect()) {
      const patch = buildLegacyMetadataPatch(area);
      const record = area as Record<string, unknown>;
      if (!isCondition(record.condition)) {
        patch.condition = isCondition(record.healthStatus)
          ? record.healthStatus
          : DEFAULT_CONDITION;
      }
      if (Object.keys(patch).length > 0) {
        stats.areas += 1;
        if (!dryRun) {
          await ctx.db.patch(area._id, patch as never);
        }
      }
    }

    for (const thread of await ctx.db.query("threads").collect()) {
      const patch = buildLegacyMetadataPatch(thread);
      if (Object.keys(patch).length > 0) {
        stats.threads += 1;
        if (!dryRun) {
          await ctx.db.patch(thread._id, patch as never);
        }
      }
    }

    for (const task of await ctx.db.query("tasks").collect()) {
      const patch = buildLegacyMetadataPatch(task);
      if (Object.keys(patch).length > 0) {
        stats.tasks += 1;
        if (!dryRun) {
          await ctx.db.patch(task._id, patch as never);
        }
      }
    }

    for (const activityLog of await ctx.db.query("activityLogs").collect()) {
      const patch = buildLegacyMetadataPatch(activityLog);
      if (Object.keys(patch).length > 0) {
        stats.activityLogs += 1;
        if (!dryRun) {
          await ctx.db.patch(activityLog._id, patch as never);
        }
      }
    }

    return { dryRun, ...stats };
  },
});

function buildLegacyMetadataPatch(record: object): CleanupPatch {
  const patch: CleanupPatch = {};
  for (const field of legacyMetadataFields) {
    if (field in record) {
      patch[field] = undefined;
    }
  }
  return patch;
}
