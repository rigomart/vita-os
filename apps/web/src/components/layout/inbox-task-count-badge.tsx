import { Badge } from "@vita-os/ui/components/badge";

interface InboxTaskCountBadgeProps {
  taskCount: number | undefined;
}

export function InboxTaskCountBadge({ taskCount }: InboxTaskCountBadgeProps) {
  if (taskCount === undefined || taskCount === 0) return null;

  return (
    <Badge
      variant="secondary"
      className="ml-auto h-5 min-w-5 justify-center px-1.5 text-[10px] tabular-nums"
      aria-label={`${taskCount} Open ${taskCount === 1 ? "Task" : "Tasks"}`}
    >
      {taskCount}
    </Badge>
  );
}
