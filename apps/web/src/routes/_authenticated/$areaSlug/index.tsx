import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { nullsToUndefined } from "@convex/lib/patch";
import { generateSlug } from "@convex/lib/slugs";
import { healthColors } from "@convex/lib/types";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { format } from "date-fns";
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AreaFormDialog } from "@/components/areas/area-form-dialog";
import { RouteErrorFallback } from "@/components/error-boundary";
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
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <Link
          to="/"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Dashboard
          <ChevronRight className="h-3 w-3" />
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              {area.name}
            </h1>
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${healthColors[area.healthStatus]}`}
            />
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowEdit(true)}
              aria-label="Edit area"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Delete area">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
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
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Select value={area.healthStatus} onValueChange={handleHealthChange}>
            <SelectTrigger className="h-7 w-auto gap-2 border-none bg-muted/60 px-3 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="needs_attention">Needs attention</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
        </div>
      </div>

      {/* Standard */}
      {area.standard && (
        <div className="rounded-xl bg-card p-5">
          <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Standard
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {area.standard}
          </p>
        </div>
      )}

      {/* Projects */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <h2 className="text-sm font-medium">Projects</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={() => setShowCreateProject(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New project
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-10 text-center">
            <FolderOpen className="mb-3 h-8 w-8 text-muted-foreground/60" />
            <p className="mb-4 max-w-xs text-sm text-muted-foreground">
              No projects in this area yet.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateProject(true)}
            >
              Create project
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/50 rounded-xl bg-card">
            {projects.map((project) => {
              const slug = project.slug ?? project._id;
              return (
                <div
                  key={project._id}
                  className="group flex items-center first:rounded-t-xl last:rounded-b-xl"
                >
                  <Link
                    to="/$areaSlug/$projectSlug"
                    params={{ areaSlug, projectSlug: slug }}
                    className="flex min-w-0 flex-1 items-start gap-4 px-4 py-4 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-accent/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {project.name}
                        </p>
                        {project.tags && project.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {project.tags.slice(0, 2).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="px-1.5 py-0 text-[10px]"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {project.tags.length > 2 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{project.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {project.nextAction && (
                        <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          <ArrowRight className="h-3 w-3 shrink-0" />
                          {project.nextAction}
                        </p>
                      )}
                      {!project.nextAction && project.status && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {project.status}
                        </p>
                      )}
                    </div>
                    {project.nextReviewDate && (
                      <span className="flex shrink-0 items-center gap-1 pt-0.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(project.nextReviewDate), "MMM d")}
                      </span>
                    )}
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="mr-2 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Delete project"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
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
      </section>

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
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Skeleton className="mb-2 h-3 w-20" />
        <Skeleton className="h-7 w-40" />
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="h-7 w-32 rounded-md" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center gap-2.5">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="divide-y divide-border/50 rounded-xl bg-card">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
              key={i}
              className="px-4 py-4"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-64" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
