import type { AreaDetail, AreaSummary } from "@vita-os/contracts";

import {
  commandAcknowledged,
  type CommandAcknowledgement,
} from "@vita-os/contracts";
import { ConflictError, generateSlug, validateAreaName } from "@vita-os/core";

import type { WorkerEnv } from "./env";
import type { AreaRow, ThreadRow } from "./rows";
import type { Actored, AreaStore, StoreClock, StoreResult } from "./store";

import { AREA_COLUMNS, THREAD_COLUMNS, toAreaSummary, toThread } from "./rows";
import { conflicted, found, notFound } from "./store";

/**
 * How many times a create or rename re-mints a slug before giving up.
 *
 * Slugs carry eight hex characters of randomness and are unique per owner, so a
 * collision is already improbable; retrying twice makes it unreachable in
 * practice without leaving the uniqueness invariant to chance.
 */
const SLUG_ATTEMPTS = 3;

function isUniqueSlugViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed: areas\.user_id, areas\.slug/.test(error.message)
  );
}

export class D1AreaStore implements AreaStore {
  constructor(
    private readonly database: WorkerEnv["DB"],
    private readonly clock: StoreClock,
  ) {}

  async listAreas(input: Actored): Promise<AreaSummary[]> {
    const result = await this.database
      .prepare(
        `SELECT ${AREA_COLUMNS}
         FROM areas
         WHERE user_id = ?
         ORDER BY sort_order ASC, id ASC`,
      )
      .bind(input.actorId)
      .all<AreaRow>();

    return result.results.map(toAreaSummary);
  }

  /**
   * The Area page in one read: the Area, plus its Open Threads in the creation
   * order the Area inventory has always used.
   */
  async getAreaDetail(
    input: Actored<{ slug: string }>,
  ): Promise<StoreResult<AreaDetail>> {
    const area = await this.database
      .prepare(
        `SELECT ${AREA_COLUMNS}
         FROM areas
         WHERE user_id = ? AND slug = ?
         LIMIT 1`,
      )
      .bind(input.actorId, input.slug)
      .first<AreaRow>();
    if (area === null) return notFound;

    const threads = await this.database
      .prepare(
        `SELECT ${THREAD_COLUMNS}
         FROM threads
         WHERE user_id = ? AND area_id = ? AND state = 'open'
         ORDER BY created_at ASC, id ASC`,
      )
      .bind(input.actorId, area.id)
      .all<ThreadRow>();

    return found({
      area: toAreaSummary(area),
      threads: threads.results.map(toThread),
    });
  }

  async createArea(
    input: Actored<{
      name: string;
      standard?: string;
      condition: AreaSummary["condition"];
      icon: AreaSummary["icon"];
    }>,
  ): Promise<StoreResult<AreaSummary>> {
    const name = validateAreaName(input.name);
    const createdAt = this.clock.now();

    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      try {
        // The manual order is chosen inside the insert, so two areas created at
        // once cannot claim the same position.
        const row = await this.database
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
            this.clock.newId(),
            input.actorId,
            name,
            generateSlug(name),
            input.standard ?? null,
            input.condition,
            input.icon,
            createdAt,
            input.actorId,
          )
          .first<AreaRow>();
        if (row === null) return conflicted;

        return found(toAreaSummary(row));
      } catch (error) {
        if (!isUniqueSlugViolation(error)) throw error;
      }
    }

    return conflicted;
  }

  /**
   * Rename, restandardize, recondition, or re-icon an Area. A rename mints a new
   * slug, so the caller reads the slug back rather than assuming its own route
   * still resolves.
   */
  async updateArea(
    input: Actored<{
      areaId: string;
      name?: string;
      standard?: string | null;
      condition?: AreaSummary["condition"];
      icon?: AreaSummary["icon"];
    }>,
  ): Promise<StoreResult<AreaSummary>> {
    const existing = await this.database
      .prepare(
        `SELECT ${AREA_COLUMNS}
         FROM areas
         WHERE user_id = ? AND id = ?
         LIMIT 1`,
      )
      .bind(input.actorId, input.areaId)
      .first<AreaRow>();
    if (existing === null) return notFound;

    const name =
      input.name === undefined ? undefined : validateAreaName(input.name);
    const renamed = name !== undefined && name !== existing.name;

    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
      const assignments: string[] = [];
      const binds: (string | number | null)[] = [];
      if (name !== undefined) {
        assignments.push("name = ?");
        binds.push(name);
      }
      if (renamed) {
        assignments.push("slug = ?");
        binds.push(generateSlug(name as string));
      }
      if (input.standard !== undefined) {
        assignments.push("standard = ?");
        binds.push(input.standard);
      }
      if (input.condition !== undefined) {
        assignments.push("condition = ?");
        binds.push(input.condition);
      }
      if (input.icon !== undefined) {
        assignments.push("icon = ?");
        binds.push(input.icon);
      }
      if (assignments.length === 0) return found(toAreaSummary(existing));

      try {
        const row = await this.database
          .prepare(
            `UPDATE areas
             SET ${assignments.join(", ")}
             WHERE user_id = ? AND id = ?
             RETURNING ${AREA_COLUMNS}`,
          )
          .bind(...binds, input.actorId, input.areaId)
          .first<AreaRow>();
        if (row === null) return notFound;

        return found(toAreaSummary(row));
      } catch (error) {
        if (!isUniqueSlugViolation(error)) throw error;
      }
    }

    return conflicted;
  }

  /**
   * Delete an empty Area. Threads of any state block the deletion: an Area is
   * where Threads live, and removing it would strand them.
   */
  async removeArea(
    input: Actored<{ areaId: string }>,
  ): Promise<StoreResult<CommandAcknowledgement>> {
    const removed = await this.database
      .prepare(
        `DELETE FROM areas
         WHERE user_id = ? AND id = ?
           AND NOT EXISTS (SELECT 1 FROM threads WHERE area_id = areas.id)
         RETURNING id`,
      )
      .bind(input.actorId, input.areaId)
      .first<{ id: string }>();
    if (removed === null) {
      const area = await this.database
        .prepare("SELECT id FROM areas WHERE user_id = ? AND id = ? LIMIT 1")
        .bind(input.actorId, input.areaId)
        .first<{ id: string }>();
      if (area === null) return notFound;

      throw new ConflictError(
        "Cannot delete an area that has threads. Move or delete the threads first.",
      );
    }

    return found(commandAcknowledged);
  }
}
