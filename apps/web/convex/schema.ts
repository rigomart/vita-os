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
    description: v.optional(v.string()),
    definitionOfDone: v.optional(v.string()),
    areaId: v.id("areas"),
    order: v.number(),
    state: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("dropped"),
    ),
    status: v.optional(v.string()),
    nextAction: v.optional(v.string()),
    nextReviewDate: v.optional(v.number()),
    // Phase 2 fields
    actionDate: v.optional(v.number()),
    targetDate: v.optional(v.number()),
    waitingOn: v.optional(v.string()),
    waitingSince: v.optional(v.number()),
    waitingExpectedDate: v.optional(v.number()),
    waitingFollowUpDate: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_order", ["userId", "order"])
    .index("by_user_slug", ["userId", "slug"])
    .index("by_area", ["areaId"]),

  captures: defineTable({
    userId: v.string(),
    text: v.string(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),

  projectLogs: defineTable({
    userId: v.string(),
    projectId: v.id("projects"),
    type: v.literal("note"),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_project", ["projectId", "createdAt"]),
});
