import type { Doc, Id } from "@convex/_generated/dataModel";
import { useState } from "react";
import { AreaPicker } from "@/components/areas/area-picker";
import { ProjectPicker } from "@/components/projects/project-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";

type ProcessMode = "create_project" | "add_to_project" | "discard";

interface ProcessCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capture: Doc<"captures">;
  areas: Doc<"areas">[];
  projects: Doc<"projects">[];
  onProcess: (
    captureId: Id<"captures">,
    action:
      | {
          type: "create_project";
          name: string;
          areaId: Id<"areas">;
          description?: string;
          definitionOfDone?: string;
        }
      | { type: "add_to_project"; projectId: Id<"projects"> }
      | { type: "discard" },
  ) => void;
}

export function ProcessCaptureDialog({
  open,
  onOpenChange,
  capture,
  areas,
  projects,
  onProcess,
}: ProcessCaptureDialogProps) {
  const [mode, setMode] = useState<ProcessMode>("create_project");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [definitionOfDone, setDefinitionOfDone] = useState("");
  const [areaId, setAreaId] = useState<string | undefined>(areas[0]?._id);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "create_project") {
      const trimmedName = name.trim();
      if (!trimmedName || !areaId) return;
      onProcess(capture._id, {
        type: "create_project",
        name: trimmedName,
        areaId: areaId as Id<"areas">,
        description: description.trim() || undefined,
        definitionOfDone: definitionOfDone.trim() || undefined,
      });
    } else if (mode === "add_to_project") {
      if (!projectId) return;
      onProcess(capture._id, {
        type: "add_to_project",
        projectId: projectId as Id<"projects">,
      });
    } else {
      onProcess(capture._id, { type: "discard" });
    }

    onOpenChange(false);
  };

  const canSubmit =
    mode === "discard" ||
    (mode === "create_project" && name.trim() && areaId) ||
    (mode === "add_to_project" && projectId);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Process capture</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {/* Capture text reference */}
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <p className="whitespace-pre-wrap text-sm">{capture.text}</p>
        </div>

        {/* Mode selector */}
        <div className="flex gap-1">
          {(
            [
              ["create_project", "New project"],
              ["add_to_project", "Add to project"],
              ["discard", "Discard"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant={mode === value ? "default" : "outline"}
              size="sm"
              onClick={() => setMode(value)}
              className="text-xs"
            >
              {label}
            </Button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "create_project" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="process-name">Name</Label>
                <Input
                  id="process-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Area</Label>
                <AreaPicker
                  areas={areas}
                  selectedAreaId={areaId}
                  onSelect={setAreaId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="process-desc">Description</Label>
                <Input
                  id="process-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="process-dod">Definition of Done</Label>
                <Textarea
                  id="process-dod"
                  value={definitionOfDone}
                  onChange={(e) => setDefinitionOfDone(e.target.value)}
                  placeholder="When is this project done?"
                  rows={2}
                />
              </div>
            </>
          )}

          {mode === "add_to_project" && (
            <div className="space-y-2">
              <Label>Project</Label>
              <ProjectPicker
                projects={projects}
                areas={areas}
                selectedProjectId={projectId}
                onSelect={setProjectId}
              />
              <p className="text-xs text-muted-foreground">
                The capture text will be added as a note on the selected
                project.
              </p>
            </div>
          )}

          {mode === "discard" && (
            <p className="text-sm text-muted-foreground">
              This capture will be permanently deleted.
            </p>
          )}

          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              variant={mode === "discard" ? "destructive" : "default"}
            >
              {mode === "create_project"
                ? "Create project"
                : mode === "add_to_project"
                  ? "Add to project"
                  : "Discard"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
