import type { Doc, Id } from "@convex/_generated/dataModel";
import { Button } from "@vita-os/ui/components/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@vita-os/ui/components/combobox";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@vita-os/ui/components/item";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import { cn } from "@vita-os/ui/lib/utils";
import { ArrowRight, Check, FileText, Target } from "lucide-react";
import { useMemo, useState } from "react";
import type { ProcessItemAction } from "@/features/items/use-process-item";

type ProcessingMode = "add_to_project" | "set_next_action";

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

type ProjectItem = Doc<"projects"> & { areaName: string };

export function ProcessItemDialog({
  open,
  onOpenChange,
  item,
  areas,
  projects,
  isLoading = false,
  onProcess,
}: ProcessItemDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<
    Id<"projects"> | undefined
  >();
  const [mode, setMode] = useState<ProcessingMode>("add_to_project");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const areaById = useMemo(
    () => new Map(areas.map((area) => [area._id, area])),
    [areas],
  );

  const projectItems: ProjectItem[] = useMemo(
    () =>
      projects.map((project) => ({
        ...project,
        areaName: areaById.get(project.areaId)?.name ?? "No area",
      })),
    [projects, areaById],
  );

  const selectedProject = projects.find(
    (project) => project._id === selectedProjectId,
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId) return;

    setIsSubmitting(true);
    try {
      await onProcess(item._id, {
        type: mode,
        projectId: selectedProjectId,
      });
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
            <Combobox
              items={isLoading ? [] : projectItems}
              itemToStringLabel={(project: ProjectItem) => project.name}
              itemToStringValue={(project: ProjectItem) => project.name}
              filter={(project: ProjectItem, query: string) => {
                const q = query.trim().toLowerCase();
                return (
                  project.name.toLowerCase().includes(q) ||
                  project.areaName.toLowerCase().includes(q)
                );
              }}
              onValueChange={(project: ProjectItem | null) => {
                setSelectedProjectId(
                  project ? (project._id as Id<"projects">) : undefined,
                );
              }}
            >
              <ComboboxInput
                placeholder="Search projects or areas..."
                autoFocus
              />
              <ComboboxContent>
                <ComboboxEmpty>No matching projects</ComboboxEmpty>
                <ComboboxList>
                  {(project: ProjectItem) => (
                    <ComboboxItem key={project._id} value={project}>
                      <Item size="xs" className="p-0">
                        <ItemContent>
                          <ItemTitle className="whitespace-nowrap">
                            {project.name}
                          </ItemTitle>
                          <ItemDescription>{project.areaName}</ItemDescription>
                        </ItemContent>
                      </Item>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

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
            <Button type="submit" disabled={!selectedProjectId || isSubmitting}>
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
