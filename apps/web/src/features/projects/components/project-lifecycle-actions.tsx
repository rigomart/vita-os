import type { Doc } from "@convex/_generated/dataModel";
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
import { Textarea } from "@vita-os/ui/components/textarea";
import { CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

interface ProjectLifecycleActionsProps {
  project: Doc<"projects">;
  onResolve: (resolutionNote?: string) => void;
  onReopen: () => void;
  onDelete: () => void;
}

export function ProjectLifecycleActions({
  project,
  onResolve,
  onReopen,
  onDelete,
}: ProjectLifecycleActionsProps) {
  const [resolutionNote, setResolutionNote] = useState("");
  const isResolved =
    project.state === "resolved" ||
    project.state === "completed" ||
    project.state === "dropped";

  return (
    <div className="flex items-center gap-2 border-t border-border/50 pt-6">
      {isResolved ? (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onReopen}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reopen
        </Button>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="outline" size="sm" className="gap-1.5" />}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Resolve
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Resolve thread?</AlertDialogTitle>
              <AlertDialogDescription>
                &ldquo;{project.name}&rdquo; will be marked as resolved. Its
                current Next Move and Follow-up will be cleared.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <label
                htmlFor="resolution-note"
                className="text-sm font-medium text-foreground"
              >
                Resolution note
              </label>
              <Textarea
                id="resolution-note"
                value={resolutionNote}
                onChange={(event) => setResolutionNote(event.target.value)}
                placeholder="Add context..."
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onResolve(resolutionNote.trim() || undefined)}
              >
                Resolve thread
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

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
            <AlertDialogTitle>Delete thread?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{project.name}&rdquo; will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
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
