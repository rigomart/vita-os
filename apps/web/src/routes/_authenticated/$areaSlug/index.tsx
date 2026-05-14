import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useEffect, useState } from "react";
import { RouteErrorFallback } from "@/components/error-boundary";
import { AreaDetailSkeleton } from "@/features/areas/components/area-detail-skeleton";
import { AreaFormDialog } from "@/features/areas/components/area-form-dialog";
import { AreaHeader } from "@/features/areas/components/area-header";
import { AreaProjectsSection } from "@/features/areas/components/area-projects-section";
import { AreaStandardCard } from "@/features/areas/components/area-standard-card";
import { useAreaDetailMutations } from "@/features/areas/use-area-detail-mutations";
import { ProjectFormDialog } from "@/features/projects/components/project-form-dialog";
import { useStableQuery } from "@/hooks/use-stable-query";

export const Route = createFileRoute("/_authenticated/$areaSlug/")({
  errorComponent: RouteErrorFallback,
  component: AreaDetailPage,
});

function AreaDetailPage() {
  const { areaSlug } = Route.useParams();
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });

  const areas = useQuery(api.areas.list);
  const projects = useQuery(
    api.projects.listByArea,
    area ? { areaId: area._id } : "skip",
  );
  const navigate = useNavigate();
  const { updateArea, removeArea, createProject, removeProject } =
    useAreaDetailMutations({ areaSlug, areaId: area?._id });
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  useEffect(() => {
    const title = area?.name ? `${area.name} | Vita OS` : "Area | Vita OS";
    document.title = title;
    return () => {
      document.title = "Vita OS";
    };
  }, [area?.name]);

  const isLoading = area === undefined || projects === undefined;

  if (isLoading) {
    return <AreaDetailSkeleton />;
  }

  if (area === null) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Area not found.</p>
        <Link to="/" className="mt-2 inline-block text-sm underline">
          Back to home
        </Link>
      </div>
    );
  }

  const handleDelete = async () => {
    await removeArea({ id: area._id });
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <AreaHeader
        area={area}
        projectCount={projects.length}
        onEdit={() => setShowEdit(true)}
        onDelete={handleDelete}
        onHealthChange={(healthStatus) =>
          updateArea({ id: area._id, healthStatus })
        }
      />

      <AreaStandardCard standard={area.standard} />

      <AreaProjectsSection
        areaSlug={areaSlug}
        projects={projects}
        onCreateProject={() => setShowCreateProject(true)}
        onRemoveProject={(projectId) => removeProject({ id: projectId })}
      />

      <AreaFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        area={area}
        onSubmit={async (data) => {
          const result = await updateArea({
            id: area._id,
            name: data.name,
            standard: data.standard || null,
            healthStatus: data.healthStatus,
          });
          if (data.name !== area.name && result?.slug) {
            navigate({
              to: "/$areaSlug",
              params: { areaSlug: result.slug },
              replace: true,
            });
          }
        }}
      />

      <ProjectFormDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        areas={areas ?? []}
        defaultAreaId={area._id}
        onSubmit={async (data) => {
          const { slug } = await createProject({
            ...data,
            areaId: (data.areaId ?? area._id) as Id<"areas">,
          });
          navigate({
            to: "/$areaSlug/$projectSlug",
            params: { areaSlug, projectSlug: slug },
          });
        }}
      />
    </div>
  );
}
