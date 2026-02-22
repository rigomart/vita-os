import type { Doc, Id } from "@convex/_generated/dataModel";
import { FolderPlus, ListPlus } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ProcessMode = "create_project" | "add_to_project";

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
        }
      | { type: "add_to_project"; projectId: Id<"projects"> },
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
      });
    } else if (mode === "add_to_project") {
      if (!projectId) return;
      onProcess(capture._id, {
        type: "add_to_project",
        projectId: projectId as Id<"projects">,
      });
    }

    onOpenChange(false);
  };

  const canSubmit =
    (mode === "create_project" && name.trim() && areaId) ||
    (mode === "add_to_project" && projectId);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Process capture</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {/* Capture text reference */}
        <div className="border-l-2 border-primary/30 bg-surface-3/30 py-2 pr-3 pl-3">
          <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
            {capture.text}
          </p>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as ProcessMode)}>
          <TabsList className="w-full">
            <TabsTrigger value="create_project" className="text-xs">
              <FolderPlus className="h-3.5 w-3.5" />
              New project
            </TabsTrigger>
            <TabsTrigger value="add_to_project" className="text-xs">
              <ListPlus className="h-3.5 w-3.5" />
              Add to project
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="space-y-4">
            <TabsContent value="create_project">
              <div className="space-y-4">
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="process-name"
                      className="text-xs text-muted-foreground"
                    >
                      Name
                    </Label>
                    <Input
                      id="process-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Project name"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Area
                    </Label>
                    <AreaPicker
                      areas={areas}
                      selectedAreaId={areaId}
                      onSelect={setAreaId}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="process-desc"
                    className="text-xs text-muted-foreground"
                  >
                    Description
                  </Label>
                  <Input
                    id="process-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                {/* definitionOfDone field hidden — pending removal from backend */}
              </div>
            </TabsContent>

            <TabsContent value="add_to_project">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Project</Label>
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
            </TabsContent>

            <ResponsiveDialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {mode === "create_project"
                  ? "Create project"
                  : "Add to project"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </Tabs>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
