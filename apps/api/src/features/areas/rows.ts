import type { AreaId, AreaSummary } from "@vita-os/contracts";

/**
 * Where a stored Area becomes a Vita OS value.
 *
 * SQL has no absent, only NULL, while the application boundary distinguishes a
 * saved value from an unset one, so a nullable column is read as an absent
 * property. `user_id` is never selected: the owner is how a read is scoped,
 * never something a read hands back.
 */

export const AREA_COLUMNS =
  "id, name, slug, standard, condition, icon, sort_order, created_at";

export interface AreaRow {
  id: string;
  name: string;
  slug: string;
  standard: string | null;
  condition: AreaSummary["condition"];
  icon: AreaSummary["icon"];
  sort_order: number;
  created_at: number;
}

export function toAreaSummary(row: AreaRow): AreaSummary {
  return {
    _id: row.id as AreaId,
    name: row.name,
    slug: row.slug,
    ...(row.standard === null ? {} : { standard: row.standard }),
    condition: row.condition,
    icon: row.icon,
    order: row.sort_order,
    createdAt: row.created_at,
  };
}
