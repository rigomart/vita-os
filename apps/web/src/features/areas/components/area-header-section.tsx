import type { AreaIcon, AreaSummary } from "@vita-os/contracts";

import { useNavigate } from "@tanstack/react-router";
import { useRemoveArea, useUpdateArea } from "@vita-os/application";

import { AreaHeader } from "./area-header";

interface AreaHeaderProps {
  area: AreaSummary;
  onEdit: () => void;
}

export function AreaHeaderSection({ area, onEdit }: AreaHeaderProps) {
  const navigate = useNavigate();
  const updateArea = useUpdateArea();
  const removeArea = useRemoveArea();

  const handleDelete = async () => {
    await removeArea.mutateAsync({ areaId: area._id });
    navigate({ to: "/" });
  };

  const handleConditionChange = (value: AreaSummary["condition"]) => {
    void updateArea.mutateAsync({ areaId: area._id, condition: value });
  };

  const handleIconChange = async (icon: AreaIcon) => {
    await updateArea.mutateAsync({ areaId: area._id, icon });
  };

  return (
    <AreaHeader
      area={area}
      onEdit={onEdit}
      onDelete={handleDelete}
      onConditionChange={handleConditionChange}
      onIconChange={handleIconChange}
    />
  );
}
