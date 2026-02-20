import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { useState } from "react";
import { ProjectPicker } from "@/components/tasks/project-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";

interface QuickAddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickAddTaskDialog({
  open,
  onOpenChange,
}: QuickAddTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<
    string | undefined
  >();
  const projects = useQuery(api.projects.list);
  const createTask = useMutation(api.tasks.create);

  const reset = () => {
    setTitle("");
    setDescription("");
    setDueDate(undefined);
    setSelectedProjectId(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    await createTask({
      title: trimmed,
      description: description.trim() || undefined,
      dueDate: dueDate?.getTime(),
      projectId: selectedProjectId
        ? (selectedProjectId as Id<"projects">)
        : undefined,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) reset();
        onOpenChange(value);
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Add task</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick-task-title">Title</Label>
            <Input
              id="quick-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task name"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-task-description">Description</Label>
            <Textarea
              id="quick-task-description"
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
            {projects && projects.length > 0 && (
              <ProjectPicker
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelect={setSelectedProjectId}
              />
            )}
          </div>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Add task
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
