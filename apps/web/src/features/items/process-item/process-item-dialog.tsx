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
import { cn } from "@vita-os/ui/lib/utils";
import { ArrowRight, Check, FileText, Target } from "lucide-react";
import { useState } from "react";
import { AreaPicker } from "@/features/areas/components/area-picker";
import type { ProcessItemAction } from "@/features/items/use-process-item";
import { ProjectSearchAutocomplete } from "./project-search-autocomplete";

type ProcessingMode = "add_to_project" | "set_next_action";
type ProcessSelection =
  | { type: "existing_project"; projectId: Id<"projects"> }
  | { type: "create_project" };

interface ProcessItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Doc<"items">;
  areas: Doc<"areas">[];
  projects: Doc<"projects">[];
  isLoading?: boolean;
  onProcess: (
    itemId: Id<"items">,
    action: ProcessItemAction,
  ) => void | Promise<void>;
}

export function ProcessItemDialog({
  open,
  onOpenChange,
  item,
  areas,
  projects,
  isLoading = false,
  onProcess,
}: ProcessItemDialogProps) {
  const [selection, setSelection] = useState<ProcessSelection | undefined>();
  const [mode, setMode] = useState<ProcessingMode>("add_to_project");
  const [createName, setCreateName] = useState("");
  const [createAreaId, setCreateAreaId] = useState<string | undefined>();
  const [definitionOfDone, setDefinitionOfDone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedProject = projects.find(
    (project) =>
      selection?.type === "existing_project" &&
      project._id === selection.projectId,
  );
  const isCreatingProject = selection?.type === "create_project";
  const canSubmitExistingProject =
    selection?.type === "existing_project" && !!selection.projectId;
  const canSubmitCreatedProject =
    isCreatingProject && createName.trim().length > 0 && !!createAreaId;
  const canSubmit = canSubmitExistingProject || canSubmitCreatedProject;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      if (isCreatingProject) {
        await onProcess(item._id, {
          type: "create_project",
          name: createName.trim(),
          areaId: createAreaId as Id<"areas">,
          definitionOfDone: definitionOfDone.trim() || undefined,
        });
      } else if (selection?.type === "existing_project") {
        await onProcess(item._id, {
          type: mode,
          projectId: selection.projectId,
        });
      }
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Process item</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Choose a project and decide what to do with this item.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            From inbox
          </span>
          <div className="border-l-2 border-border-subtle pl-3">
            <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {item.text}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              1. Choose a project
            </span>
            <ProjectSearchAutocomplete
              areas={areas}
              projects={projects}
              isLoading={isLoading}
              onSelect={(project) => {
                setSelection({
                  type: "existing_project",
                  projectId: project._id,
                });
              }}
              onCreate={(name) => {
                setSelection({ type: "create_project" });
                setCreateName(name);
                setCreateAreaId(undefined);
                setDefinitionOfDone("");
              }}
            />
          </div>

          {isCreatingProject && (
            <div className="space-y-4 rounded-lg border border-border-subtle bg-surface-2 p-4">
              <div className="space-y-2">
                <Label htmlFor="inline-project-name">Project name</Label>
                <Input
                  id="inline-project-name"
                  value={createName}
                  onChange={(event) => setCreateName(event.currentTarget.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Area</Label>
                <AreaPicker
                  areas={areas}
                  selectedAreaId={createAreaId}
                  onSelect={setCreateAreaId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inline-project-dod">Definition of Done</Label>
                <Textarea
                  id="inline-project-dod"
                  value={definitionOfDone}
                  onChange={(event) =>
                    setDefinitionOfDone(event.currentTarget.value)
                  }
                  placeholder="What does done look like?"
                  rows={2}
                />
              </div>
            </div>
          )}

          {selectedProject && (
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                2. What should happen?
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                <ProcessingModeCard
                  mode="add_to_project"
                  selectedMode={mode}
                  onSelect={setMode}
                  title="Add as note"
                  description="Keep it in the Project log."
                  icon={<FileText className="h-5 w-5" />}
                />
                <ProcessingModeCard
                  mode="set_next_action"
                  selectedMode={mode}
                  onSelect={setMode}
                  title="Set as next action"
                  description="Move it to the action queue."
                  icon={<Target className="h-5 w-5" />}
                />
              </div>
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
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              <ArrowRight className="h-4 w-4" />
              Process
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function ProcessingModeCard({
  mode,
  selectedMode,
  onSelect,
  title,
  description,
  icon,
}: {
  mode: ProcessingMode;
  selectedMode: ProcessingMode;
  onSelect: (mode: ProcessingMode) => void;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  const id = `process-${mode}`;
  const isSelected = mode === selectedMode;

  return (
    <label
      htmlFor={id}
      className={cn(
        "relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition-all",
        "border-border-subtle bg-surface-2 hover:border-border hover:bg-surface-3",
        isSelected && "border-primary/50 bg-primary/5 ring-1 ring-primary/20",
      )}
    >
      <input
        id={id}
        type="radio"
        name="processing-mode"
        value={mode}
        checked={isSelected}
        onChange={() => onSelect(mode)}
        className="sr-only"
      />

      {isSelected && (
        <div
          className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <Check className="h-3 w-3" />
        </div>
      )}

      <div
        aria-hidden="true"
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          isSelected
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </div>
    </label>
  );
}
