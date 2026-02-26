import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  areas: defineTable({
    userId: v.string(),
    name: v.string(),
    slug: v.optional(v.string()),
    standard: v.optional(v.string()),
    healthStatus: v.union(
      v.literal("healthy"),
      v.literal("needs_attention"),
      v.literal("critical"),
    ),
    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_order", ["userId", "order"])
    .index("by_user_slug", ["userId", "slug"]),

  projects: defineTable({
    userId: v.string(),
    name: v.string(),
    slug: v.optional(v.string()),
    definitionOfDone: v.optional(v.string()),
    areaId: v.id("areas"),
    order: v.number(),
    state: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("dropped"),
    ),
    status: v.optional(v.string()),
    // Deprecated — being replaced by actionQueue, kept temporarily for migration
    nextAction: v.optional(v.string()),
    actionQueue: v.optional(
      v.array(v.object({ id: v.string(), text: v.string() })),
    ),
    // Deprecated — being removed, kept temporarily for migration
    nextReviewDate: v.optional(v.number()),
    // Phase 2 fields
    actionDate: v.optional(v.number()),
    targetDate: v.optional(v.number()),
    waitingOn: v.optional(v.string()),
    waitingSince: v.optional(v.number()),
    waitingExpectedDate: v.optional(v.number()),
    waitingFollowUpDate: v.optional(v.number()),
    // Deprecated — being removed, kept temporarily for migration
    tags: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_order", ["userId", "order"])
    .index("by_user_slug", ["userId", "slug"])
    .index("by_user_state", ["userId", "state"])
    .index("by_area", ["areaId"]),

  items: defineTable({
    userId: v.string(),
    text: v.string(),
    date: v.optional(v.number()),
    isCompleted: v.boolean(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_user_inbox", ["userId", "isCompleted", "createdAt"]),

  // Deprecated — being replaced by items, kept temporarily for migration
  captures: defineTable({
    userId: v.string(),
    text: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),

  userSettings: defineTable({
    userId: v.string(),
    lastReviewDate: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  projectLogs: defineTable({
    userId: v.string(),
    projectId: v.id("projects"),
    type: v.union(
      v.literal("note"),
      v.literal("status_change"),
      v.literal("next_action_change"),
      v.literal("state_change"),
      v.literal("decision"),
      v.literal("reference"),
      v.literal("waiting_change"),
    ),
    content: v.string(),
    previousValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_project", ["projectId", "createdAt"]),
});
