import type { AreaSummary } from "@vita-os/contracts";

import { useNavigate } from "@tanstack/react-router";
import { useUpdateArea as useUpdateAreaCommand } from "@vita-os/application";

import type { AreaFormValue } from "./types";

/**
 * Save the Area form. Renaming mints a new slug, so the route follows the slug
 * the service chose rather than the placeholder the optimistic change showed.
 */
export function useUpdateArea() {
  const navigate = useNavigate();
  const updateArea = useUpdateAreaCommand();

  return async (area: AreaSummary, value: AreaFormValue) => {
    const saved = await updateArea.mutateAsync({
      areaId: area._id,
      name: value.name,
      condition: value.condition,
      icon: value.icon,
    });

    if (value.name !== area.name) {
      navigate({
        to: "/$areaSlug",
        params: { areaSlug: saved.slug },
        replace: true,
      });
    }
  };
}
