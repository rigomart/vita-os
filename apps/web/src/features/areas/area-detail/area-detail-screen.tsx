import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";
import { EditAreaDialog } from "@/features/areas/area-form/edit-area-dialog";
import { AreaDetailSkeleton } from "@/features/areas/components/area-detail-skeleton";
import { AreaHeaderSection } from "@/features/areas/components/area-header-section";
import { AreaProjectsSection } from "@/features/areas/components/area-projects-section";
import { AreaStandardCardSection } from "@/features/areas/components/area-standard-card-section";
import { CreateProjectDialog } from "@/features/projects/project-form/create-project-dialog";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useStableQuery } from "@/hooks/use-stable-query";
import { AreaNotFound } from "./area-not-found";

interface AreaDetailScreenProps {
  areaSlug: string;
}

export function AreaDetailScreen({ areaSlug }: AreaDetailScreenProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const areas = useQuery(api.areas.list);
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  useDocumentTitle(area?.name ?? "Area");

  if (area === undefined) return <AreaDetailSkeleton />;
  if (area === null) return <AreaNotFound />;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <AreaHeaderSection areaSlug={areaSlug} onEdit={() => setShowEdit(true)} />

      <AreaStandardCardSection areaSlug={areaSlug} />

      <AreaProjectsSection
        areaSlug={areaSlug}
        onCreateProject={() => setShowCreateProject(true)}
      />

      <EditAreaDialog open={showEdit} onOpenChange={setShowEdit} area={area} />

      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        areas={areas ?? []}
        defaultAreaId={area._id}
        onCreated={({ slug }) => {
          navigate({
            to: "/$areaSlug/$projectSlug",
            params: { areaSlug, projectSlug: slug },
          });
        }}
      />
    </div>
  );
}
