import type { Doc } from "@convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { AreaPicker } from "@/components/areas/area-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
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
  const [definitionOfDone, setDefinitionOfDone] = useState(
    project?.definitionOfDone ?? "",
  );
  const [areaId, setAreaId] = useState<string | undefined>(
    project?.areaId ?? defaultAreaId,
  );

  useEffect(() => {
    if (open && !project) {
      setName("");
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
      definitionOfDone: definitionOfDone.trim() || undefined,
      areaId,
    });

    if (!project) {
      setName("");
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
          <ResponsiveDialogDescription>
            {project
              ? "Update this project's details."
              : "Projects are active efforts with a defined end state."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Renew passport, File Q4 taxes"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-dod">
              Definition of Done
              <span className="ml-1 font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="project-dod"
              value={definitionOfDone}
              onChange={(e) => setDefinitionOfDone(e.target.value)}
              placeholder="What does done look like?"
              rows={2}
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
              {project ? "Save changes" : "Create project"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
