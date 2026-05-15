import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
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
import { CheckCircle2, Trash2, XCircle } from "lucide-react";
import {
  optimisticallyRemoveProject,
  optimisticallyUpdateProject,
} from "@/features/projects/optimistic";
import { useStableQuery } from "@/hooks/use-stable-query";

interface ProjectLifecycleActionsProps {
  areaSlug: string;
  projectSlug: string;
}

export function ProjectLifecycleActions({
  areaSlug,
  projectSlug,
}: ProjectLifecycleActionsProps) {
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const navigate = useNavigate();
  const updateProject = useMutation(api.projects.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateProject(localStore, args, { projectSlug });
    },
  );
  const removeProject = useMutation(api.projects.remove).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyRemoveProject(localStore, args, { projectSlug });
    },
  );

  const handleStateChange = (state: "completed" | "dropped") => {
    if (!project) return;
    updateProject({ id: project._id, state });
    navigate({ to: "/$areaSlug", params: { areaSlug } });
  };

  const handleDelete = async () => {
    if (!project) return;
    await removeProject({ id: project._id });
    navigate({ to: "/$areaSlug", params: { areaSlug } });
  };

  if (!project) return null;

  return (
    <div className="flex items-center gap-2 border-t border-border/50 pt-6">
      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="outline" size="sm" className="gap-1.5" />}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Complete
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
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
            />
          }
        >
          <XCircle className="h-3.5 w-3.5" />
          Drop
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
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            />
          }
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
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
  );
}
