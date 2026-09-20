import type { AreaSummary } from "@vita-os/contracts";

import { useUpdateArea } from "@vita-os/application";

import { AreaStandardCard } from "./area-standard-card";

interface AreaStandardCardSectionProps {
  area: AreaSummary;
}

export function AreaStandardCardSection({
  area,
}: AreaStandardCardSectionProps) {
  const updateArea = useUpdateArea();

  // An emptied card clears the Standard rather than storing blank text.
  const handleSave = (standard: string) => {
    void updateArea.mutateAsync({
      areaId: area._id,
      standard: standard || null,
    });
  };

  return (
    <AreaStandardCard standard={area.standard ?? ""} onSave={handleSave} />
  );
}
