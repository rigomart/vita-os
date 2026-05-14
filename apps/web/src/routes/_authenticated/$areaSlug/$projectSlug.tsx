import { api } from "@convex/_generated/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/error-boundary";
import { ActionQueue } from "@/features/projects/components/action-queue";
import { ProjectDefinitionSection } from "@/features/projects/components/project-definition-section";
import { ProjectDetailSkeleton } from "@/features/projects/components/project-detail-skeleton";
import { ProjectHeader } from "@/features/projects/components/project-header";
import { ProjectLifecycleActions } from "@/features/projects/components/project-lifecycle-actions";
import { ProjectLogSection } from "@/features/projects/components/project-log-section";
import { ProjectStatusCard } from "@/features/projects/components/project-status-card";
import { useProjectDetailMutations } from "@/features/projects/use-project-detail-mutations";
import { useStableQuery } from "@/hooks/use-stable-query";

export const Route = createFileRoute("/_authenticated/$areaSlug/$projectSlug")({
  errorComponent: RouteErrorFallback,
  component: AreaProjectDetailPage,
});

function AreaProjectDetailPage() {
  const { areaSlug, projectSlug } = Route.useParams();
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });

  const logs = useQuery(
    api.projectLogs.listByProject,
    project ? { projectId: project._id } : "skip",
  );

  const navigate = useNavigate();
  const { updateProject, removeProject, completeAction } =
    useProjectDetailMutations({ projectSlug });
  const createLog = useMutation(api.projectLogs.create);

  useEffect(() => {
    const title = project?.name
      ? `${project.name} | Vita OS`
      : "Project | Vita OS";
    document.title = title;
    return () => {
      document.title = "Vita OS";
    };
  }, [project?.name]);

  const isLoading = area === undefined || project === undefined;

  if (isLoading) {
    return <ProjectDetailSkeleton />;
  }

  if (area === null || project === null || project.areaId !== area._id) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <Link
          to="/$areaSlug"
          params={{ areaSlug }}
          className="mt-2 inline-block text-sm underline"
        >
          Back to area
        </Link>
      </div>
    );
  }

  const handleNameSave = async (name: string) => {
    if (!name) return;
    const result = await updateProject({ id: project._id, name });
    if (result?.slug) {
      navigate({
        to: "/$areaSlug/$projectSlug",
        params: { areaSlug, projectSlug: result.slug },
        replace: true,
      });
    }
  };

  const handleFieldSave = (
    field: "definitionOfDone" | "status",
    value: string,
  ) => {
    updateProject({
      id: project._id,
      [field]: value || null,
    });
  };

  const queue = project.actionQueue ?? [];

  const handleReorderQueue = (items: Array<{ id: string; text: string }>) => {
    updateProject({ id: project._id, actionQueue: items });
  };

  const handleEditQueueItem = (itemId: string, text: string) => {
    updateProject({
      id: project._id,
      actionQueue: queue.map((item) =>
        item.id === itemId ? { ...item, text } : item,
      ),
    });
  };

  const handleAddQueueItem = (text: string) => {
    updateProject({
      id: project._id,
      actionQueue: [...queue, { id: crypto.randomUUID(), text }],
    });
  };

  const handleRemoveQueueItem = (itemId: string) => {
    updateProject({
      id: project._id,
      actionQueue: queue.filter((item) => item.id !== itemId),
    });
  };

  const handleStateChange = (state: "completed" | "dropped") => {
    updateProject({ id: project._id, state });
    navigate({ to: "/$areaSlug", params: { areaSlug } });
  };

  const handleDelete = async () => {
    await removeProject({ id: project._id });
    navigate({ to: "/$areaSlug", params: { areaSlug } });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <ProjectHeader
        area={area}
        project={project}
        areaSlug={areaSlug}
        onNameSave={handleNameSave}
      />

      <ProjectStatusCard
        status={project.status}
        onSave={(value) => handleFieldSave("status", value)}
      />

      {/* Action Queue */}
      <ActionQueue
        items={queue}
        onComplete={() => completeAction({ id: project._id })}
        onReorder={handleReorderQueue}
        onEdit={handleEditQueueItem}
        onAdd={handleAddQueueItem}
        onRemove={handleRemoveQueueItem}
      />

      <ProjectDefinitionSection
        definitionOfDone={project.definitionOfDone}
        onSave={(value) => handleFieldSave("definitionOfDone", value)}
      />

      <ProjectLifecycleActions
        project={project}
        onStateChange={handleStateChange}
        onDelete={handleDelete}
      />

      <ProjectLogSection
        logs={logs}
        onCreateNote={async (content) => {
          await createLog({ projectId: project._id, content });
        }}
      />
    </div>
  );
}
