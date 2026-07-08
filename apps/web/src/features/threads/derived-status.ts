import type { Condition } from "@convex/lib/condition";

export type ThreadStatus = "follow_up_due" | "scheduled" | "ready" | "open";

export interface ThreadStatusInput {
  followUp?: number | null;
  nextMove?: string | null;
}

export interface AreaStatusInput {
  condition: Condition;
  name: string;
}

export interface AreaThreadGroup<
  TArea extends AreaStatusInput,
  TThread extends ThreadStatusInput,
> {
  area: TArea;
  threads: TThread[];
}

const statusUrgency: Record<ThreadStatus, number> = {
  follow_up_due: 0,
  scheduled: 1,
  ready: 2,
  open: 3,
};

const conditionSeverity: Record<Condition, number> = {
  critical: 0,
  needs_attention: 1,
  healthy: 2,
};

export function getThreadStatus(
  thread: ThreadStatusInput,
  now: number,
): ThreadStatus {
  if (thread.followUp != null) {
    const followUpDay = startOfLocalDay(thread.followUp);
    const currentDay = startOfLocalDay(now);

    return followUpDay <= currentDay ? "follow_up_due" : "scheduled";
  }

  return hasNextMove(thread.nextMove) ? "ready" : "open";
}

export function compareThreadsByStatusUrgency<
  TThread extends ThreadStatusInput,
>(a: TThread, b: TThread, now: number) {
  const aStatus = getThreadStatus(a, now);
  const bStatus = getThreadStatus(b, now);
  const statusDifference = statusUrgency[aStatus] - statusUrgency[bStatus];

  if (statusDifference !== 0) return statusDifference;

  if (aStatus === "scheduled" || aStatus === "follow_up_due") {
    return (a.followUp ?? 0) - (b.followUp ?? 0);
  }

  return 0;
}

export function partitionThreadsByAttention<TThread extends ThreadStatusInput>(
  threads: TThread[],
  now: number,
) {
  const attention: TThread[] = [];
  const quiet: TThread[] = [];

  for (const thread of threads) {
    const status = getThreadStatus(thread, now);

    if (status === "follow_up_due" || status === "ready") {
      attention.push(thread);
    } else {
      quiet.push(thread);
    }
  }

  return { attention, quiet };
}

export function compareAreaThreadGroupsByPriority<
  TArea extends AreaStatusInput,
  TThread extends ThreadStatusInput,
>(
  a: AreaThreadGroup<TArea, TThread>,
  b: AreaThreadGroup<TArea, TThread>,
  now: number,
) {
  const aHasDue = a.threads.some(
    (thread) => getThreadStatus(thread, now) === "follow_up_due",
  );
  const bHasDue = b.threads.some(
    (thread) => getThreadStatus(thread, now) === "follow_up_due",
  );

  if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;

  const conditionDifference =
    conditionSeverity[a.area.condition] - conditionSeverity[b.area.condition];
  if (conditionDifference !== 0) return conditionDifference;

  return a.area.name.localeCompare(b.area.name);
}

function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function hasNextMove(nextMove: string | null | undefined) {
  return nextMove != null && nextMove.trim().length > 0;
}
