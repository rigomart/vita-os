import { api } from "@convex/_generated/api";
import { nullsToUndefined } from "@convex/lib/patch";
import { generateSlug } from "@convex/lib/slugs";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useRef, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/$areaSlug/$projectSlug")({
  component: AreaProjectDetailPage,
});

function AreaProjectDetailPage() {
  const { areaSlug, projectSlug } = Route.useParams();
  const areaResult = useQuery(api.areas.getBySlug, { slug: areaSlug });
  const lastAreaRef = useRef<NonNullable<typeof areaResult>>(undefined);
  if (areaResult !== undefined && areaResult !== null)
    lastAreaRef.current = areaResult;
  const area = areaResult ?? lastAreaRef.current ?? null;

  const projectResult = useQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const lastProjectRef = useRef<NonNullable<typeof projectResult>>(undefined);
  if (projectResult !== undefined && projectResult !== null)
    lastProjectRef.current = projectResult;
  const project = projectResult ?? lastProjectRef.current ?? null;

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

  const isLoading =
    (areaResult === undefined && !lastAreaRef.current) ||
    (projectResult === undefined && !lastProjectRef.current);

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
    field: "description" | "status" | "nextAction" | "definitionOfDone",
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
    <div className="mx-auto max-w-3xl">
      {/* Back link */}
      <Link
        to="/$areaSlug"
        params={{ areaSlug }}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {area.name}
      </Link>

      {/* Project name */}
      <EditableField
        value={project.name}
        onSave={handleNameSave}
        className="text-2xl font-bold"
      />

      {/* Description */}
      <div className="mt-2">
        <EditableField
          value={project.description ?? ""}
          onSave={(v) => handleFieldSave("description", v)}
          variant="textarea"
          placeholder="Add a description..."
          className="text-sm text-muted-foreground"
        />
      </div>

      {/* Fields */}
      <div className="mt-6 space-y-3">
        <FieldRow label="Status">
          <EditableField
            value={project.status ?? ""}
            onSave={(v) => handleFieldSave("status", v)}
            placeholder="Set status..."
            className="text-sm"
          />
        </FieldRow>

        <FieldRow label="Next Action">
          <EditableField
            value={project.nextAction ?? ""}
            onSave={(v) => handleFieldSave("nextAction", v)}
            placeholder="What's the next step?"
            className="text-sm"
          />
        </FieldRow>

        <FieldRow label="Review Date">
          <DatePicker
            value={
              project.nextReviewDate
                ? new Date(project.nextReviewDate)
                : undefined
            }
            onChange={handleReviewDateChange}
            placeholder="Set review date..."
          />
        </FieldRow>

        <FieldRow label="Definition of Done">
          <EditableField
            value={project.definitionOfDone ?? ""}
            onSave={(v) => handleFieldSave("definitionOfDone", v)}
            variant="textarea"
            placeholder="When is this done?"
            className="text-sm"
          />
        </FieldRow>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              Mark Complete
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
            <Button variant="outline" size="sm">
              Drop Project
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

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
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

      <Separator className="my-6" />

      {/* Activity log */}
      <h2 className="mb-3 text-sm font-medium">Activity</h2>
      <form onSubmit={handleAddNote} className="mb-4 flex gap-2">
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add a note..."
          className="min-h-9"
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

      {logs && logs.length > 0 ? (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log._id} className="text-sm">
              <p className="whitespace-pre-wrap">{log.content}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(log.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No activity yet
        </p>
      )}
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-32 shrink-0 pt-1 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function ProjectDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <Skeleton className="mb-3 h-4 w-16" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />

      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
            key={i}
            className="flex items-center gap-4"
          >
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>

      <Separator className="my-6" />

      <Skeleton className="mb-3 h-4 w-16" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
