import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { AddTaskRow } from "@/components/tasks/add-task-row";
import { CompletedSection } from "@/components/tasks/completed-section";
import { TaskListSkeleton } from "@/components/tasks/task-list-skeleton";
import { TaskRow } from "@/components/tasks/task-row";

export const Route = createFileRoute("/_authenticated/")({
  component: Inbox,
});

function Inbox() {
  const tasks = useQuery(api.tasks.list);
  const projects = useQuery(api.projects.list);
  const isLoading = tasks === undefined;

  const activeTasks = tasks?.filter((t) => !t.isCompleted) ?? [];
  const completedTasks = tasks?.filter((t) => t.isCompleted) ?? [];

  if (isLoading) {
    return <TaskListSkeleton />;
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Inbox</h1>
      <div>
        {activeTasks.map((task) => (
          <TaskRow key={task._id} task={task} />
        ))}
        <AddTaskRow showProjectPicker projects={projects ?? []} />
        {completedTasks.length > 0 && (
          <CompletedSection tasks={completedTasks} />
        )}
      </div>
    </div>
  );
}
