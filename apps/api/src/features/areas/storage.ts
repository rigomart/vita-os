import type { AreaIcon, AreaSummary } from "@vita-os/contracts";

import type { RequestScope } from "../../platform/request-scope";
import type { AreaRow } from "./rows";

import { isUniqueViolation, setClause } from "../../platform/d1/statements";
import { AREA_COLUMNS, toAreaSummary } from "./rows";

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
 *
 * Every statement is scoped by the owner, so a missing Area and somebody
 * else's Area read the same: `null`.
 */
export function areaStorage({ db, clock, actorId }: RequestScope) {
  return {
    async list(): Promise<AreaSummary[]> {
      const result = await db
        .prepare(
          `SELECT ${AREA_COLUMNS}
           FROM areas
           WHERE user_id = ?
           ORDER BY sort_order ASC, id ASC`,
        )
        .bind(actorId)
        .all<AreaRow>();

      return result.results.map(toAreaSummary);
    },

    async find(areaId: string): Promise<AreaSummary | null> {
      const row = await db
        .prepare(
          `SELECT ${AREA_COLUMNS}
           FROM areas
           WHERE user_id = ? AND id = ?
           LIMIT 1`,
        )
        .bind(actorId, areaId)
        .first<AreaRow>();

      return row === null ? null : toAreaSummary(row);
    },

    /**
     * The manual order is chosen inside the insert, so two Areas created at
     * once cannot claim the same position. Throws when the slug is taken.
     */
    async insert(area: {
      name: string;
      slug: string;
      icon: AreaIcon;
    }): Promise<AreaSummary | null> {
      const row = await db
        .prepare(
          `INSERT INTO areas (id, user_id, name, slug, icon, sort_order, created_at)
           SELECT ?, ?, ?, ?, ?, COALESCE(MAX(sort_order) + 1, 0), ?
           FROM areas
           WHERE user_id = ?
           RETURNING ${AREA_COLUMNS}`,
        )
        .bind(
          clock.newId(),
          actorId,
          area.name,
          area.slug,
          area.icon,
          clock.now(),
          actorId,
        )
        .first<AreaRow>();

      return row === null ? null : toAreaSummary(row);
    },

    /**
     * Write a change decided against the Area as it was read. `null` means the
     * Area is gone or was renamed since; throws when a new slug is taken.
     */
    async update(
      areaId: string,
      expectedName: string,
      changes: AreaChanges,
    ): Promise<AreaSummary | null> {
      const set = setClause({
        name: changes.name,
        slug: changes.slug,
        icon: changes.icon,
      });
      const row = await db
        .prepare(
          `UPDATE areas
           SET ${set.sql}
           WHERE user_id = ? AND id = ? AND name = ?
           RETURNING ${AREA_COLUMNS}`,
        )
        .bind(...set.binds, actorId, areaId, expectedName)
        .first<AreaRow>();

      return row === null ? null : toAreaSummary(row);
    },

    /**
     * Write the owner's Area order, one position per Area in list order. The
     * caller has checked that the list names every Area exactly once.
     */
    async reorder(areaIds: readonly string[]): Promise<void> {
      if (areaIds.length === 0) return;

      await db.batch(
        areaIds.map((areaId, position) =>
          db
            .prepare(
              "UPDATE areas SET sort_order = ? WHERE user_id = ? AND id = ?",
            )
            .bind(position, actorId, areaId),
        ),
      );
    },

    /**
     * Delete the Area and take its label off every Thread that carries it, open
     * or resolved, in one batch. The Threads are otherwise untouched: the label
     * disappearing is not a change the user made to each of them, so no
     * revision moves and no Activity Log entry is written. `false` means there
     * was no such Area.
     */
    async removeClearingLabels(areaId: string): Promise<boolean> {
      const [, removal] = await db.batch([
        db
          .prepare(
            "UPDATE threads SET area_id = NULL WHERE user_id = ? AND area_id = ?",
          )
          .bind(actorId, areaId),
        db
          .prepare("DELETE FROM areas WHERE user_id = ? AND id = ?")
          .bind(actorId, areaId),
      ]);

      return removal.meta.changes > 0;
    },
  };
}
