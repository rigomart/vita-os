import type { AreaId, AreaSummary } from "@vita-os/contracts";

/**
 * Where a stored Area becomes a Vita OS value.
 *
 * `user_id` is never selected: the owner is how a read is scoped, never
 * something a read hands back.
 */

export const AREA_COLUMNS = "id, name, slug, icon, sort_order, created_at";

export interface AreaRow {
  id: string;
  name: string;
  slug: string;
  icon: AreaSummary["icon"];
  sort_order: number;
  created_at: number;
}

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
