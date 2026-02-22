import type { Doc } from "@convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { AreaPicker } from "@/components/areas/area-picker";
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

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    definitionOfDone?: string;
    areaId: string;
  }) => void;
  project?: Doc<"projects">;
  areas?: Doc<"areas">[];
  defaultAreaId?: string;
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  onSubmit,
  project,
  areas,
  defaultAreaId,
}: ProjectFormDialogProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [definitionOfDone, setDefinitionOfDone] = useState(
    project?.definitionOfDone ?? "",
  );
  const [areaId, setAreaId] = useState<string | undefined>(
    project?.areaId ?? defaultAreaId,
  );

  useEffect(() => {
    if (open && !project) {
      setName("");
      setDescription("");
      setDefinitionOfDone("");
      setAreaId(defaultAreaId);
    }
  }, [open, project, defaultAreaId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !areaId) return;

    onSubmit({
      name: trimmedName,
      description: description.trim() || undefined,
      definitionOfDone: definitionOfDone.trim() || undefined,
      areaId,
    });

    if (!project) {
      setName("");
      setDescription("");
      setDefinitionOfDone("");
      setAreaId(defaultAreaId);
    }
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {project ? "Edit project" : "New project"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Input
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-dod">Definition of Done</Label>
            <Textarea
              id="project-dod"
              value={definitionOfDone}
              onChange={(e) => setDefinitionOfDone(e.target.value)}
              placeholder="When is this project considered done?"
              rows={3}
            />
          </div>
          {areas && (
            <div className="space-y-2">
              <Label>Area</Label>
              <AreaPicker
                areas={areas}
                selectedAreaId={areaId}
                onSelect={setAreaId}
              />
            </div>
          )}
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !areaId}>
              {project ? "Save" : "Create"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
