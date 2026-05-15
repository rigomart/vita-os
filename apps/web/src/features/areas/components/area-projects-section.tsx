import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
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
} from "@vita-os/ui/components/alert-dialog";
import { Button } from "@vita-os/ui/components/button";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { ArrowRight, FolderOpen, Plus, Trash2 } from "lucide-react";
import { optimisticallyRemoveProject } from "@/features/projects/optimistic";
import { useStableQuery } from "@/hooks/use-stable-query";

interface AreaProjectsSectionProps {
  areaSlug: string;
  onCreateProject: () => void;
}

export function AreaProjectsSection({
  areaSlug,
  onCreateProject,
}: AreaProjectsSectionProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const projects = useQuery(
    api.projects.listByArea,
    area ? { areaId: area._id } : "skip",
  );
  const removeProject = useMutation(api.projects.remove).withOptimisticUpdate(
    (localStore, args) => {
      if (!area) return;
      optimisticallyRemoveProject(localStore, args, { areaId: area._id });
    },
  );

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-3">
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-medium">Projects</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={onCreateProject}
        >
          <Plus className="h-3.5 w-3.5" />
          New project
        </Button>
      </div>

      {projects && projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-10 text-center">
          <FolderOpen className="mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="mb-4 max-w-xs text-sm text-muted-foreground">
            No projects in this area yet.
          </p>
          <Button variant="outline" size="sm" onClick={onCreateProject}>
            Create project
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border/50 rounded-xl border border-border-subtle bg-surface-2">
          {(projects ?? []).map((project) => (
            <AreaProjectRow
              key={project._id}
              areaSlug={areaSlug}
              project={project}
              onRemoveProject={(projectId) => removeProject({ id: projectId })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AreaProjectRow({
  areaSlug,
  project,
  onRemoveProject,
}: {
  areaSlug: string;
  project: Doc<"projects">;
  onRemoveProject: (projectId: Id<"projects">) => void;
}) {
  const slug = project.slug ?? project._id;

  return (
    <div className="group flex items-center first:rounded-t-xl last:rounded-b-xl">
      <Link
        to="/$areaSlug/$projectSlug"
        params={{ areaSlug, projectSlug: slug }}
        className="flex min-w-0 flex-1 items-start gap-4 px-4 py-4 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-surface-3/60"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{project.name}</p>
          </div>
          <AreaProjectSubtitle project={project} />
        </div>
      </Link>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="mr-2 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Delete project"
            />
          }
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{project.name}&rdquo; will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onRemoveProject(project._id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AreaProjectSubtitle({ project }: { project: Doc<"projects"> }) {
  const nextAction = project.actionQueue?.[0]?.text;

  if (nextAction) {
    return (
      <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
        <ArrowRight className="h-3 w-3 shrink-0" />
        {nextAction}
      </p>
    );
  }

  if (project.status) {
    return (
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {project.status}
      </p>
    );
  }

  return null;
}
