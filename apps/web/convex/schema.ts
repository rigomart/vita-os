import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  activityLogEntryTypeValidator,
  conditionValidator,
} from "./lib/validators";

const legacyMetadataValidators = {
  // Keep these until every deployed environment has run cutoverCleanup.
  // Existing migrated documents fail schema validation before cleanup can run
  // unless the final legacy metadata fields are temporarily accepted here.
  healthStatus: v.optional(v.string()),
  legacyProjectId: v.optional(v.string()),
  legacyItemId: v.optional(v.string()),
  legacyProjectLogId: v.optional(v.string()),
  migrationSourceKey: v.optional(v.string()),
};

export default defineSchema({
  areas: defineTable({
    userId: v.string(),
    name: v.string(),
    slug: v.optional(v.string()),
    standard: v.optional(v.string()),
    condition: conditionValidator,
    order: v.number(),
    createdAt: v.number(),
    ...legacyMetadataValidators,
  })
    .index("by_user", ["userId"])
    .index("by_user_order", ["userId", "order"])
    .index("by_user_slug", ["userId", "slug"]),

  threads: defineTable({
    userId: v.string(),
    title: v.string(),
    slug: v.optional(v.string()),
    summary: v.optional(v.string()),
    areaId: v.id("areas"),
    order: v.number(),
    state: v.union(v.literal("open"), v.literal("resolved")),
    nextMove: v.optional(v.string()),
    followUp: v.optional(v.number()),
    createdAt: v.number(),
    ...legacyMetadataValidators,
  })
    .index("by_user", ["userId"])
    .index("by_user_order", ["userId", "order"])
    .index("by_user_slug", ["userId", "slug"])
    .index("by_user_state", ["userId", "state"])
    .index("by_area", ["areaId"]),

  tasks: defineTable({
    userId: v.string(),
    text: v.string(),
    when: v.optional(v.number()),
    state: v.union(v.literal("open"), v.literal("done")),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    ...legacyMetadataValidators,
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_inbox", ["userId", "state", "createdAt"]),

  userSettings: defineTable({
    userId: v.string(),
    lastReviewDate: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  activityLogs: defineTable({
    userId: v.string(),
    threadId: v.id("threads"),
    type: activityLogEntryTypeValidator,
    content: v.string(),
    previousValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    createdAt: v.number(),
    ...legacyMetadataValidators,
  }).index("by_thread", ["threadId", "createdAt"]),
});
