import type {
  AreaDetail,
  AreaIcon,
  AreaSummary,
  Condition,
} from "@vita-os/contracts";

import type { RequestScope } from "../../platform/request-scope";
import type { ThreadRow } from "../threads/rows";
import type { AreaRow } from "./rows";

import { isUniqueViolation, setClause } from "../../platform/d1/statements";
import { THREAD_COLUMNS, toThread } from "../threads/rows";
import { AREA_COLUMNS, toAreaSummary } from "./rows";

/** What an Area change writes. An absent field is left alone. */
export interface AreaChanges {
  name?: string;
  slug?: string;
  standard?: string | null;
  condition?: Condition;
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
     * The Area page in one batch: the Area, plus its Open Threads in the
     * creation order the Area inventory has always used.
     */
    async findDetail(slug: string): Promise<AreaDetail | null> {
      const [area, threads] = await db.batch([
        db
          .prepare(
            `SELECT ${AREA_COLUMNS}
             FROM areas
             WHERE user_id = ? AND slug = ?
             LIMIT 1`,
          )
          .bind(actorId, slug),
        db
          .prepare(
            `SELECT ${THREAD_COLUMNS}
             FROM threads
             WHERE user_id = ? AND state = 'open'
               AND area_id = (SELECT id FROM areas WHERE user_id = ? AND slug = ?)
             ORDER BY created_at ASC, id ASC`,
          )
          .bind(actorId, actorId, slug),
      ]);
      const areaRow = area.results.at(0) as AreaRow | undefined;
      if (areaRow === undefined) return null;

      return {
        area: toAreaSummary(areaRow),
        threads: (threads.results as ThreadRow[]).map(toThread),
      };
    },

    /**
     * The manual order is chosen inside the insert, so two Areas created at
     * once cannot claim the same position. Throws when the slug is taken.
     */
    async insert(area: {
      name: string;
      slug: string;
      standard?: string;
      condition: Condition;
      icon: AreaIcon;
    }): Promise<AreaSummary | null> {
      const row = await db
        .prepare(
          `INSERT INTO areas (
             id, user_id, name, slug, standard, condition, icon, sort_order,
             created_at
           )
           SELECT ?, ?, ?, ?, ?, ?, ?, COALESCE(MAX(sort_order) + 1, 0), ?
           FROM areas
           WHERE user_id = ?
           RETURNING ${AREA_COLUMNS}`,
        )
        .bind(
          clock.newId(),
          actorId,
          area.name,
          area.slug,
          area.standard ?? null,
          area.condition,
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
        standard: changes.standard,
        condition: changes.condition,
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

    /** Delete the Area only while no Thread of any state is filed under it. */
    async removeIfEmpty(areaId: string): Promise<boolean> {
      const removed = await db
        .prepare(
          `DELETE FROM areas
           WHERE user_id = ? AND id = ?
             AND NOT EXISTS (SELECT 1 FROM threads WHERE area_id = areas.id)
           RETURNING id`,
        )
        .bind(actorId, areaId)
        .first<{ id: string }>();

      return removed !== null;
    },

    async exists(areaId: string): Promise<boolean> {
      const area = await db
        .prepare("SELECT id FROM areas WHERE user_id = ? AND id = ? LIMIT 1")
        .bind(actorId, areaId)
        .first<{ id: string }>();

      return area !== null;
    },
  };
}
