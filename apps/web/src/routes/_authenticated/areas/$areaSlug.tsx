import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AreaFormDialog } from "@/components/areas/area-form-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectTimeline } from "@/components/projects/project-timeline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAreaMutations } from "@/hooks/use-area-mutations";
import { useProjectMutations } from "@/hooks/use-project-mutations";

export const Route = createFileRoute("/_authenticated/areas/$areaSlug")({
  component: AreaDetailPage,
});

const healthColors = {
  healthy: "bg-green-500",
  needs_attention: "bg-yellow-500",
  critical: "bg-red-500",
} as const;

function AreaDetailPage() {
  const { areaSlug } = Route.useParams();
  const area = useQuery(api.areas.getBySlug, { slug: areaSlug });
  const areas = useQuery(api.areas.list);
  const projects = useQuery(
    api.projects.listByArea,
    area ? { areaId: area._id } : "skip",
  );
  const { updateArea, removeArea } = useAreaMutations();
  const { createProject } = useProjectMutations();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);

  const isLoading = area === undefined || projects === undefined;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
    );
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

  const handleHealthChange = (
    value: "healthy" | "needs_attention" | "critical",
  ) => {
    updateArea({ id: area._id, healthStatus: value });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={area.name}
        backLink={{ label: "Home", to: "/" }}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowEdit(true)}
              aria-label="Edit area"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Delete area">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete area?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Projects in &ldquo;{area.name}&rdquo; will be unassigned but
                    not deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${healthColors[area.healthStatus]}`}
        />
        <Select value={area.healthStatus} onValueChange={handleHealthChange}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="healthy">Healthy</SelectItem>
            <SelectItem value="needs_attention">Needs attention</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {area.standard && (
        <div className="mb-6 rounded-md border p-4">
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Standard
          </h2>
          <p className="whitespace-pre-wrap text-sm">{area.standard}</p>
        </div>
      )}

      <Separator className="mb-4" />

      <ProjectTimeline projects={projects} />

      <div className="mt-4 mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium">Projects</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setShowCreateProject(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No projects in this area yet.
        </p>
      ) : (
        <div>
          {projects.map((project) => {
            const slug = project.slug ?? project._id;
            return (
              <Link
                key={project._id}
                to="/projects/$projectSlug"
                params={{ projectSlug: slug }}
                className="flex items-center gap-3 border-b py-3 transition-colors last:border-b-0 hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{project.name}</p>
                  {project.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <AreaFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        area={area}
        onSubmit={async (data) => {
          const result = await updateArea({
            id: area._id,
            name: data.name,
            standard: data.standard,
            clearStandard: !data.standard,
            healthStatus: data.healthStatus,
          });
          if (data.name !== area.name && result?.slug) {
            navigate({
              to: "/areas/$areaSlug",
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
          await createProject({
            ...data,
            areaId: (data.areaId ?? area._id) as Id<"areas">,
          });
        }}
      />
    </div>
  );
}
