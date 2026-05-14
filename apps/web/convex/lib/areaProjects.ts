import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";

type MutationCtx = GenericMutationCtx<DataModel>;

export function areaBelongsToUser(
  area: Doc<"areas"> | null,
  userId: string,
): area is Doc<"areas"> {
  return area !== null && area.userId === userId;
}

export function getAreaDeletionBlocker(
  projects: Array<Doc<"projects">>,
): Doc<"projects"> | null {
  return projects[0] ?? null;
}

export async function getAreaForUser(
  ctx: MutationCtx,
  args: { userId: string; areaId: Id<"areas"> },
): Promise<Doc<"areas">> {
  const area = await ctx.db.get(args.areaId);
  if (!areaBelongsToUser(area, args.userId)) {
    throw new Error("Area not found");
  }
  return area;
}

export async function listProjectsInAreaForUser(
  ctx: MutationCtx,
  args: { userId: string; areaId: Id<"areas"> },
): Promise<Array<Doc<"projects">>> {
  const projects = await ctx.db
    .query("projects")
    .withIndex("by_area", (q) => q.eq("areaId", args.areaId))
    .collect();

  return projects.filter((project) => project.userId === args.userId);
}

export async function assertAreaCanBeDeleted(
  ctx: MutationCtx,
  args: { userId: string; areaId: Id<"areas"> },
): Promise<void> {
  const projects = await listProjectsInAreaForUser(ctx, args);
  if (getAreaDeletionBlocker(projects)) {
    throw new Error(
      "Cannot delete an area that has projects. Move or delete the projects first.",
    );
  }
}
