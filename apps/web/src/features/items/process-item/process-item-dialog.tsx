import type { Doc, Id } from "@convex/_generated/dataModel";
import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import { Input } from "@vita-os/ui/components/input";
import { Label } from "@vita-os/ui/components/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import { cn } from "@vita-os/ui/lib/utils";
import { FileText, ListPlus, Search, Target } from "lucide-react";
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

export function ProcessItemDialog({
  open,
  onOpenChange,
  item,
  areas,
  projects,
  isLoading = false,
  onProcess,
}: ProcessItemDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<Id<"projects">>();
  const [mode, setMode] = useState<ProcessingMode>("add_to_project");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const areaById = useMemo(
    () => new Map(areas.map((area) => [area._id, area])),
    [areas],
  );

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return projects;

    return projects.filter((project) => {
      const areaName = areaById.get(project.areaId)?.name ?? "";
      return `${project.name} ${areaName}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [areaById, projects, query]);

  const selectedProject = projects.find(
    (project) => project._id === selectedProjectId,
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId) return;

    setIsSubmitting(true);
    try {
      await onProcess(item._id, { type: mode, projectId: selectedProjectId });
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
        </ResponsiveDialogHeader>

        <div className="rounded-lg border border-border-subtle bg-surface-2 px-3 py-2">
          <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {item.text}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="process-project-search">Project</Label>
            <div className="relative">
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="process-project-search"
                role="combobox"
                aria-label="Project"
                aria-controls="process-project-results"
                aria-expanded="true"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedProjectId(undefined);
                }}
                placeholder="Search projects or areas"
                autoFocus
                className="pl-9"
              />
            </div>
          </div>

          <div
            id="process-project-results"
            role="listbox"
            aria-label="Projects"
            className="max-h-64 overflow-y-auto rounded-lg border border-border-subtle"
          >
            {isLoading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Loading projects...
              </p>
            ) : filteredProjects.length > 0 ? (
              filteredProjects.map((project) => {
                const area = areaById.get(project.areaId);
                const isSelected = project._id === selectedProjectId;

                return (
                  <button
                    key={project._id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedProjectId(project._id);
                      setQuery(project.name);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 border-border-subtle border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                      isSelected && "bg-primary/5 text-primary",
                    )}
                  >
                    <span className="min-w-0 truncate font-medium">
                      {project.name}
                    </span>
                    {area && (
                      <Badge variant="outline" className="max-w-32 truncate">
                        {area.name}
                      </Badge>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No matching projects
              </p>
            )}
          </div>

          {selectedProject && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Add to {selectedProject.name}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
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
            </fieldset>
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
              <ListPlus className="h-4 w-4" />
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
        "flex min-h-28 cursor-pointer gap-3 rounded-lg border border-border-subtle p-3 transition-colors hover:bg-surface-3",
        isSelected && "border-primary/50 bg-primary/5 text-primary",
      )}
    >
      <input
        id={id}
        type="radio"
        name="processing-mode"
        value={mode}
        checked={isSelected}
        onChange={() => onSelect(mode)}
        className="mt-1"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="font-medium text-sm">{title}</span>
        <span className="text-muted-foreground text-xs leading-relaxed">
          {description}
        </span>
      </span>
    </label>
  );
}
