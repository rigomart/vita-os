import type { Doc, Id } from "@convex/_generated/dataModel";
import { Button } from "@vita-os/ui/components/button";
import { Input } from "@vita-os/ui/components/input";
import { Label } from "@vita-os/ui/components/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import { Textarea } from "@vita-os/ui/components/textarea";
import { useEffect, useState } from "react";
import { AreaPicker } from "@/features/areas/components/area-picker";
import type { ProjectFormValue } from "./types";

interface ProjectFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: Doc<"areas">[];
  defaultAreaId?: Id<"areas">;
  initialValue?: Partial<ProjectFormValue>;
  onSubmit: (value: ProjectFormValue) => Promise<void> | void;
}

export function ProjectFormDialog({
  mode,
  open,
  onOpenChange,
  areas,
  defaultAreaId,
  initialValue,
  onSubmit,
}: ProjectFormDialogProps) {
  const [name, setName] = useState(initialValue?.name ?? "");
  const [definitionOfDone, setDefinitionOfDone] = useState(
    initialValue?.definitionOfDone ?? "",
  );
  const [areaId, setAreaId] = useState<string | undefined>(
    initialValue?.areaId ?? defaultAreaId,
  );

  useEffect(() => {
    if (!open) return;
    setName(initialValue?.name ?? "");
    setDefinitionOfDone(initialValue?.definitionOfDone ?? "");
    setAreaId(initialValue?.areaId ?? defaultAreaId);
  }, [open, initialValue, defaultAreaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !areaId) return;

    await onSubmit({
      name: trimmedName,
      definitionOfDone: definitionOfDone.trim() || undefined,
      areaId: areaId as Id<"areas">,
    });

    if (mode === "create") {
      setName("");
      setDefinitionOfDone("");
      setAreaId(defaultAreaId);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {mode === "edit" ? "Edit project" : "New project"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {mode === "edit"
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
          <div className="space-y-2">
            <Label>Area</Label>
            <AreaPicker
              areas={areas}
              selectedAreaId={areaId}
              onSelect={setAreaId}
            />
          </div>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !areaId}>
              {mode === "edit" ? "Save changes" : "Create project"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
