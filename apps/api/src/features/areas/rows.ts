import type { AreaId, AreaSummary } from "@vita-os/contracts";

import { areas } from "../../platform/d1/schema";

/**
 * Where a stored Area becomes a Vita OS value.
 *
 * `user_id` is never selected: the owner is how a read is scoped, never
 * something a read hands back.
 */

export const AREA_FIELDS = {
  id: areas.id,
  name: areas.name,
  slug: areas.slug,
  icon: areas.icon,
  sort_order: areas.sort_order,
  created_at: areas.created_at,
};

export type AreaRow = Pick<typeof areas.$inferSelect, keyof typeof AREA_FIELDS>;

export function toAreaSummary(row: AreaRow): AreaSummary {
  return {
    _id: row.id as AreaId,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    order: row.sort_order,
    createdAt: row.created_at,
  };
}
