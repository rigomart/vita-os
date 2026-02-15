import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { format, isToday, isTomorrow } from "date-fns";
import { Calendar as CalendarIcon, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/")({
  component: Inbox,
});

function Inbox() {
  const tasks = useQuery(api.tasks.list);
  const isLoading = tasks === undefined;

  const activeTasks = tasks?.filter((t) => !t.isCompleted) ?? [];
  const completedTasks = tasks?.filter((t) => t.isCompleted) ?? [];

  if (isLoading) {
    return <InboxSkeleton />;
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Inbox</h1>
      <div>
        {activeTasks.map((task) => (
          <TaskRow key={task._id} task={task} />
        ))}
        <AddTaskRow />
        {completedTasks.length > 0 && (
          <CompletedSection tasks={completedTasks} />
        )}
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: Doc<"tasks"> }) {
  const updateTask = useMutation(api.tasks.update).withOptimisticUpdate(
    (localStore, args) => {
      const tasks = localStore.getQuery(api.tasks.list, {});
      if (tasks === undefined) return;
      const { id, ...updates } = args;

      const updatedTask = tasks.find((t) => t._id === id);

      if (!updatedTask) return;

      localStore.setQuery(
        api.tasks.list,
        {},
        tasks.map((t) => (t._id === id ? { ...updatedTask, ...updates } : t)),
      );
    },
  );
  const removeTask = useMutation(api.tasks.remove).withOptimisticUpdate(
    (localStore, args) => {
      const tasks = localStore.getQuery(api.tasks.list, {});
      if (tasks === undefined) return;
      localStore.setQuery(
        api.tasks.list,
        {},
        tasks.filter((t) => t._id !== args.id),
      );
    },
  );

  return (
    <>
      <div className="group flex items-start gap-3 py-3">
        <Checkbox
          checked={task.isCompleted}
          onCheckedChange={(checked) =>
            updateTask({
              id: task._id,
              isCompleted: checked === true,
            })
          }
          className="mt-0.5 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <span
            className={
              task.isCompleted ? "line-through text-muted-foreground" : ""
            }
          >
            {task.title}
          </span>
          {task.dueDate && <DueDateLabel timestamp={task.dueDate} />}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => removeTask({ id: task._id })}
          aria-label="Delete task"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
      <Separator />
    </>
  );
}

function DueDateLabel({ timestamp }: { timestamp: number }) {
  const date = new Date(timestamp);
  let label: string;
  let className = "text-xs text-muted-foreground";

  if (isToday(date)) {
    label = "Today";
    className = "text-xs text-green-600";
  } else if (isTomorrow(date)) {
    label = "Tomorrow";
    className = "text-xs text-orange-600";
  } else if (date < new Date()) {
    label = format(date, "MMM d");
    className = "text-xs text-red-600";
  } else {
    label = format(date, "MMM d");
  }

  return (
    <div className="mt-0.5 flex items-center gap-1">
      <CalendarIcon className="h-3 w-3" />
      <span className={className}>{label}</span>
    </div>
  );
}

function AddTaskRow() {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const createTask = useMutation(api.tasks.create).withOptimisticUpdate(
    (localStore, args) => {
      const tasks = localStore.getQuery(api.tasks.list, {});
      if (tasks === undefined) return;
      const maxOrder = tasks.reduce((max, t) => Math.max(max, t.order), -1);
      localStore.setQuery(api.tasks.list, {}, [
        ...tasks,
        {
          _id: crypto.randomUUID() as Id<"tasks">,
          _creationTime: Date.now(),
          userId: "",
          title: args.title,
          isCompleted: false,
          dueDate: args.dueDate,
          order: maxOrder + 1,
          createdAt: Date.now(),
        },
      ]);
    },
  );

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    createTask({ title: trimmed, dueDate: dueDate?.getTime() });
    setTitle("");
    setDueDate(undefined);
    setIsAdding(false);
  };

  const handleCancel = () => {
    setTitle("");
    setDueDate(undefined);
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
        <div className="flex items-center justify-between">
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

function CompletedSection({ tasks }: { tasks: Doc<"tasks">[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <span
          className="inline-block transition-transform"
          style={{
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          &#9656;
        </span>
        Completed ({tasks.length})
      </button>
      {isOpen && (
        <div className="mt-2">
          {tasks.map((task) => (
            <TaskRow key={task._id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div>
      <div className="mb-4 h-8 w-20 animate-pulse rounded bg-muted" />
      {Array.from({ length: 3 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
        <div key={i}>
          <div className="flex items-center gap-3 py-3">
            <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
            <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
          </div>
          <Separator />
        </div>
      ))}
    </div>
  );
}
