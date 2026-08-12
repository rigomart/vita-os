import type { Doc } from "@convex/_generated/dataModel";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyUpdateArea } from "@/features/areas/optimistic";

import { AreaStandardCard } from "./area-standard-card";

interface AreaStandardCardSectionProps {
  area: Doc<"areas">;
}

export function AreaStandardCardSection({
  area,
}: AreaStandardCardSectionProps) {
  const updateArea = useMutation(api.areas.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateArea(localStore, args);
    },
  );

  const handleSave = (standard: string) => {
    updateArea({
      id: area._id,
      standard: standard || null,
    });
  };

  return (
    <AreaStandardCard standard={area.standard ?? ""} onSave={handleSave} />
  );
}
