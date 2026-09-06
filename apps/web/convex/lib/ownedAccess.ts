import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";

import type { DataModel, Doc, Id } from "../_generated/dataModel";

/**
 * The single way Convex functions read a document that belongs to one user.
 *
 * Every table in this schema stores its owner in `userId`. Reading such a
 * document through this module means the ownership check cannot be forgotten:
 * there is no accessor here that returns a document without comparing its
 * owner to the caller.
 */

/** Tables whose documents belong to exactly one user through `userId`. */
export type OwnedTable = "activityLogs" | "areas" | "tasks" | "threads";

/**
 * Owned tables that also carry a user-scoped `slug` and a `by_user_slug`
 * index. Notes and activity logs have no slug, so they cannot be looked up
 * by one.
 */
export type SluggedTable = "areas" | "threads";

type ReadCtx = GenericMutationCtx<DataModel> | GenericQueryCtx<DataModel>;

/**
 * Mirrors Convex's own guard on `db.get(table, id)`. Wrapping the type
 * parameter in a conditional makes the `id` argument a non-inference site, so
 * `Table` is fixed by the `table` argument alone. Without it, passing a Thread
 * id alongside `"areas"` would compile by widening `Table` to a union.
 */
type NonUnion<T> = T extends never ? never : T;

/**
 * Every owned table has a `userId`, but TypeScript cannot see through a
 * still-generic table name to prove it, so state it.
 */
type OwnedDoc<Table extends OwnedTable> = Doc<Table> & { userId: string };

/** Fails to compile when its argument is `false`. */
type AssertTrue<Assertion extends true> = Assertion;

/**
 * Compile-time proof of what `OwnedDoc` above asserts. Adding a table without
 * a `userId` field to `OwnedTable` breaks this line rather than leaving the
 * cast to fail silently at runtime.
 */
export type EveryOwnedDocHasUserId = AssertTrue<
  Doc<OwnedTable> extends { userId: string } ? true : false
>;

/** Names used in the "<label> not found" errors thrown by `requireOwned`. */
const DOCUMENT_LABELS: Record<OwnedTable, string> = {
  activityLogs: "Activity log",
  areas: "Area",
  tasks: "Note",
  threads: "Thread",
};

/**
 * Read an owned document, or `null` when it is missing or owned by someone
 * else. Queries use this so a foreign id is indistinguishable from a
 * nonexistent one.
 */
export async function getOwned<Table extends OwnedTable>(
  ctx: ReadCtx,
  table: Table,
  args: { userId: string; id: Id<NonUnion<Table>> },
): Promise<Doc<Table> | null> {
  const doc = (await ctx.db.get(table, args.id)) as OwnedDoc<Table> | null;
  if (!doc || doc.userId !== args.userId) return null;
  return doc;
}

/**
 * Read an owned document, or throw `"<Label> not found"`. Mutations use this
 * so a foreign id fails exactly like a missing one, leaking nothing about
 * another user's data.
 */
export async function requireOwned<Table extends OwnedTable>(
  ctx: ReadCtx,
  table: Table,
  args: { userId: string; id: Id<NonUnion<Table>> },
): Promise<Doc<Table>> {
  const doc = await getOwned(ctx, table, args);
  if (!doc) {
    throw new Error(`${DOCUMENT_LABELS[table]} not found`);
  }
  return doc;
}

/**
 * Read an owned document by its user-scoped slug, or `null` when the user has
 * no document with that slug.
 *
 * Slugs are generated, not enforced unique, so a user can end up with two
 * documents sharing one. This resolves to the oldest match — `by_user_slug`
 * orders equal keys by creation time — rather than failing the whole request
 * the way a uniqueness assertion would.
 */
export async function getOwnedBySlug<Table extends SluggedTable>(
  ctx: ReadCtx,
  table: Table,
  args: { userId: string; slug: string },
): Promise<Doc<Table> | null> {
  // Convex types an index range against one named table, so the two slugged
  // tables are spelled out. The `assertNever` arm makes a third member of
  // `SluggedTable` a compile error instead of a silent fall-through.
  let match: Doc<"areas"> | Doc<"threads"> | null;
  if (table === "areas") {
    match = await ctx.db
      .query("areas")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", args.userId).eq("slug", args.slug),
      )
      .first();
  } else if (table === "threads") {
    match = await ctx.db
      .query("threads")
      .withIndex("by_user_slug", (q) =>
        q.eq("userId", args.userId).eq("slug", args.slug),
      )
      .first();
  } else {
    assertNever(table);
  }

  // Narrowing `table` does not narrow `Table`, hence the cast on the way out.
  return match as Doc<Table> | null;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled slugged table: ${String(value)}`);
}
