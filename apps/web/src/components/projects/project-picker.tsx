import type { Doc } from "@convex/_generated/dataModel";
import { FolderOpen } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ProjectPickerProps {
  projects: Doc<"projects">[];
  areas: Doc<"areas">[];
  selectedProjectId: string | undefined;
  onSelect: (id: string) => void;
}

export function ProjectPicker({
  projects,
  areas,
  selectedProjectId,
  onSelect,
}: ProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = projects.find((p) => p._id === selectedProjectId);

  const projectsByArea = areas
    .map((area) => ({
      area,
      projects: projects.filter((p) => p.areaId === area._id),
    }))
    .filter((group) => group.projects.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
          <FolderOpen className="h-3 w-3" />
          {selected ? selected.name : "Select project"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {projectsByArea.map(({ area, projects: areaProjects }) => (
          <div key={area._id}>
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
              {area.name}
            </p>
            {areaProjects.map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => {
                  onSelect(p._id);
                  setOpen(false);
                }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-surface-3"
              >
                {p.name}
              </button>
            ))}
          </div>
        ))}
        {projectsByArea.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            No active projects
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
