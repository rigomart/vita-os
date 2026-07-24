import type { Doc } from "@convex/_generated/dataModel";

import { Badge } from "@vita-os/ui/components/badge";
import { Button } from "@vita-os/ui/components/button";
import { Separator } from "@vita-os/ui/components/separator";
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Inbox,
  Sparkles,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import {
  InboxTaskList,
  InboxTaskRow,
} from "@/features/inbox/components/inbox-task-list";
import { flatListClassName } from "@/lib/flat-surface";

// Three Inbox redesign variants, switchable via ?variant=, on the existing /inbox route.

interface InboxRedesignPrototypeProps {
  tasks: Doc<"tasks">[];
  onProcess: (task: Doc<"tasks">) => void;
}

function partitionTasks(tasks: Doc<"tasks">[]) {
  return {
    openTasks: tasks.filter((task) => task.state === "open"),
    doneTasks: tasks.filter((task) => task.state === "done"),
  };
}

function InboxZero() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
      <CheckCircle2 className="mb-3 size-8 text-muted-foreground" />
      <h2 className="font-heading text-lg font-semibold">Inbox zero</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Nothing is waiting to be sorted.
      </p>
    </div>
  );
}

export function InboxRedesignVariantA({
  tasks,
  onProcess,
}: InboxRedesignPrototypeProps) {
  const { openTasks } = partitionTasks(tasks);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Inbox"
        description={
          openTasks.length === 0
            ? "Everything has a home."
            : `${openTasks.length} ${openTasks.length === 1 ? "item" : "items"} waiting to be sorted.`
        }
        titleAccessory={
          openTasks.length > 0 ? (
            <Badge variant="secondary">Queue</Badge>
          ) : undefined
        }
      />
      <InboxTaskList tasks={tasks} onProcess={onProcess} />
    </div>
  );
}

export function InboxRedesignVariantB({
  tasks,
  onProcess,
}: InboxRedesignPrototypeProps) {
  const { openTasks, doneTasks } = partitionTasks(tasks);
  const currentTask = openTasks[0];
  const remainingTasks = openTasks.slice(1);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Triage desk"
        description="Give one item a home, then move on."
        titleLeading={<Sparkles className="mr-1 size-5 text-primary" />}
        titleAccessory={
          <Badge variant="secondary">{openTasks.length} open</Badge>
        }
      />

      {currentTask ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
          <section className="rounded-2xl border bg-primary/[0.03] p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                  Start here
                </p>
                <h2 className="mt-1 font-heading text-lg font-semibold">
                  One thing at a time
                </h2>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                1 of {openTasks.length}
              </span>
            </div>
            <div className="rounded-xl border bg-background p-2">
              <InboxTaskRow task={currentTask} onProcess={onProcess} />
            </div>
            <Button
              className="mt-4 w-full"
              onClick={() => onProcess(currentTask)}
            >
              Process this item
              <ArrowRight className="size-4" />
            </Button>
          </section>

          <section className="min-w-0 rounded-2xl border bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Up next</h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {remainingTasks.length}
              </span>
            </div>
            {remainingTasks.length > 0 ? (
              <div className={flatListClassName}>
                {remainingTasks.map((task) => (
                  <InboxTaskRow
                    key={task._id}
                    task={task}
                    onProcess={onProcess}
                  />
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                You are at the end of the queue.
              </p>
            )}
          </section>
        </div>
      ) : (
        <InboxZero />
      )}

      {doneTasks.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CheckCircle2 className="size-4" />
            Finished today
            <span className="tabular-nums">{doneTasks.length}</span>
          </div>
          <div className={flatListClassName}>
            {doneTasks.map((task) => (
              <InboxTaskRow key={task._id} task={task} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function InboxRedesignVariantC({
  tasks,
  onProcess,
}: InboxRedesignPrototypeProps) {
  const { openTasks, doneTasks } = partitionTasks(tasks);
  const firstTask = openTasks[0];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Inbox className="size-4" />
            Capture review
          </div>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
            Inbox board
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sort the unsorted. Keep the completed work in view.
          </p>
        </div>
        {firstTask && (
          <Button onClick={() => onProcess(firstTask)}>
            Continue triage
            <ArrowRight className="size-4" />
          </Button>
        )}
      </header>

      {tasks.length === 0 ? (
        <InboxZero />
      ) : (
        <div className="grid overflow-hidden rounded-2xl border bg-border/60 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
          <section className="min-w-0 bg-background p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Needs a home</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Work your way down the stack.
                </p>
              </div>
              <Badge variant="secondary">{openTasks.length}</Badge>
            </div>
            {openTasks.length > 0 ? (
              <div className="space-y-2">
                {openTasks.map((task, index) => (
                  <div
                    key={task._id}
                    className="rounded-xl border bg-background px-2 py-1.5 shadow-sm"
                  >
                    <div className="flex items-center gap-2 px-2 pt-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[9px] tabular-nums">
                        {index + 1}
                      </span>
                      Queue item
                    </div>
                    <InboxTaskRow task={task} onProcess={onProcess} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                Nothing is waiting for a home.
              </p>
            )}
          </section>

          <aside className="border-t bg-muted/25 p-4 lg:border-t-0 lg:border-l sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Handled</h2>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {doneTasks.length}
              </span>
            </div>
            <Separator className="mb-2" />
            {doneTasks.length > 0 ? (
              <div className="space-y-1">
                {doneTasks.map((task) => (
                  <InboxTaskRow key={task._id} task={task} />
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Completed items will collect here.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
