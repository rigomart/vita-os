export type ThreadLifecycle = "open" | "resolved";

export interface DashboardAttentionThread {
  id: string;
  lifecycle: ThreadLifecycle;
  name: string;
  nextMove?: string;
  followUp?: number;
}

export interface DashboardAttentionGroups<TThread> {
  followUpDue: TThread[];
  scheduled: TThread[];
  ready: TThread[];
  open: TThread[];
}

interface GroupThreadsByAttentionStateArgs<
  TThread extends DashboardAttentionThread,
> {
  currentDate: number;
  threads: TThread[];
}

export function groupThreadsByAttentionState<
  TThread extends DashboardAttentionThread,
>({
  currentDate,
  threads,
}: GroupThreadsByAttentionStateArgs<TThread>): DashboardAttentionGroups<TThread> {
  const groups: DashboardAttentionGroups<TThread> = {
    followUpDue: [],
    scheduled: [],
    ready: [],
    open: [],
  };
  const currentDay = startOfLocalDay(currentDate);

  for (const thread of threads) {
    if (thread.lifecycle === "resolved") continue;

    if (thread.followUp != null) {
      const followUpDay = startOfLocalDay(thread.followUp);

      if (followUpDay <= currentDay) {
        groups.followUpDue.push(thread);
      } else {
        groups.scheduled.push(thread);
      }

      continue;
    }

    if (hasNextMove(thread.nextMove)) {
      groups.ready.push(thread);
    } else {
      groups.open.push(thread);
    }
  }

  return groups;
}

function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function hasNextMove(nextMove: string | undefined) {
  return nextMove != null && nextMove.trim().length > 0;
}
