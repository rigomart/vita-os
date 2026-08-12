import type { AreaIcon } from "@convex/lib/areaIcons";
import type { ProjectedArea } from "@convex/lib/validators";

import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";

import {
  optimisticallyRemoveArea,
  optimisticallyUpdateArea,
} from "@/features/areas/optimistic";

import { AreaHeader } from "./area-header";

interface AreaHeaderProps {
  area: ProjectedArea;
  onEdit: () => void;
}

export function AreaHeaderSection({ area, onEdit }: AreaHeaderProps) {
  const navigate = useNavigate();
  const updateArea = useMutation(api.areas.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateArea(localStore, args);
    },
  );
  const removeArea = useMutation(api.areas.remove).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyRemoveArea(localStore, args);
    },
  );

  const handleDelete = async () => {
    await removeArea({ id: area._id });
    navigate({ to: "/" });
  };

  const handleConditionChange = (value: ProjectedArea["condition"]) => {
    updateArea({ id: area._id, condition: value });
  };

  const handleIconChange = async (icon: AreaIcon) => {
    await updateArea({ id: area._id, icon });
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
