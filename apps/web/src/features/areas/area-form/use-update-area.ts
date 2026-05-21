import type { Doc } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";

import { optimisticallyUpdateArea } from "@/features/areas/optimistic";

import type { AreaFormValue } from "./types";

export function useUpdateArea(areaSlug: string) {
  const navigate = useNavigate();
  const updateArea = useMutation(api.areas.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateArea(localStore, args, { areaSlug });
    },
  );

  return async (area: Doc<"areas">, value: AreaFormValue) => {
    const result = await updateArea({
      id: area._id,
      name: value.name,
      standard: value.standard ?? null,
      condition: value.condition,
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
