import { api } from "@convex/_generated/api";
import { nullsToUndefined } from "@convex/lib/patch";
import { generateSlug } from "@convex/lib/slugs";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Pen,
  Tag,
  Target,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { RouteErrorFallback } from "@/components/error-boundary";
import { TagInput } from "@/components/projects/tag-input";
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
import { DatePicker } from "@/components/ui/date-picker";
import { EditableField } from "@/components/ui/editable-field";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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

  const updateProject = useMutation(api.projects.update).withOptimisticUpdate(
    (localStore, args) => {
      const { id, ...updates } = args;
      const resolved = nullsToUndefined(updates);

      const bySlug = localStore.getQuery(api.projects.getBySlug, {
        slug: projectSlug,
      });
      const nameChanged =
        updates.name !== undefined && bySlug && updates.name !== bySlug.name;
      const slugUpdate =
        nameChanged && updates.name ? { slug: generateSlug(updates.name) } : {};
      const fullUpdates = { ...resolved, ...slugUpdate };

      const current = localStore.getQuery(api.projects.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.projects.list,
          {},
          current.map((p) => (p._id === id ? { ...p, ...fullUpdates } : p)),
        );
      }

      const single = localStore.getQuery(api.projects.get, { id });
      if (single !== undefined && single !== null) {
        localStore.setQuery(
          api.projects.get,
          { id },
          { ...single, ...fullUpdates },
        );
      }

      if (bySlug !== undefined && bySlug !== null) {
        localStore.setQuery(
          api.projects.getBySlug,
          { slug: projectSlug },
          { ...bySlug, ...fullUpdates },
        );
      }
    },
  );

  const removeProject = useMutation(api.projects.remove).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.projects.list, {});
      if (current !== undefined) {
        localStore.setQuery(
          api.projects.list,
          {},
          current.filter((p) => p._id !== args.id),
        );
      }
      localStore.setQuery(api.projects.get, { id: args.id }, null);
      localStore.setQuery(api.projects.getBySlug, { slug: projectSlug }, null);
    },
  );

  const createLog = useMutation(api.projectLogs.create);
  const addTag = useMutation(api.projects.addTag).withOptimisticUpdate(
    (localStore, args) => {
      const tag = args.tag.trim().toLowerCase();
      const bySlug = localStore.getQuery(api.projects.getBySlug, {
        slug: projectSlug,
      });
      if (bySlug) {
        const tags = [...(bySlug.tags ?? [])];
        if (!tags.includes(tag)) tags.push(tag);
        localStore.setQuery(
          api.projects.getBySlug,
          { slug: projectSlug },
          { ...bySlug, tags },
        );
      }
    },
  );
  const removeTagMutation = useMutation(
    api.projects.removeTag,
  ).withOptimisticUpdate((localStore, args) => {
    const bySlug = localStore.getQuery(api.projects.getBySlug, {
      slug: projectSlug,
    });
    if (bySlug) {
      localStore.setQuery(
        api.projects.getBySlug,
        { slug: projectSlug },
        {
          ...bySlug,
          tags: (bySlug.tags ?? []).filter((t) => t !== args.tag),
        },
      );
    }
  });
  const allTags = useQuery(api.projects.listTags) ?? [];
  const [noteText, setNoteText] = useState("");

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
    field: "definitionOfDone" | "status" | "nextAction",
    value: string,
  ) => {
    updateProject({
      id: project._id,
      [field]: value || null,
    });
  };

  const handleReviewDateChange = (date: Date | undefined) => {
    updateProject({
      id: project._id,
      nextReviewDate: date ? date.getTime() : null,
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

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = noteText.trim();
    if (!text) return;
    setNoteText("");
    await createLog({ projectId: project._id, content: text });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header: breadcrumb + name + description */}
      <div>
        <Link
          to="/$areaSlug"
          params={{ areaSlug }}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {area.name}
          <ChevronRight className="h-3 w-3" />
        </Link>

        <EditableField
          value={project.name}
          onSave={handleNameSave}
          className="text-xl font-semibold tracking-tight"
        />
      </div>

      {/* Primary: Status & Next Action */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border-subtle bg-surface-2 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Target className="h-3.5 w-3.5" />
            Status
          </div>
          <EditableField
            value={project.status ?? ""}
            onSave={(v) => handleFieldSave("status", v)}
            placeholder="Where things stand..."
            className="text-sm"
          />
        </div>

        <div className="rounded-xl border border-border-subtle bg-surface-2 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ArrowRight className="h-3.5 w-3.5" />
            Next Action
          </div>
          <EditableField
            value={project.nextAction ?? ""}
            onSave={(v) => handleFieldSave("nextAction", v)}
            placeholder="What's the next step?"
            className="text-sm"
          />
        </div>
      </div>

      {/* Metadata: Tags, Review Date, Definition of Done */}
      <div className="space-y-4">
        <MetadataRow icon={<Tag className="h-3.5 w-3.5" />} label="Tags">
          <TagInput
            tags={project.tags ?? []}
            suggestions={allTags}
            onAdd={(tag) => addTag({ id: project._id, tag })}
            onRemove={(tag) => removeTagMutation({ id: project._id, tag })}
          />
        </MetadataRow>

        <MetadataRow
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="Review Date"
        >
          <DatePicker
            value={
              project.nextReviewDate
                ? new Date(project.nextReviewDate)
                : undefined
            }
            onChange={handleReviewDateChange}
            placeholder="Set review date..."
          />
        </MetadataRow>

        <MetadataRow
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Definition of Done"
        >
          <EditableField
            value={project.definitionOfDone ?? ""}
            onSave={(v) => handleFieldSave("definitionOfDone", v)}
            variant="textarea"
            placeholder="What does done look like?"
            className="text-sm"
          />
        </MetadataRow>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-border/50 pt-6">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete project?</AlertDialogTitle>
              <AlertDialogDescription>
                &ldquo;{project.name}&rdquo; will be marked as completed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleStateChange("completed")}>
                Complete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
            >
              <XCircle className="h-3.5 w-3.5" />
              Drop
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Drop project?</AlertDialogTitle>
              <AlertDialogDescription>
                &ldquo;{project.name}&rdquo; will be marked as dropped.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleStateChange("dropped")}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Drop
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex-1" />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
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
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Activity Log */}
      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-3">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-medium">Activity</h2>
          {logs && logs.length > 0 && (
            <span className="text-xs text-muted-foreground">{logs.length}</span>
          )}
        </div>

        <form onSubmit={handleAddNote} className="mb-5 flex gap-2">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            className="min-h-9 bg-surface-2"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAddNote(e);
              }
            }}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!noteText.trim()}
            className="shrink-0"
          >
            Add
          </Button>
        </form>

        {logs === undefined ? (
          <div className="relative before:absolute before:left-[11px] before:top-0 before:bottom-0 before:w-px before:bg-border/50">
            {Array.from({ length: 3 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
              <div key={i} className="relative py-2 pl-8">
                <div className="absolute left-[7px] top-[13px] h-3 w-3 rounded-full bg-surface-3" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-1.5 h-3 w-20" />
              </div>
            ))}
          </div>
        ) : logs.length > 0 ? (
          <div className="relative before:absolute before:left-[11px] before:top-0 before:bottom-0 before:w-px before:bg-border/50">
            {logs.map((log) =>
              log.type === "note" ? (
                <div key={log._id} className="relative py-2 pl-8">
                  <div className="absolute left-0 top-[17px] flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 ring-2 ring-background">
                    <Pen className="h-3 w-3 text-primary" />
                  </div>
                  <div className="rounded-lg border border-border-subtle bg-surface-2 px-4 py-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {log.content}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground/70">
                      {formatDistanceToNow(new Date(log.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={log._id} className="relative py-1.5 pl-8">
                  <div className="absolute left-[7px] top-[13px] h-3 w-3 rounded-full border-2 border-border/60 bg-surface-1" />
                  <p className="text-xs text-muted-foreground italic">
                    {log.content}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/50">
                    {formatDistanceToNow(new Date(log.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No activity yet
          </p>
        )}
      </section>
    </div>
  );
}

function MetadataRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex w-36 shrink-0 items-center gap-2 pt-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Skeleton className="mb-2 h-3 w-16" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border-subtle bg-surface-2 p-4">
          <Skeleton className="mb-2 h-3 w-12" />
          <Skeleton className="h-5 w-3/4" />
        </div>
        <div className="rounded-xl border border-border-subtle bg-surface-2 p-4">
          <Skeleton className="mb-2 h-3 w-16" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      </div>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
            key={i}
            className="flex items-center gap-3"
          >
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
