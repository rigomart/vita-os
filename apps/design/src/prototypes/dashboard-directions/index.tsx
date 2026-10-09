import type { AreaSummary, Thread } from "@vita-os/contracts";

import { Link } from "@tanstack/react-router";
import {
  useAreas,
  useCompleteTask,
  useOpenThreads,
} from "@vita-os/application";
import { AreaIcon } from "@vita-os/application/internal/areas/components/area-icon.tsx";
import {
  BoardCard,
  BoardCompleteButton,
  BoardTag,
} from "@vita-os/application/internal/dashboard/components/board-card.tsx";
import { DashboardScreen } from "@vita-os/application/internal/dashboard/screens/dashboard-screen.tsx";
import { leadTask } from "@vita-os/core";

import { definePrototype } from "@/lab/prototype";

/**
 * An example to copy: directions for the Dashboard, in the product's shell,
 * starting from the real one. The others reuse the Dashboard's own cards and
 * commands, so completing a Task in any of them changes the scenario for all.
 */
export default definePrototype({
  title: "Dashboard directions",
  description: "Alternatives to the Dashboard, against the current one.",
  shell: true,
  variants: [
    {
      key: "current",
      name: "Current",
      description: "The Dashboard as it ships.",
      component: DashboardScreen,
    },
    {
      key: "reading-column",
      name: "Reading column",
      description: "The same board, held to one narrow column.",
      component: ReadingColumn,
    },
    {
      key: "focus-list",
      name: "Focus list",
      description: "Only each open Thread's lead Task, as one list.",
      component: FocusList,
    },
  ],
});

function ReadingColumn() {
  return (
    <div className="mx-auto max-w-3xl">
      <DashboardScreen />
    </div>
  );
}

function FocusList() {
  const threads = useOpenThreads();
  const areas = useAreas();

  if (threads.isPending || areas.isPending) return null;
  if (threads.isError) return <p>{threads.error.message}</p>;
  if (areas.isError) return <p>{areas.error.message}</p>;

  const areaById = new Map(areas.data.map((area) => [area._id, area]));
  const ready = threads.data.filter((thread) => leadTask(thread) !== undefined);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6">
      <h1 className="mb-1 font-heading text-xl font-bold">Next up</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {ready.length} Threads with a clear next Task.
      </p>
      <div className="flex flex-col gap-1">
        {ready.map((thread) => (
          <FocusRow
            key={thread._id}
            thread={thread}
            area={
              thread.areaId === undefined
                ? undefined
                : areaById.get(thread.areaId)
            }
          />
        ))}
      </div>
    </main>
  );
}

function FocusRow({
  thread,
  area,
}: {
  thread: Thread;
  area: AreaSummary | undefined;
}) {
  const complete = useCompleteTask(thread);
  const task = leadTask(thread)!;

  return (
    <BoardCard
      footer={
        <>
          {area !== undefined && (
            <BoardTag
              icon={<AreaIcon icon={area.icon} className="size-3" />}
              label={area.name}
            />
          )}
          <Link
            to="."
            search={(previous: Record<string, unknown>) => ({
              ...previous,
              thread: thread.slug,
            })}
            className="truncate hover:text-foreground"
          >
            {thread.title}
          </Link>
          <span className="ml-auto" />
          <BoardCompleteButton
            label={`Complete ${task.text}`}
            onClick={() => void complete(task._id)}
          />
        </>
      }
    >
      <p className="text-[15px] leading-snug font-medium">{task.text}</p>
    </BoardCard>
  );
}
