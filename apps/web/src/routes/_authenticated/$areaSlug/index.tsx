import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { nullsToUndefined } from "@convex/lib/patch";
import { generateSlug } from "@convex/lib/slugs";
import { healthColors } from "@convex/lib/types";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { format } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AreaFormDialog } from "@/components/areas/area-form-dialog";
import { RouteErrorFallback } from "@/components/error-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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

  const updateArea = useMutation(api.areas.update).withOptimisticUpdate(
    (localStore, args) => {
      const { id, ...updates } = args;
      const resolved = nullsToUndefined(updates);

      const bySlug = localStore.getQuery(api.areas.getBySlug, {
        slug: areaSlug,
      });
      const nameChanged =
        updates.name !== undefined && bySlug && updates.name !== bySlug.name;
      const slugUpdate =
        nameChanged && updates.name ? { slug: generateSlug(updates.name) } : {};
      const fullUpdates = { ...resolved, ...slugUpdate };

      const current = localStore.getQuery(api.areas.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.areas.list,
          {},
          current.map((a) => (a._id === id ? { ...a, ...fullUpdates } : a)),
        );
      }

      const single = localStore.getQuery(api.areas.get, { id });
      if (single !== undefined && single !== null) {
        localStore.setQuery(
          api.areas.get,
          { id },
          { ...single, ...fullUpdates },
        );
      }

      if (bySlug !== undefined && bySlug !== null) {
        localStore.setQuery(
          api.areas.getBySlug,
          { slug: areaSlug },
          { ...bySlug, ...fullUpdates },
        );
      }
    },
  );

  const removeArea = useMutation(api.areas.remove).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.areas.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.areas.list,
          {},
          current.filter((a) => a._id !== args.id),
        );
      }
      localStore.setQuery(api.areas.get, { id: args.id }, null);
      localStore.setQuery(api.areas.getBySlug, { slug: areaSlug }, null);
    },
  );

  const createProject = useMutation(api.projects.create).withOptimisticUpdate(
    (localStore, args) => {
      if (!area) return;
      const current = localStore.getQuery(api.projects.listByArea, {
        areaId: area._id,
      });
      if (current !== undefined) {
        const maxOrder = current.reduce((max, p) => Math.max(max, p.order), -1);
        localStore.setQuery(api.projects.listByArea, { areaId: area._id }, [
          ...current,
          {
            _id: crypto.randomUUID() as Id<"projects">,
            _creationTime: Date.now(),
            userId: "",
            name: args.name,
            slug: generateSlug(args.name),
            description: args.description,
            definitionOfDone: args.definitionOfDone,
            areaId: args.areaId,
            order: maxOrder + 1,
            state: "active" as const,
            tags: undefined,
            createdAt: Date.now(),
          },
        ]);
      }
    },
  );

  const removeProject = useMutation(api.projects.remove).withOptimisticUpdate(
    (localStore, args) => {
      if (!area) return;
      const current = localStore.getQuery(api.projects.listByArea, {
        areaId: area._id,
      });
      if (current !== undefined) {
        localStore.setQuery(
          api.projects.listByArea,
          { areaId: area._id },
          current.filter((p) => p._id !== args.id),
        );
      }
    },
  );
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
                    This area and its data will be permanently deleted. Move or
                    delete all projects first.
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
        <div className="mb-6 rounded-md border border-l-2 border-l-primary/30 p-4">
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Standard
          </h2>
          <p className="whitespace-pre-wrap text-sm">{area.standard}</p>
        </div>
      )}

      <Separator className="mb-4" />

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
              <div
                key={project._id}
                className="group flex items-center border-b px-3 transition-colors last:border-b-0 hover:bg-card"
              >
                <Link
                  to="/$areaSlug/$projectSlug"
                  params={{ areaSlug, projectSlug: slug }}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{project.name}</p>
                    {project.tags && project.tags.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {project.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {project.tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{project.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    {project.status && (
                      <p className="truncate text-xs text-muted-foreground">
                        {project.status}
                      </p>
                    )}
                    {project.nextAction && (
                      <p className="truncate text-xs text-muted-foreground">
                        Next: {project.nextAction}
                      </p>
                    )}
                  </div>
                  {project.nextReviewDate && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {format(new Date(project.nextReviewDate), "MMM d")}
                    </span>
                  )}
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Delete project"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        &ldquo;{project.name}&rdquo; will be permanently
                        removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removeProject({ id: project._id })}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
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

function AreaDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Skeleton className="mb-3 h-4 w-12" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-2.5 w-2.5 rounded-full" />
        <Skeleton className="h-8 w-40 rounded-md" />
      </div>

      <div className="mb-6 rounded-md border p-4">
        <Skeleton className="mb-2 h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-2/3" />
      </div>

      <Separator className="mb-4" />

      <div className="mt-4 mb-2 flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-7 w-24 rounded-md" />
      </div>

      {Array.from({ length: 2 }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
          key={i}
          className="border-b py-3 last:border-b-0"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-1.5 h-3 w-64" />
        </div>
      ))}
    </div>
  );
}
