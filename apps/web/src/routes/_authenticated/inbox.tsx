import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { PageHeader } from "@/components/layout/page-header";
import { AddTaskRow } from "@/components/tasks/add-task-row";
import { CompletedSection } from "@/components/tasks/completed-section";
import { TaskListSkeleton } from "@/components/tasks/task-list-skeleton";
import { TaskRow } from "@/components/tasks/task-row";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [{ title: "Inbox | Vita OS" }],
  }),
  component: InboxPage,
});

function InboxPage() {
  const tasks = useQuery(api.tasks.list);
  const projects = useQuery(api.projects.list);

  if (tasks === undefined) {
    return <InboxSkeleton />;
  }

  const activeTasks = tasks.filter((t) => !t.isCompleted);
  const completedTasks = tasks.filter((t) => t.isCompleted);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Inbox" />
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

function InboxSkeleton() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Skeleton className="h-8 w-20" />
      </div>
      <TaskListSkeleton />
    </div>
  );
}
