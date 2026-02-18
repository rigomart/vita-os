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
    areaId: v.optional(v.id("areas")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    order: v.number(),
    isArchived: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_order", ["userId", "order"])
    .index("by_user_slug", ["userId", "slug"])
    .index("by_area", ["areaId"]),

  tasks: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    isCompleted: v.boolean(),
    dueDate: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
    order: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_order", ["userId", "order"])
    .index("by_project", ["projectId"]),
});
