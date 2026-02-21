import type { Doc, Id } from "@convex/_generated/dataModel";
import { FolderOpen, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ProjectPickerProps {
  projects: Doc<"projects">[];
  selectedProjectId: Id<"projects"> | undefined;
  onSelect: (id: Id<"projects"> | undefined) => void;
}

export function ProjectPicker({
  projects,
  selectedProjectId,
  onSelect,
}: ProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = projects.find((p) => p._id === selectedProjectId);

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
            <FolderOpen className="h-3 w-3" />
            {selected ? selected.name : "Project"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="start">
          {projects.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => {
                onSelect(p._id);
                setOpen(false);
              }}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-muted"
            >
              {p.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {selected && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onSelect(undefined)}
          aria-label="Clear project"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
