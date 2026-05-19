import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import {
  optimisticallyRemoveArea,
  optimisticallyUpdateArea,
} from "@/features/areas/optimistic";
import { useStableQuery } from "@/hooks/use-stable-query";
import { AreaHeader } from "./area-header";

interface AreaHeaderProps {
  areaSlug: string;
  onEdit: () => void;
}

export function AreaHeaderSection({ areaSlug, onEdit }: AreaHeaderProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const projects = useQuery(
    api.projects.listByArea,
    area ? { areaId: area._id } : "skip",
  );
  const navigate = useNavigate();
  const updateArea = useMutation(api.areas.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateArea(localStore, args, { areaSlug });
    },
  );
  const removeArea = useMutation(api.areas.remove).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyRemoveArea(localStore, args, { areaSlug });
    },
  );

  const handleDelete = async () => {
    if (!area) return;
    await removeArea({ id: area._id });
    navigate({ to: "/" });
  };

  const handleConditionChange = (value: Doc<"areas">["healthStatus"]) => {
    if (!area) return;
    updateArea({ id: area._id, healthStatus: value });
  };

  if (!area) return null;

  return (
    <AreaHeader
      area={area}
      projectCount={projects?.length ?? 0}
      onEdit={onEdit}
      onDelete={handleDelete}
      onConditionChange={handleConditionChange}
    />
  );
}
