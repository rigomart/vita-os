import type { AreaIcon, AreaSummary } from "@vita-os/contracts";

import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import type { RequestScope } from "../../platform/request-scope";

import { areas, threads } from "../../platform/d1/schema";
import { isUniqueViolation } from "../../platform/d1/statements";
import { AREA_FIELDS, toAreaSummary } from "./rows";

/** What an Area change writes. An absent field is left alone. */
export interface AreaChanges {
  name?: string;
  slug?: string;
  icon?: AreaIcon;
}

/** A create or rename lost its slug to another of the owner's Areas. */
export function isAreaSlugTaken(error: unknown): boolean {
  return isUniqueViolation(error, "areas.user_id, areas.slug");
}

/**
 * The owner's Areas, one D1 round trip per function.
 * Every statement is scoped by the owner, so missing and foreign Areas read alike.
 */
export function areaStorage({ db, clock, actorId }: RequestScope) {
  const database = drizzle(db);
  const owned = eq(areas.user_id, actorId);

  return {
    async list(): Promise<AreaSummary[]> {
      const rows = await database
        .select(AREA_FIELDS)
        .from(areas)
        .where(owned)
        .orderBy(asc(areas.sort_order), asc(areas.id));
      return rows.map(toAreaSummary);
    },

    async find(areaId: string): Promise<AreaSummary | null> {
      const [row] = await database
        .select(AREA_FIELDS)
        .from(areas)
        .where(and(owned, eq(areas.id, areaId)))
        .limit(1);
      return row === undefined ? null : toAreaSummary(row);
    },

    /** Choose the next manual position inside the insert, including concurrent captures. */
    async insert(area: {
      name: string;
      slug: string;
      icon: AreaIcon;
    }): Promise<AreaSummary | null> {
      const [row] = await database
        .insert(areas)
        .values({
          id: clock.newId(),
          user_id: actorId,
          ...area,
          sort_order: sql`(SELECT COALESCE(MAX(sort_order) + 1, 0) FROM areas WHERE user_id = ${actorId})`,
          created_at: clock.now(),
        })
        .returning(AREA_FIELDS);
      return row === undefined ? null : toAreaSummary(row);
    },

    /** Guard a change by the name it was decided against. */
    async update(
      areaId: string,
      expectedName: string,
      changes: AreaChanges,
    ): Promise<AreaSummary | null> {
      const [row] = await database
        .update(areas)
        .set(changes)
        .where(and(owned, eq(areas.id, areaId), eq(areas.name, expectedName)))
        .returning(AREA_FIELDS);
      return row === undefined ? null : toAreaSummary(row);
    },

    /** The caller checked that this list names every owned Area exactly once. */
    async reorder(areaIds: readonly string[]): Promise<void> {
      const firstId = areaIds[0];
      if (firstId === undefined) return;
      const position = (areaId: string, sort_order: number) =>
        database
          .update(areas)
          .set({ sort_order })
          .where(and(owned, eq(areas.id, areaId)));
      await database.batch([
        position(firstId, 0),
        ...areaIds.slice(1).map((areaId, index) => position(areaId, index + 1)),
      ]);
    },

    /** Clear labels and delete atomically, leaving Thread revisions and activity alone. */
    async removeClearingLabels(areaId: string): Promise<boolean> {
      const [, removal] = await database.batch([
        database
          .update(threads)
          .set({ area_id: null })
          .where(
            and(eq(threads.user_id, actorId), eq(threads.area_id, areaId)),
          ),
        database.delete(areas).where(and(owned, eq(areas.id, areaId))),
      ]);
      return removal.meta.changes > 0;
    },
  };
}
