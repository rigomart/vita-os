import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";

import { RecentTasksList } from "./recent-tasks-list";

export function RecentTasks() {
  const tasks = useQuery(api.tasks.list);

  return (
    <RecentTasksList tasks={tasks ?? []} isLoading={tasks === undefined} />
  );
}
