import type { ProjectedArea } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";

import { optimisticallyUpdateArea } from "@/features/areas/optimistic";

import type { AreaFormValue } from "./types";

export function useUpdateArea() {
  const navigate = useNavigate();
  const updateArea = useMutation(api.areas.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateArea(localStore, args);
    },
  );

  return async (area: ProjectedArea, value: AreaFormValue) => {
    const result = await updateArea({
      id: area._id,
      name: value.name,
      condition: value.condition,
      icon: value.icon,
    });

    if (value.name !== area.name && result?.slug) {
      navigate({
        to: "/$areaSlug",
        params: { areaSlug: result.slug },
        replace: true,
      });
    }
  };
}
