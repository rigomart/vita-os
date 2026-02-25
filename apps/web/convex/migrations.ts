import { internalMutation } from "./_generated/server";

/**
 * One-off migration: remove the deprecated `nextReviewDate` field from all
 * project documents so the field can be dropped from the schema.
 *
 * Run via dashboard or CLI:
 *   npx convex run migrations:removeNextReviewDate
 *
 * After confirming all documents are clean, remove `nextReviewDate` from
 * schema.ts and delete this file.
 */
export const removeNextReviewDate = internalMutation({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    let updated = 0;

    for (const project of projects) {
      if ("nextReviewDate" in project) {
        const { nextReviewDate: _, ...rest } = project as Record<
          string,
          unknown
        >;
        await ctx.db.replace(
          project._id,
          rest as Record<string, unknown> as typeof project,
        );
        updated++;
      }
    }

    return { updated, total: projects.length };
  },
});

/**
 * One-off migration: remove the deprecated `tags` field from all
 * project documents.
 *
 * Run via dashboard or CLI:
 *   npx convex run migrations:removeTags
 */
export const removeTags = internalMutation({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db.query("projects").collect();
    let updated = 0;

    for (const project of projects) {
      if ("tags" in project) {
        const { tags: _, ...rest } = project as Record<string, unknown>;
        await ctx.db.replace(
          project._id,
          rest as Record<string, unknown> as typeof project,
        );
        updated++;
      }
    }

    return { updated, total: projects.length };
  },
});
