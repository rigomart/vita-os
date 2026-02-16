import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ProjectPicker } from "@/components/tasks/project-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useTaskMutations } from "@/hooks/use-task-mutations";

interface EditTaskDialogProps {
  task: Doc<"tasks">;
  projectId?: Id<"projects">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTaskDialog({
  task,
  projectId,
  open,
  onOpenChange,
}: EditTaskDialogProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.dueDate ? new Date(task.dueDate) : undefined,
  );
  const [selectedProjectId, setSelectedProjectId] = useState<
    string | undefined
  >(task.projectId);
  const projects = useQuery(api.projects.list);
  const { updateTask } = useTaskMutations(projectId);

  useEffect(() => {
    if (open) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
      setSelectedProjectId(task.projectId);
    }
  }, [open, task.title, task.description, task.dueDate, task.projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    const descTrimmed = description.trim();
    await updateTask({
      id: task._id,
      title: trimmed,
      description: descTrimmed || undefined,
      clearDescription: !descTrimmed && !!task.description,
      dueDate: dueDate?.getTime(),
      clearDueDate: !dueDate && !!task.dueDate,
      projectId: selectedProjectId
        ? (selectedProjectId as Id<"projects">)
        : undefined,
      clearProjectId: !selectedProjectId && !!task.projectId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-task-title">Title</Label>
            <Input
              id="edit-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task name"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-task-description">Description</Label>
            <Textarea
              id="edit-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
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
            {dueDate && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDueDate(undefined)}
                aria-label="Clear due date"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            {projects && projects.length > 0 && (
              <ProjectPicker
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelect={setSelectedProjectId}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
