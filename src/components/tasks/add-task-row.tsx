import type { Doc, Id } from "@convex/_generated/dataModel";
import { format } from "date-fns";
import { Calendar as CalendarIcon, FolderOpen, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useTaskMutations } from "@/hooks/use-task-mutations";

interface AddTaskRowProps {
  projectId?: Id<"projects">;
  showProjectPicker?: boolean;
  projects?: Doc<"projects">[];
}

export function AddTaskRow({
  projectId,
  showProjectPicker,
  projects,
}: AddTaskRowProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<
    string | undefined
  >();
  const { createTask } = useTaskMutations(projectId);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const trimmedDesc = description.trim();
    const resolvedProjectId = projectId ?? selectedProjectId;
    createTask({
      title: trimmed,
      description: trimmedDesc || undefined,
      dueDate: dueDate?.getTime(),
      projectId: resolvedProjectId
        ? (resolvedProjectId as Id<"projects">)
        : undefined,
    });
    setTitle("");
    setDescription("");
    setDueDate(undefined);
    setSelectedProjectId(undefined);
    setIsAdding(false);
  };

  const handleCancel = () => {
    setTitle("");
    setDescription("");
    setDueDate(undefined);
    setSelectedProjectId(undefined);
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (!isAdding) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex w-full items-center gap-3 py-3 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          <span>Add task</span>
        </button>
        <Separator />
      </>
    );
  }

  return (
    <>
      <div className="space-y-3 py-3">
        <input
          // biome-ignore lint/a11y/noAutofocus: intentional for inline task form
          autoFocus
          type="text"
          placeholder="Task name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full resize-none bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                >
                  <CalendarIcon className="h-3 w-3" />
                  {dueDate ? format(dueDate, "MMM d") : "Due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                />
              </PopoverContent>
            </Popover>
            {showProjectPicker && projects && projects.length > 0 && (
              <ProjectPicker
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelect={setSelectedProjectId}
              />
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!title.trim()}>
              Add task
            </Button>
          </div>
        </div>
      </div>
      <Separator />
    </>
  );
}

function ProjectPicker({
  projects,
  selectedProjectId,
  onSelect,
}: {
  projects: Doc<"projects">[];
  selectedProjectId: string | undefined;
  onSelect: (id: string | undefined) => void;
}) {
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
