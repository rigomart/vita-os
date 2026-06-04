import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";

import { optimisticallyUpdateArea } from "@/features/areas/optimistic";
import { useStableQuery } from "@/hooks/use-stable-query";

import { AreaStandardCard } from "./area-standard-card";

interface AreaStandardCardSectionProps {
  areaSlug: string;
}

export function AreaStandardCardSection({
  areaSlug,
}: AreaStandardCardSectionProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const updateArea = useMutation(api.areas.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateArea(localStore, args, { areaSlug });
    },
  );

  if (!area) return null;

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
