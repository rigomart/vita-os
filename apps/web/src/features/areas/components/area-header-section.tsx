import type { Doc } from "@convex/_generated/dataModel";
import type { AreaIcon } from "@convex/lib/areaIcons";

import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";

import {
  optimisticallyRemoveArea,
  optimisticallyUpdateArea,
} from "@/features/areas/optimistic";

import { AreaHeader } from "./area-header";

interface AreaHeaderProps {
  area: Doc<"areas">;
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

  const handleConditionChange = (value: Doc<"areas">["condition"]) => {
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
